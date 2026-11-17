//! HTTP API of the local studio.

use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
use chrono::Utc;
use serde::Deserialize;
use serde_json::json;
use uuid::Uuid;

use crate::{
    ai::{ollama::Ollama, AiProvider},
    generate::{
        generate_calendar, regenerate_entry, GenerateRequest, RegenerateEntryRequest, Stage,
    },
    jobs::{JobStatus, Jobs},
    models::{
        slugify, Calendar, CalendarStatus, Demo, Entry, EntryStatus, NewCalendar, Publication,
    },
    publish::{bundle_path, public_from_calendar, seal, KeySource, MasterKey},
    schedule::entry_date,
    store::{Settings, Store},
    validate::sanitize_calendar,
};

#[derive(Clone)]
pub struct AppState {
    pub store: Store,
    pub jobs: Jobs,
    pub publish: PublishCtx,
}

pub struct ApiError(StatusCode, String);

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        (self.0, Json(json!({ "error": self.1 }))).into_response()
    }
}
impl From<std::io::Error> for ApiError {
    fn from(e: std::io::Error) -> Self {
        tracing::error!("storage error: {e}");
        ApiError(StatusCode::INTERNAL_SERVER_ERROR, "Storage error".into())
    }
}
fn bad(msg: &str) -> ApiError {
    ApiError(StatusCode::BAD_REQUEST, msg.into())
}
fn not_found() -> ApiError {
    ApiError(StatusCode::NOT_FOUND, "Calendar not found".into())
}

pub fn router(state: AppState) -> Router {
    Router::new()
        .route(
            "/api/health",
            get(|| async { Json(json!({ "ok": true, "service": "datedly" })) }),
        )
        .route("/api/ai/status", get(ai_status))
        .route("/api/settings", get(get_settings).put(put_settings))
        .route("/api/generate", post(start_generation))
        .route("/api/jobs/current", get(current_job))
        .route("/api/jobs/{id}", get(get_job))
        .route("/api/calendars", get(list_calendars).post(create_calendar))
        .route(
            "/api/calendars/{id}",
            get(get_calendar)
                .put(update_calendar)
                .delete(delete_calendar),
        )
        .route("/api/calendars/{id}/regenerate", post(regenerate_calendar))
        .route("/api/calendars/{id}/publish", post(publish_calendar))
        .route("/api/calendars/{id}/unpublish", post(unpublish_calendar))
        .route("/api/public/{slug}", get(public_view))
        .route(
            "/api/calendars/{id}/entries/regenerate",
            post(regenerate_one_entry),
        )
        .with_state(state)
}

async fn ai_status(State(s): State<AppState>) -> Json<serde_json::Value> {
    let settings = s.store.settings().await;
    let status = Ollama::new(&settings.ollama_endpoint).status().await;
    // If the saved model is no longer installed, fall back to the first one.
    let selected = settings
        .model
        .filter(|m| status.models.iter().any(|x| &x.name == m))
        .or_else(|| preferred_model(&status.models));
    Json(json!({ "status": status, "selected_model": selected }))
}

/// Default model when the user has not chosen one: models known to follow
/// JSON schemas well first, then the first installed one.
fn preferred_model(models: &[crate::ai::ModelInfo]) -> Option<String> {
    const PREFERRED: &[&str] = &[
        "qwen2.5",
        "qwen3",
        "llama3.1",
        "mistral-nemo",
        "gemma",
        "hermes3",
    ];
    PREFERRED
        .iter()
        .find_map(|p| models.iter().find(|m| m.name.starts_with(p)))
        .or(models.first())
        .map(|m| m.name.clone())
}

async fn get_settings(State(s): State<AppState>) -> Json<Settings> {
    Json(s.store.settings().await)
}

#[derive(Deserialize)]
struct SettingsInput {
    ollama_endpoint: Option<String>,
    model: Option<String>,
}

async fn put_settings(
    State(s): State<AppState>,
    Json(input): Json<SettingsInput>,
) -> Result<Json<Settings>, ApiError> {
    let mut settings = s.store.settings().await;
    if let Some(ep) = input.ollama_endpoint {
        let ep = ep.trim().to_string();
        if !(ep.starts_with("http://") || ep.starts_with("https://")) || ep.len() > 200 {
            return Err(bad("Endpoint must be an http(s) URL"));
        }
        settings.ollama_endpoint = ep;
    }
    if let Some(m) = input.model {
        settings.model = if m.trim().is_empty() {
            None
        } else {
            Some(m.trim().chars().take(120).collect())
        };
    }
    s.store.save_settings(&settings).await?;
    Ok(Json(settings))
}

async fn list_calendars(State(s): State<AppState>) -> Result<impl IntoResponse, ApiError> {
    Ok(Json(s.store.list().await?))
}

