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
    generate::{generate_calendar, GenerateRequest, Stage},
    jobs::{JobStatus, Jobs},
    models::{slugify, Calendar, CalendarStatus, Entry, EntryStatus, NewCalendar},
    schedule::entry_date,
    store::{Settings, Store},
};

#[derive(Clone)]
pub struct AppState {
    pub store: Store,
    pub jobs: Jobs,
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
        .route("/api/health", get(|| async { Json(json!({ "ok": true, "service": "datedly" })) }))
        .route("/api/ai/status", get(ai_status))
        .route("/api/settings", get(get_settings).put(put_settings))
        .route("/api/generate", post(start_generation))
        .route("/api/jobs/current", get(current_job))
        .route("/api/jobs/{id}", get(get_job))
        .route("/api/calendars", get(list_calendars).post(create_calendar))
        .route(
            "/api/calendars/{id}",
            get(get_calendar).put(update_calendar).delete(delete_calendar),
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
        .or_else(|| status.models.first().map(|m| m.name.clone()));
    Json(json!({ "status": status, "selected_model": selected }))
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
        settings.model = if m.trim().is_empty() { None } else { Some(m.trim().chars().take(120).collect()) };
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
    if cal.title.trim().is_empty() {
        return Err(bad("Title is required"));
    }
    cal.id = existing.id;
    cal.created_at = existing.created_at;
    cal.updated_at = Utc::now();
    cal.slug = slugify(&cal.slug);
    s.store.save(&cal).await?;
    Ok(Json(cal))
}

async fn delete_calendar(
    State(s): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, ApiError> {
    if s.store.delete(id).await? {
        Ok(StatusCode::NO_CONTENT)
    } else {
        Err(not_found())
    }
}

// ---------------------------------------------------------------- generation

async fn start_generation(
    State(s): State<AppState>,
    Json(req): Json<GenerateRequest>,
) -> Result<impl IntoResponse, ApiError> {
    req.validate().map_err(|m| bad(&m))?;
    let settings = s.store.settings().await;
    let ollama = Ollama::new(&settings.ollama_endpoint);
    let status = ollama.status().await;
    if !status.available {
        return Err(ApiError(
            StatusCode::SERVICE_UNAVAILABLE,
            status.error.unwrap_or_else(|| "Ollama is not reachable".into()),
        ));
    }
    // Requested model > saved model > first installed model, if installed.
    let model = req
        .model
        .clone()
        .or(settings.model.clone())
        .filter(|m| status.models.iter().any(|x| &x.name == m))
        .or_else(|| status.models.first().map(|m| m.name.clone()))
        .ok_or_else(|| bad("No text model is installed in Ollama. Try: ollama pull qwen2.5:7b"))?;

    let id = s.jobs.start(&model).map_err(|_| {
        ApiError(StatusCode::CONFLICT, "A calendar is already being generated. Wait for it to finish.".into())
    })?;
    let (jobs, store) = (s.jobs.clone(), s.store.clone());
    let model_out = model.clone();
    tokio::spawn(async move {
        let handle = jobs.handle(id);
        // Content is never logged: only stages and sizes.
        tracing::info!("generation {id} started with {model}");
        match generate_calendar(&ollama, &model, &req, &handle).await {
            Ok(cal) => match store.save(&cal).await {
                Ok(()) => {
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
    Ok((StatusCode::ACCEPTED, Json(json!({ "job_id": id, "model": model_out }))))
}

async fn get_job(State(s): State<AppState>, Path(id): Path<Uuid>) -> Result<impl IntoResponse, ApiError> {
    s.jobs.get(id).map(Json).ok_or_else(|| ApiError(StatusCode::NOT_FOUND, "Job not found".into()))
}

async fn current_job(State(s): State<AppState>) -> impl IntoResponse {
    Json(json!({ "job": s.jobs.running() }))
}