async fn create_calendar(
    State(s): State<AppState>,
    Json(input): Json<NewCalendar>,
) -> Result<impl IntoResponse, ApiError> {
    let title = input.title.trim();
    if title.is_empty() || title.len() > 140 {
        return Err(bad("Title is required (max 140 characters)"));
    }
    if input.entry_count > 366 {
        return Err(bad("A calendar can have at most 366 entries"));
    }
    if input.schedule.timezone.parse::<chrono_tz::Tz>().is_err() {
        return Err(bad("Unknown time zone"));
    }
    let now = Utc::now();
    let entries = (0..input.entry_count)
        .map(|n| Entry {
            id: Uuid::new_v4(),
            index: n + 1,
            title: format!("Entry {}", n + 1),
            date: entry_date(&input.schedule, n),
            content_type: "text".into(),
            blocks: vec![],
            metadata: Default::default(),
            status: EntryStatus::Scheduled,
        })
        .collect();
    let cal = Calendar {
        id: Uuid::new_v4(),
        slug: slugify(title),
        title: title.into(),
        description: input.description,
        prompt: input.prompt,
        language: "en".into(),
        theme: "aurora".into(),
        schedule: input.schedule,
        status: CalendarStatus::Draft,
        entries,
        generation: None,
        publication: None,
        created_at: now,
        updated_at: now,
    };
    s.store.save(&cal).await?;
    Ok((StatusCode::CREATED, Json(cal)))
}

async fn get_calendar(
    State(s): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<Calendar>, ApiError> {
    s.store.get(id).await?.map(Json).ok_or_else(not_found)
}

async fn update_calendar(
    State(s): State<AppState>,
    Path(id): Path<Uuid>,
    Json(mut cal): Json<Calendar>,
) -> Result<Json<Calendar>, ApiError> {
    let existing = s.store.get(id).await?.ok_or_else(not_found)?;
    sanitize_calendar(&mut cal).map_err(|m| bad(&m))?;
    // Identity and history come from the server, not from the request.
    cal.id = existing.id;
    cal.created_at = existing.created_at;
    cal.generation = existing.generation;
    cal.prompt = existing.prompt;
    cal.status = existing.status;
    cal.publication = existing.publication;
    cal.slug = existing.slug;
    cal.updated_at = Utc::now();
    s.store.save(&cal).await?;
    sync_bundle(&s.publish, &cal)?;
    Ok(Json(cal))
}

async fn delete_calendar(
    State(s): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, ApiError> {
    if let Some(cal) = s.store.get(id).await? {
        let _ = std::fs::remove_file(bundle_path(&s.publish.publish_dir, &cal.slug));
    }
    if s.store.delete(id).await? {
        Ok(StatusCode::NO_CONTENT)
    } else {
        Err(not_found())
    }
}

// ---------------------------------------------------------------- generation

/// Picks the provider and model: requested > saved > preferred installed one.
async fn resolve_model(
    s: &AppState,
    requested: Option<String>,
) -> Result<(Ollama, String), ApiError> {
    let settings = s.store.settings().await;
    let ollama = Ollama::new(&settings.ollama_endpoint);
    let status = ollama.status().await;
    if !status.available {
        return Err(ApiError(
            StatusCode::SERVICE_UNAVAILABLE,
            status
                .error
                .unwrap_or_else(|| "Ollama is not reachable".into()),
        ));
    }
    let model = requested
        .or(settings.model)
        .filter(|m| status.models.iter().any(|x| &x.name == m))
        .or_else(|| preferred_model(&status.models))
        .ok_or_else(|| bad("No text model is installed in Ollama. Try: ollama pull qwen2.5:7b"))?;
    Ok((ollama, model))
}

async fn start_generation(
    State(s): State<AppState>,
    Json(req): Json<GenerateRequest>,
) -> Result<impl IntoResponse, ApiError> {
    req.validate().map_err(|m| bad(&m))?;
    let (ollama, model) = resolve_model(&s, req.model.clone()).await?;
    let id = spawn_generation(&s, ollama, model.clone(), req, None)?;
    Ok((
        StatusCode::ACCEPTED,
        Json(json!({ "job_id": id, "model": model })),
    ))
}

/// Regenerates a whole calendar from its prompt, keeping its id and schedule.
async fn regenerate_calendar(
    State(s): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, ApiError> {
    let existing = s.store.get(id).await?.ok_or_else(not_found)?;
    let req = GenerateRequest {
        prompt: if existing.prompt.trim().chars().count() >= 8 {
            existing.prompt.clone()
        } else {
            format!("{}. {}", existing.title, existing.description)
        },
        entry_count: Some((existing.entries.len() as u32).clamp(1, crate::generate::MAX_ENTRIES)),
        start_date: Some(existing.schedule.start_date),
        language: Some(existing.language.clone()),
        model: None,
    };
    req.validate().map_err(|m| bad(&m))?;
    let (ollama, model) = resolve_model(&s, None).await?;
    let job = spawn_generation(&s, ollama, model.clone(), req, Some(existing))?;
    Ok((
        StatusCode::ACCEPTED,
        Json(json!({ "job_id": job, "model": model })),
    ))
}

fn spawn_generation(
    s: &AppState,
    ollama: Ollama,
    model: String,
    req: GenerateRequest,
    target: Option<Calendar>,
) -> Result<Uuid, ApiError> {
    let id = s.jobs.start(&model).map_err(|_| {
        ApiError(
            StatusCode::CONFLICT,
            "A calendar is already being generated. Wait for it to finish.".into(),
        )
    })?;
    let (jobs, store, publish) = (s.jobs.clone(), s.store.clone(), s.publish.clone());
    tokio::spawn(async move {
        let handle = jobs.handle(id);
        // Content is never logged: only stages and sizes.
        tracing::info!("generation {id} started with {model}");
        let result = generate_calendar(&ollama, &model, &req, &handle)
            .await
            .map(|mut cal| {
                if let Some(old) = &target {
                    // Same calendar, new content: keep identity, schedule and look.
                    cal.id = old.id;
                    cal.slug = old.slug.clone();
                    cal.created_at = old.created_at;
                    cal.status = old.status;
                    cal.publication = old.publication.clone();
                    cal.theme = old.theme.clone();
                    cal.schedule.interval = old.schedule.interval.clone();
                    cal.schedule.timezone = old.schedule.timezone.clone();
                    cal.schedule.unlock_time = old.schedule.unlock_time.clone();
                    let schedule = cal.schedule.clone();
                    for e in cal.entries.iter_mut() {
                        e.date = entry_date(&schedule, e.index - 1);
                    }
                }
                cal
            });
        match result {
            Ok(cal) => match store.save(&cal).await {
                Ok(()) => {
                    if let Err(e) = sync_bundle(&publish, &cal) {
                        tracing::warn!("bundle refresh failed: {}", e.1);
                    }
                    tracing::info!("generation {id} done: {} entries", cal.entries.len());
                    jobs.update(id, |j| {
                        j.status = JobStatus::Done;
                        j.stage = Stage::Done;
                        j.message = "Your calendar is ready".into();
                        j.done = cal.entries.len() as u32;
                        j.calendar_id = Some(cal.id);
                    });
                }
                Err(e) => jobs.update(id, |j| {
                    j.status = JobStatus::Failed;
                    j.error = Some(format!("Could not save the calendar: {e}"));
                }),
            },
            Err(e) => {
                tracing::warn!("generation {id} failed: {e}");
                jobs.update(id, |j| {
                    j.status = JobStatus::Failed;
                    j.error = Some(e.to_string());
                });
            }
        }
    });
    Ok(id)
}

/// Writes a new version of one entry and returns it WITHOUT saving: the
/// editor merges it into the draft, so unsaved edits are never lost.
async fn regenerate_one_entry(
    State(s): State<AppState>,
    Path(id): Path<Uuid>,
    Json(req): Json<RegenerateEntryRequest>,
) -> Result<impl IntoResponse, ApiError> {
    let cal = s.store.get(id).await?.ok_or_else(not_found)?;
    if s.jobs.running().is_some() {
        return Err(ApiError(
            StatusCode::CONFLICT,
            "A calendar is being generated. Try again when it is done.".into(),
        ));
    }
    let (ollama, model) = resolve_model(&s, None).await?;
    let entry = regenerate_entry(&ollama, &model, &cal, &req)
        .await
        .map_err(|e| ApiError(StatusCode::BAD_GATEWAY, e.to_string()))?;
    Ok(Json(entry))
}

async fn get_job(
    State(s): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, ApiError> {
    s.jobs
        .get(id)
        .map(Json)
        .ok_or_else(|| ApiError(StatusCode::NOT_FOUND, "Job not found".into()))
}

async fn current_job(State(s): State<AppState>) -> impl IntoResponse {
    Json(json!({ "job": s.jobs.running() }))
}

// ---------------------------------------------------------------- publication

/// Where bundles go and where the master key lives.
#[derive(Clone)]
pub struct PublishCtx {
    pub data_dir: std::path::PathBuf,
    pub publish_dir: std::path::PathBuf,
}

/// Keeps `published/<slug>.enc.json` in line with the calendar:
/// written when published, removed otherwise.
fn sync_bundle(ctx: &PublishCtx, cal: &Calendar) -> Result<Option<KeySource>, ApiError> {
    let path = bundle_path(&ctx.publish_dir, &cal.slug);
    if cal.status != CalendarStatus::Published {
        match std::fs::remove_file(&path) {
            Ok(()) => {}
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => {}
            Err(e) => return Err(e.into()),
        }
        return Ok(None);
    }
    let (key, source) = MasterKey::load_or_create(&ctx.data_dir)
        .map_err(|e| ApiError(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    let bundle =
        seal(cal, &key).map_err(|e| ApiError(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    std::fs::create_dir_all(&ctx.publish_dir)?;
    let tmp = path.with_extension("tmp");
    std::fs::write(
        &tmp,
        serde_json::to_vec_pretty(&bundle)
            .map_err(|e| ApiError(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?,
    )?;
    std::fs::rename(&tmp, &path)?;
    // Content is never logged: only the slug and the size.
    tracing::info!(
        "bundle written: {} ({} entries)",
        cal.slug,
        bundle.entries.len()
    );
    Ok(Some(source))
}

#[derive(Deserialize)]
struct PublishInput {
    /// Accelerated demo: one entry every N minutes, starting now (or `demo_start`).
    #[serde(default)]
    demo_every_minutes: Option<u32>,
    #[serde(default)]
    demo_start: Option<chrono::DateTime<Utc>>,
}

async fn publish_calendar(
    State(s): State<AppState>,
    Path(id): Path<Uuid>,
    Json(input): Json<PublishInput>,
) -> Result<impl IntoResponse, ApiError> {
    let mut cal = s.store.get(id).await?.ok_or_else(not_found)?;
    sanitize_calendar(&mut cal).map_err(|m| bad(&m))?;
    if cal.entries.is_empty() {
        return Err(bad("Add at least one entry before publishing."));
    }
    if let Some(n) = input.demo_every_minutes {
        if !(1..=1440).contains(&n) {
            return Err(bad("Demo interval must be between 1 and 1440 minutes."));
        }
    }
    // A published URL must be unique: suffix the slug if another calendar uses it.
    let others = s.store.all().await?;
    let taken = |slug: &str| {
        others
            .iter()
            .any(|o| o.id != cal.id && o.status == CalendarStatus::Published && o.slug == slug)
    };
    let base = slugify(&cal.title);
    let mut slug = if cal.status == CalendarStatus::Published {
        cal.slug.clone()
    } else {
        base.clone()
    };
    let mut n = 2;
    while taken(&slug) {
        slug = format!("{base}-{n}");
        n += 1;
    }
    // Republishing under a new slug: remove the old bundle first.
    if cal.status == CalendarStatus::Published && cal.slug != slug {
        let _ = std::fs::remove_file(bundle_path(&s.publish.publish_dir, &cal.slug));
    }
    cal.slug = slug;
    cal.status = CalendarStatus::Published;
    cal.publication = Some(Publication {
        published_at: Utc::now(),
        demo: input.demo_every_minutes.map(|every| Demo {
            start: input.demo_start.unwrap_or_else(Utc::now),
            every_minutes: every,
        }),
    });
    cal.updated_at = Utc::now();
    s.store.save(&cal).await?;
    let source = sync_bundle(&s.publish, &cal)?;
    let key = match source {
        Some(KeySource::Env) => json!({ "source": "env" }),
        Some(KeySource::File(p)) => {
            json!({ "source": "file", "path": p.display().to_string(), "created": false })
        }
        Some(KeySource::Created(p)) => {
            json!({ "source": "file", "path": p.display().to_string(), "created": true })
        }
        None => json!(null),
    };
    let bundle = bundle_path(&s.publish.publish_dir, &cal.slug);
    Ok(Json(
        json!({ "calendar": cal, "bundle": bundle.display().to_string(), "key": key }),
    ))
}

async fn unpublish_calendar(
    State(s): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, ApiError> {
    let mut cal = s.store.get(id).await?.ok_or_else(not_found)?;
    cal.status = CalendarStatus::Draft;
    cal.publication = None;
    cal.updated_at = Utc::now();
    s.store.save(&cal).await?;
    sync_bundle(&s.publish, &cal)?;
    Ok(Json(cal))
}

/// Local preview of the public page, computed with the server clock.
async fn public_view(
    State(s): State<AppState>,
    Path(slug): Path<String>,
) -> Result<impl IntoResponse, ApiError> {
    let cal = s
        .store
        .all()
        .await?
        .into_iter()
        .find(|c| c.slug == slug && c.status == CalendarStatus::Published)
        .ok_or_else(|| {
            ApiError(
                StatusCode::NOT_FOUND,
                "No published calendar with this address".into(),
            )
        })?;
    Ok(Json(public_from_calendar(&cal, Utc::now())))
}
