//! Prompt-to-calendar engine.
//!
//! Pipeline: understand the prompt (brief) → plan the progression → write the
//! entries in small batches → validate and repair → build the `Calendar`.
//! Every AI answer is constrained by a JSON schema and validated in Rust.
//! Dates are always computed here, never by the AI.

use std::collections::{BTreeMap, HashSet};
use std::time::Instant;

use chrono::{Datelike, Days, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use uuid::Uuid;

use crate::ai::{AiError, AiProvider, JsonRequest};
use crate::models::{
    default_timezone, slugify, Block, Calendar, CalendarStatus, Entry, EntryStatus,
    GenerationReport, Interval, Schedule,
};
use crate::schedule::{entry_date, parse_tz};

/// Local models are slow: keep calendars to a size they can write reliably.
pub const MAX_ENTRIES: u32 = 60;
const BATCH_SIZE: usize = 4;
const MAX_ATTEMPTS: u32 = 3;
const REPAIR_ROUNDS: u32 = 2;

pub const THEMES: &[&str] = &["aurora", "ember", "forest", "ocean", "candy", "mono"];

// ---------------------------------------------------------------- inputs

#[derive(Debug, Clone, Deserialize, Default)]
pub struct GenerateRequest {
    pub prompt: String,
    /// Optional overrides from "advanced settings".
    #[serde(default)]
    pub entry_count: Option<u32>,
    #[serde(default)]
    pub start_date: Option<NaiveDate>,
    #[serde(default)]
    pub language: Option<String>,
    #[serde(default)]
    pub model: Option<String>,
}

impl GenerateRequest {
    pub fn validate(&self) -> Result<(), String> {
        let p = self.prompt.trim();
        if p.chars().count() < 8 {
            return Err("Describe your calendar idea in a few words (at least 8 characters).".into());
        }
        if p.chars().count() > 2000 {
            return Err("The prompt is too long (2000 characters max).".into());
        }
        if let Some(n) = self.entry_count {
            if n == 0 || n > MAX_ENTRIES {
                return Err(format!("Number of entries must be between 1 and {MAX_ENTRIES}."));
            }
        }
        Ok(())
    }
}

// ---------------------------------------------------------------- AI shapes

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Brief {
    pub title: String,
    pub description: String,
    pub topic: String,
    pub audience: String,
    pub objective: String,
    pub language: String,
    pub tone: String,
    pub entry_count: u32,
    pub interval: String,
    pub start_date: String,
    pub content_formats: Vec<String>,
    pub difficulty: String,
    pub theme: String,
    pub requirements: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlanSection {
    pub title: String,
    pub from: u32,
    pub to: u32,
    pub focus: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlannedEntry {
    pub index: u32,
    pub title: String,
    pub content_type: String,
    pub summary: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Plan {
    pub sections: Vec<PlanSection>,
    pub entries: Vec<PlannedEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct GenQuiz {
    pub question: String,
    pub choices: Vec<String>,
    pub answer_index: i64,
    pub explanation: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct GenResource {
    pub label: String,
    pub url: String,
}

/// Flat shape that small models fill reliably; converted to `Block`s after.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct GenEntry {
    pub index: u32,
    pub title: String,
    pub content_type: String,
    pub body: String,
    #[serde(default)]
    pub fact: String,
    #[serde(default)]
    pub challenge: String,
    #[serde(default)]
    pub steps: Vec<String>,
    #[serde(default)]
    pub quiz: GenQuiz,
    #[serde(default)]
    pub resources: Vec<GenResource>,
    #[serde(default)]
    pub image_prompt: String,
}

// ---------------------------------------------------------------- progress

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum Stage {
    Understanding,
    Planning,
    Writing,
    Validating,
    Saving,
    Done,
}

/// Receives progress updates (implemented by the job registry).
pub trait Progress: Send + Sync {
    fn stage(&self, stage: Stage, message: &str);
    fn entries(&self, done: u32, total: u32);
    fn brief(&self, brief: &Brief);
    fn plan(&self, plan: &Plan);
    fn log(&self, message: &str);
}

#[derive(Debug, thiserror::Error)]
pub enum GenError {
    #[error("{0}")]
    Ai(#[from] AiError),
    #[error("{0}")]
    Invalid(String),
}

// ---------------------------------------------------------------- schemas

fn str_t() -> Value {
    json!({ "type": "string" })
}
fn str_arr() -> Value {
    json!({ "type": "array", "items": { "type": "string" } })
}

fn brief_schema() -> Value {
    json!({
        "type": "object",
        "properties": {
            "title": str_t(), "description": str_t(), "topic": str_t(), "audience": str_t(),
            "objective": str_t(), "language": str_t(), "tone": str_t(),
            "entry_count": { "type": "integer" },
            "interval": { "type": "string", "enum": ["daily", "weekly", "monthly"] },
            "start_date": str_t(),
            "content_formats": str_arr(), "difficulty": str_t(),
            "theme": { "type": "string", "enum": THEMES },
            "requirements": str_arr()
        },
        "required": ["title","description","topic","audience","objective","language","tone",
                     "entry_count","interval","start_date","content_formats","difficulty","theme","requirements"]
    })
}

fn plan_schema() -> Value {
    json!({
        "type": "object",
        "properties": {
            "sections": { "type": "array", "items": {
                "type": "object",
                "properties": { "title": str_t(), "from": {"type":"integer"}, "to": {"type":"integer"}, "focus": str_t() },
                "required": ["title","from","to","focus"]
            }},
            "entries": { "type": "array", "items": {
                "type": "object",
                "properties": { "index": {"type":"integer"}, "title": str_t(), "content_type": str_t(), "summary": str_t() },
                "required": ["index","title","content_type","summary"]
            }}
        },
        "required": ["sections","entries"]
    })
}

fn entries_schema() -> Value {
    json!({
        "type": "object",
        "properties": {
            "entries": { "type": "array", "items": {
                "type": "object",
                "properties": {
                    "index": {"type":"integer"}, "title": str_t(), "content_type": str_t(),
                    "body": str_t(), "fact": str_t(), "challenge": str_t(), "steps": str_arr(),
                    "quiz": {
                        "type": "object",
                        "properties": { "question": str_t(), "choices": str_arr(),
                                        "answer_index": {"type":"integer"}, "explanation": str_t() },
                        "required": ["question","choices","answer_index","explanation"]
                    },
                    "resources": { "type": "array", "items": {
                        "type": "object",
                        "properties": { "label": str_t(), "url": str_t() },
                        "required": ["label","url"]
                    }},
                    "image_prompt": str_t()
                },
                "required": ["index","title","content_type","body","fact","challenge","steps","quiz","resources","image_prompt"]
            }}
        },
        "required": ["entries"]
    })
}

// ---------------------------------------------------------------- prompts

const SYSTEM: &str = "You are Datedly AI, an expert editor who designs calendars of daily content \
(advent calendars, courses, challenges, programs, editorial plans...). You write original, accurate, \
engaging content. Never reproduce song lyrics or copyrighted text. Only mention real, well-documented \
people, events, places and facts; never invent names. When unsure of a precise fact, \
date or number, stay general rather than invent. Always answer with JSON only, following the schema.";

fn brief_prompt(req: &GenerateRequest, today: NaiveDate) -> String {
    let mut s = format!(
        "Today is {today}. Analyse this calendar request and extract a brief.\n\nREQUEST:\n\"\"\"{}\"\"\"\n\n\
Rules:\n\
- title: short and catchy, in the calendar's language.\n\
- description: 1-2 sentences for visitors, in the calendar's language (the request's language unless another is asked).\n\
- audience: who the calendar is for, in words (e.g. \"8-year-old children\", \"small business owners\").\n\
- language: ISO code of the language the request is written in (e.g. en, fr), unless another language is asked.\n\
- entry_count: number of entries asked (e.g. \"24-day\" = 24, \"12-month\" = 12, \"one year daily\" = 365). Default 7 if unclear.\n\
- interval: daily, weekly or monthly.\n\
- start_date: YYYY-MM-DD if the request implies one (an Advent calendar starts on December 1st of the coming season), otherwise empty string.\n\
- content_formats: the kinds of entries that fit (e.g. quiz, challenge, fact, story, lesson, activity, recipe, recommendation).\n\
- theme: the visual palette that fits best: aurora (violet night), ember (warm red/orange, festive), forest (green, nature/health), ocean (blue, calm/travel/tech), candy (pink/playful, kids), mono (sober, business).\n\
- requirements: explicit constraints from the request.",
        req.prompt.trim()
    );
    if let Some(n) = req.entry_count {
        s.push_str(&format!("\nThe user fixed entry_count = {n}."));
    }
    if let Some(l) = &req.language {
        s.push_str(&format!("\nThe user wants the calendar written in language: {l}."));
    }
    s
}

fn brief_context(b: &Brief) -> String {
    format!(
        "CALENDAR: \"{}\" — {}\nTopic: {}\nAudience: {}\nObjective: {}\nTone: {}\nDifficulty: {}\n\
Formats: {}\nConstraints: {}\nWRITE EVERYTHING IN LANGUAGE: {}",
        b.title, b.description, b.topic, b.audience, b.objective, b.tone, b.difficulty,
        b.content_formats.join(", "),
        if b.requirements.is_empty() { "none".into() } else { b.requirements.join("; ") },
        b.language
    )
}

fn plan_prompt(b: &Brief, original: &str, dates: &[NaiveDate]) -> String {
    let calendar: String = dates
        .iter()
        .enumerate()
        .map(|(i, d)| format!("{} = {}", i + 1, d.format("%a %d %B %Y")))
        .collect::<Vec<_>>()
        .join("; ");
    format!(
        "{}\n\nOriginal request: \"\"\"{}\"\"\"\n\nPublication date of each entry: {calendar}\n\n\
Plan exactly {n} entries, indexes 1 to {n}. Match seasonal content to these real dates.\n\
- Group them into 2 to 6 sections with a logical progression (from/to are entry indexes, covering 1..{n}). A section title is a short theme name of 2 to 4 words (e.g. \"Fundamentals\", \"Legends & history\"), never an entry title.\n\
- Vary content_type: never the same type twice in a row when several formats fit.\n\
- Build up in intensity, with a highlight on the last entry.\n\
- Each title is unique and specific (no \"Day 3\" titles). Summary: one sentence of what the entry contains.",
        brief_context(b),
        original.trim(),
        n = b.entry_count
    )
}

fn entries_prompt(b: &Brief, plan: &Plan, batch: &[&PlannedEntry]) -> String {
    let outline: String = plan
        .entries
        .iter()
        .map(|e| format!("{}. {} ({})", e.index, e.title, e.content_type))
        .collect::<Vec<_>>()
        .join("\n");
    let todo: String = batch
        .iter()
        .map(|e| format!("- index {}: \"{}\" [{}] — {}", e.index, e.title, e.content_type, e.summary))
        .collect::<Vec<_>>()
        .join("\n");
    format!(
        "{}\n\nFULL OUTLINE (for context, avoid repeating other entries):\n{}\n\n\
Write the complete content of these {} entries:\n{}\n\n\
For each entry:\n\
- body: the main content, 60 to 160 words, concrete and engaging, adapted to the audience.\n\
- fact: one interesting verifiable fact if relevant, else \"\".\n\
- challenge: a short action for the reader only if the entry is a challenge or activity, else \"\".\n\
- steps: numbered instructions only for activities/recipes/exercises, else [].\n\
- quiz: ONLY if content_type is quiz: a question with 3 or 4 choices, answer_index (0-based) of the correct one and a one-sentence explanation; otherwise question \"\", choices [], answer_index 0, explanation \"\".\n\
- resources: 0 to 2 well-known official sources (label + url) only if you are sure the URL exists, else [].\n\
- image_prompt: one sentence describing an illustration for this entry.\n\
Keep the same index, title and content_type as the outline.",
        brief_context(b),
        outline,
        batch.len(),
        todo
    )
}

// ---------------------------------------------------------------- AI calls

async fn ask<T: for<'de> Deserialize<'de>>(
    ai: &dyn AiProvider,
    model: &str,
    prompt: String,
    schema: Value,
    temperature: f32,
    progress: &dyn Progress,
    what: &str,
) -> Result<T, GenError> {
    let req = JsonRequest { model: model.into(), system: SYSTEM.into(), prompt, schema, temperature };
    let mut last: Option<GenError> = None;
    for attempt in 1..=MAX_ATTEMPTS {
        match ai.generate_json(&req).await {
            Ok(v) => match serde_json::from_value::<T>(v) {
                Ok(t) => return Ok(t),
                Err(e) => {
                    progress.log(&format!("{what}: answer did not match the expected shape (attempt {attempt}), retrying"));
                    last = Some(GenError::Invalid(format!("Unexpected AI answer shape: {e}")));
                }
            },
            // Unreachable provider: retrying will not help.
            Err(e @ AiError::Unreachable(_)) => return Err(e.into()),
            Err(e @ AiError::Provider(_)) if e.to_string().contains("not found") => return Err(e.into()),
            Err(e) => {
                progress.log(&format!("{what}: {e} (attempt {attempt}), retrying"));
                last = Some(e.into());
            }
        }
    }
    Err(last.unwrap_or_else(|| GenError::Invalid("Generation failed".into())))
}

// ---------------------------------------------------------------- normalisation & validation

fn normalise_brief(mut b: Brief, req: &GenerateRequest, today: NaiveDate) -> (Brief, NaiveDate, Interval) {
    if b.title.trim().is_empty() {
        b.title = req.prompt.chars().take(60).collect();
    }
    b.title = b.title.trim().chars().take(140).collect();
    if let Some(n) = req.entry_count {
        b.entry_count = n;
    }
    b.entry_count = b.entry_count.clamp(1, MAX_ENTRIES);
    if let Some(l) = &req.language {
        b.language = l.clone();
    }
    if b.language.trim().is_empty() {
        b.language = "en".into();
    }
    if !THEMES.contains(&b.theme.as_str()) {
        b.theme = "aurora".into();
    }
    let interval = match b.interval.as_str() {
        "weekly" => Interval::Weekly,
        "monthly" => Interval::Monthly,
        _ => Interval::Daily,
    };
    let ai_date = NaiveDate::parse_from_str(b.start_date.trim(), "%Y-%m-%d").ok().filter(|d| *d >= today);
    let default_start = if interval == Interval::Monthly {
        // Monthly calendars read best starting on the 1st of next month.
        today
            .checked_add_months(chrono::Months::new(1))
            .and_then(|d| d.with_day(1))
            .unwrap_or(today + Days::new(1))
    } else {
        today + Days::new(1)
    };
    let start = req.start_date.or(ai_date).unwrap_or(default_start);
    b.start_date = start.to_string();
    (b, start, interval)
}

/// Makes the plan contain exactly `n` entries with indexes 1..=n.
fn normalise_plan(mut plan: Plan, n: u32) -> Plan {
    let mut by_index: BTreeMap<u32, PlannedEntry> = BTreeMap::new();
    for e in plan.entries.drain(..) {
        if (1..=n).contains(&e.index) && !e.title.trim().is_empty() {
            by_index.entry(e.index).or_insert(e);
        }
    }
    // Entries the plan forgot get a neutral placeholder the writer will fill.
    for i in 1..=n {
        by_index.entry(i).or_insert_with(|| PlannedEntry {
            index: i,
            title: format!("Entry {i}"),
            content_type: "text".into(),
            summary: "Continue the progression of the calendar with a new, distinct idea.".into(),
        });
    }
    plan.entries = by_index.into_values().collect();
    let meaningful = |t: &str| t.chars().filter(|c| c.is_alphanumeric()).count() >= 2;
    for s in plan.sections.iter_mut() {
        if !meaningful(&s.title) && meaningful(&s.focus) {
            s.title = s.focus.clone();
        }
    }
    plan.sections.retain(|s| s.from >= 1 && s.to <= n && s.from <= s.to && meaningful(&s.title));
    plan
}

#[derive(Debug, PartialEq)]
pub enum Issue {
    Missing(u32),
    EmptyBody(u32),
    BadQuiz(u32),
}

impl Issue {
    fn index(&self) -> u32 {
        match self {
            Issue::Missing(i) | Issue::EmptyBody(i) | Issue::BadQuiz(i) => *i,
        }
    }
}

/// A quiz block is kept only when the entry is meant to be a quiz, so every
/// entry does not end up with a bonus question the plan never asked for.
fn is_quiz(e: &GenEntry) -> bool {
    let t = e.content_type.to_lowercase();
    t.contains("quiz") || t.contains("trivia") || t.contains("question")
}

fn quiz_ok(q: &GenQuiz) -> bool {
    let choices: Vec<&String> = q.choices.iter().filter(|c| !c.trim().is_empty()).collect();
    !q.question.trim().is_empty()
        && (2..=6).contains(&choices.len())
        && q.answer_index >= 0
        && (q.answer_index as usize) < q.choices.len()
}

/// Blocking problems that trigger a regeneration of the entry.
pub fn find_issues(entries: &BTreeMap<u32, GenEntry>, n: u32) -> Vec<Issue> {
    let mut issues = vec![];
    for i in 1..=n {
        match entries.get(&i) {
            None => issues.push(Issue::Missing(i)),
            Some(e) if e.body.trim().split_whitespace().count() < 12 => issues.push(Issue::EmptyBody(i)),
            Some(e) if is_quiz(e) && !quiz_ok(&e.quiz) => {
                issues.push(Issue::BadQuiz(i))
            }
            _ => {}
        }
    }
    issues
}

fn norm_title(t: &str) -> String {
    t.to_lowercase().chars().filter(|c| c.is_alphanumeric()).collect()
}

/// Non-blocking findings reported to the user.
pub fn find_warnings(entries: &BTreeMap<u32, GenEntry>, expected: u32) -> Vec<String> {
    let mut warnings = vec![];
    let mut seen: BTreeMap<String, u32> = BTreeMap::new();
    for (i, e) in entries {
        let key = norm_title(&e.title);
        if let Some(first) = seen.get(&key) {
            warnings.push(format!("Entries {first} and {i} have the same title."));
        } else {
            seen.insert(key, *i);
        }
    }
    let bodies: Vec<(u32, HashSet<String>)> = entries
        .iter()
        .map(|(i, e)| (*i, e.body.to_lowercase().split_whitespace().map(String::from).collect()))
        .collect();
    for w in bodies.windows(2) {
        let (a, b) = (&w[0].1, &w[1].1);
        let inter = a.intersection(b).count() as f64;
        let union = a.union(b).count().max(1) as f64;
        if inter / union > 0.6 {
            warnings.push(format!("Entries {} and {} are very similar.", w[0].0, w[1].0));
        }
    }
    let types: Vec<String> = entries.values().map(|e| e.content_type.to_lowercase()).collect();
    let distinct: HashSet<&String> = types.iter().collect();
    if expected >= 6 && distinct.len() == 1 {
        warnings.push("All entries use the same format.".into());
    }
    let missing = find_issues(entries, expected).len();
    if missing > 0 {
        warnings.push(format!("{missing} entries could not be fully written and are marked as to complete."));
    }
    warnings
}

/// "A) Paris", "b. Paris", "1) Paris" -> "Paris" (the UI lays out choices itself).
fn strip_choice_label(c: &str) -> String {
    let t = c.trim();
    let mut chars = t.chars();
    if let (Some(first), Some(sep)) = (chars.next(), chars.next()) {
        if first.is_ascii_alphanumeric() && matches!(sep, ')' | '.' | ':') {
            let rest = chars.as_str().trim_start();
            if !rest.is_empty() {
                return rest.to_string();
            }
        }
    }
    t.to_string()
}

fn to_blocks(e: &GenEntry) -> Vec<Block> {
    let mut blocks = vec![];
    let ct = e.content_type.to_lowercase();
    let body = e.body.trim().to_string();
    if !body.is_empty() {
        blocks.push(if ct.contains("story") || ct.contains("anecdote") {
            Block::Story { body }
        } else {
            Block::Text { body }
        });
    }
    if !e.steps.iter().all(|s| s.trim().is_empty()) || ct.contains("activity") {
        let steps: Vec<String> = e.steps.iter().map(|s| s.trim().to_string()).filter(|s| !s.is_empty()).collect();
        if !steps.is_empty() {
            blocks.push(Block::Activity { body: String::new(), steps });
        }
    }
    if !e.challenge.trim().is_empty() {
        blocks.push(Block::Challenge { body: e.challenge.trim().into() });
    }
    if is_quiz(e) && quiz_ok(&e.quiz) {
        blocks.push(Block::Quiz {
            question: e.quiz.question.trim().into(),
            choices: e.quiz.choices.iter().map(|c| strip_choice_label(c)).collect(),
            answer_index: e.quiz.answer_index as usize,
            explanation: Some(e.quiz.explanation.trim().to_string()).filter(|s| !s.is_empty()),
        });
    }
    if !e.fact.trim().is_empty() {
        blocks.push(Block::Fact { body: e.fact.trim().into() });
    }
    for r in &e.resources {
        let url = r.url.trim();
        if r.label.trim().is_empty() {
            continue;
        }
        // Only keep plain https links; anything else is dropped as untrusted.
        let url = Some(url.to_string()).filter(|u| u.starts_with("https://") && u.len() < 300 && !u.contains(' '));
        blocks.push(Block::Resource { label: r.label.trim().into(), url });
    }
    if !e.image_prompt.trim().is_empty() {
        blocks.push(Block::ImagePrompt { description: e.image_prompt.trim().into() });
    }
    blocks
}

// ---------------------------------------------------------------- pipeline

pub async fn generate_calendar(
    ai: &dyn AiProvider,
    model: &str,
    req: &GenerateRequest,
    progress: &dyn Progress,
) -> Result<Calendar, GenError> {
    req.validate().map_err(GenError::Invalid)?;
    let started = Instant::now();
    let tz_name = default_timezone();
    let today = Utc::now().with_timezone(&parse_tz(&tz_name)).date_naive();

    // 1. Understand
    progress.stage(Stage::Understanding, "Understanding your idea");
    let raw: Brief = ask(ai, model, brief_prompt(req, today), brief_schema(), 0.2, progress, "Brief").await?;
    let (brief, start, interval) = normalise_brief(raw, req, today);
    progress.brief(&brief);
    let n = brief.entry_count;

    // 2. Plan
    progress.stage(Stage::Planning, &format!("Planning {n} entries"));
    let schedule = Schedule { start_date: start, interval, timezone: tz_name, unlock_time: "00:00".into() };
    let dates: Vec<NaiveDate> = (0..n).map(|i| entry_date(&schedule, i)).collect();
    let plan: Plan =
        ask(ai, model, plan_prompt(&brief, &req.prompt, &dates), plan_schema(), 0.6, progress, "Plan").await?;
    let mut plan = normalise_plan(plan, n);
    fix_plan_duplicates(ai, model, &brief, &mut plan, progress).await;
    progress.plan(&plan);

    // 3. Write, batch by batch
    progress.stage(Stage::Writing, "Writing the entries");
    let mut written: BTreeMap<u32, GenEntry> = BTreeMap::new();
    progress.entries(0, n);
    let planned: Vec<&PlannedEntry> = plan.entries.iter().collect();
    for batch in planned.chunks(BATCH_SIZE) {
        write_batch(ai, model, &brief, &plan, batch, &mut written, progress).await?;
        progress.entries(written.len().min(n as usize) as u32, n);
    }

    // 4. Validate & repair
    progress.stage(Stage::Validating, "Checking and repairing");
    for round in 1..=REPAIR_ROUNDS {
        let issues = find_issues(&written, n);
        if issues.is_empty() {
            break;
        }
        progress.log(&format!("Repair round {round}: {} entries to rewrite", issues.len()));
        let todo: HashSet<u32> = issues.iter().map(Issue::index).collect();
        let redo: Vec<&PlannedEntry> = plan.entries.iter().filter(|e| todo.contains(&e.index)).collect();
        for batch in redo.chunks(BATCH_SIZE) {
            // A failed repair is not fatal: the entry is flagged instead.
            if let Err(e) = write_batch(ai, model, &brief, &plan, batch, &mut written, progress).await {
                progress.log(&format!("Repair failed: {e}"));
            }
        }
        progress.entries(n - find_issues(&written, n).len() as u32, n);
    }
    let warnings = find_warnings(&written, n);
    let remaining: HashSet<u32> = find_issues(&written, n).iter().map(Issue::index).collect();

    // 5. Build
    progress.stage(Stage::Saving, "Building your calendar");
    let entries = plan
        .entries
        .iter()
        .map(|p| {
            let g = written.get(&p.index);
            let mut metadata = serde_json::Map::new();
            metadata.insert("summary".into(), json!(p.summary));
            if remaining.contains(&p.index) {
                metadata.insert("needs_review".into(), json!(true));
            }
            Entry {
                id: Uuid::new_v4(),
                index: p.index,
                title: g.map(|g| g.title.trim()).filter(|t| !t.is_empty()).unwrap_or(&p.title).chars().take(140).collect(),
                date: entry_date(&schedule, p.index - 1),
                content_type: g.map(|g| g.content_type.trim()).filter(|t| !t.is_empty()).unwrap_or(&p.content_type).to_lowercase(),
                blocks: g.map(to_blocks).unwrap_or_default(),
                metadata,
                status: EntryStatus::Scheduled,
            }
        })
        .collect();
    let now = Utc::now();
    let cal = Calendar {
        id: Uuid::new_v4(),
        slug: slugify(&brief.title),
        title: brief.title.clone(),
        description: brief.description.trim().into(),
        prompt: req.prompt.trim().into(),
        language: brief.language.clone(),
        theme: brief.theme.clone(),
        schedule,
        status: CalendarStatus::Draft,
        entries,
        generation: Some(GenerationReport {
            provider: ai.name().into(),
            model: model.into(),
            duration_secs: started.elapsed().as_secs(),
            warnings,
            sections: plan.sections.iter().map(|s| json!(s)).collect(),
            audience: brief.audience.clone(),
            tone: brief.tone.clone(),
        }),
        created_at: now,
        updated_at: now,
    };
    Ok(cal)
}

/// Indexes whose planned title repeats an earlier one (or is a placeholder).
pub fn duplicate_plan_entries(plan: &Plan) -> Vec<u32> {
    let mut seen = HashSet::new();
    plan.entries
        .iter()
        .filter(|e| !seen.insert(norm_title(&e.title)) || e.title.starts_with("Entry "))
        .map(|e| e.index)
        .collect()
}

/// Small models sometimes loop and repeat the start of the plan: ask once for
/// fresh, distinct entries in place of the repeated ones. Never fatal.
async fn fix_plan_duplicates(ai: &dyn AiProvider, model: &str, brief: &Brief, plan: &mut Plan, progress: &dyn Progress) {
    let dups = duplicate_plan_entries(plan);
    if dups.is_empty() {
        return;
    }
    progress.log(&format!("Plan: replacing {} repeated entries", dups.len()));
    let outline: String = plan
        .entries
        .iter()
        .map(|e| {
            let mark = if dups.contains(&e.index) { "  <- REPLACE" } else { "" };
            format!("{}. {} ({}){mark}", e.index, e.title, e.content_type)
        })
        .collect::<Vec<_>>()
        .join("\n");
    let prompt = format!(
        "{}\n\nCURRENT OUTLINE:\n{outline}\n\nThe entries marked REPLACE repeat earlier ones or are empty. \
Propose new entries for exactly these indexes: {:?}. Each must be new, distinct from every other title, \
and fit the progression at its position (later entries are more advanced). Return them in \"entries\"; \
\"sections\" can be an empty list.",
        brief_context(brief),
        dups
    );
    match ask::<Plan>(ai, model, prompt, plan_schema(), 0.8, progress, "Plan repair").await {
        Ok(fix) => {
            for (pos, mut e) in fix.entries.into_iter().enumerate() {
                if !dups.contains(&e.index) {
                    match dups.get(pos) {
                        Some(i) => e.index = *i,
                        None => continue,
                    }
                }
                let taken = plan.entries.iter().any(|p| p.index != e.index && norm_title(&p.title) == norm_title(&e.title));
                if !taken && !e.title.trim().is_empty() {
                    if let Some(slot) = plan.entries.iter_mut().find(|p| p.index == e.index) {
                        *slot = e;
                    }
                }
            }
        }
        Err(e) => progress.log(&format!("Plan repair failed: {e}")),
    }
}

async fn write_batch(
    ai: &dyn AiProvider,
    model: &str,
    brief: &Brief,
    plan: &Plan,
    batch: &[&PlannedEntry],
    written: &mut BTreeMap<u32, GenEntry>,
    progress: &dyn Progress,
) -> Result<(), GenError> {
    #[derive(Deserialize)]
    struct Out {
        entries: Vec<GenEntry>,
    }
    let wanted: HashSet<u32> = batch.iter().map(|e| e.index).collect();
    let label = format!(
        "Entries {}-{}",
        batch.first().map(|e| e.index).unwrap_or(0),
        batch.last().map(|e| e.index).unwrap_or(0)
    );
    let out: Out = ask(ai, model, entries_prompt(brief, plan, batch), entries_schema(), 0.7, progress, &label).await?;
    // Models sometimes renumber: map answers back to the batch by position.
    for (pos, mut e) in out.entries.into_iter().enumerate() {
        if !wanted.contains(&e.index) {
            match batch.get(pos) {
                Some(p) => e.index = p.index,
                None => continue,
            }
        }
        let better = match written.get(&e.index) {
            Some(old) => e.body.split_whitespace().count() > old.body.split_whitespace().count(),
            None => true,
        };
        if better {
            written.insert(e.index, e);
        }
    }
    Ok(())
}

// ---------------------------------------------------------------- tests

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ai::ModelInfo;
    use std::sync::Mutex;

    struct NoProgress;
    impl Progress for NoProgress {
        fn stage(&self, _: Stage, _: &str) {}
        fn entries(&self, _: u32, _: u32) {}
        fn brief(&self, _: &Brief) {}
        fn plan(&self, _: &Plan) {}
        fn log(&self, _: &str) {}
    }

    /// Fake AI that answers by recognising which step is asked.
    struct FakeAi {
        count: u32,
        calls: Mutex<u32>,
        fail_first_entries: bool,
    }

    fn long_body(i: u32) -> String {
        format!("Entry {i} body. ") + &"This is meaningful generated content for the reader. ".repeat(3)
    }

    #[async_trait::async_trait]
    impl AiProvider for FakeAi {
        fn name(&self) -> &'static str {
            "fake"
        }
        fn endpoint(&self) -> String {
            "fake://".into()
        }
        async fn list_models(&self) -> Result<Vec<ModelInfo>, AiError> {
            Ok(vec![])
        }
        async fn generate_json(&self, req: &JsonRequest) -> Result<Value, AiError> {
            let mut calls = self.calls.lock().unwrap();
            *calls += 1;
            let props = &req.schema["properties"];
            if props.get("topic").is_some() {
                return Ok(json!({
                    "title": "Test", "description": "d", "topic": "t", "audience": "a", "objective": "o",
                    "language": "en", "tone": "fun", "entry_count": self.count, "interval": "daily",
                    "start_date": "", "content_formats": ["quiz","fact"], "difficulty": "easy",
                    "theme": "not-a-theme", "requirements": []
                }));
            }
            if props.get("sections").is_some() {
                // Deliberately incomplete plan: the engine must fill the gaps.
                let entries: Vec<Value> = (1..self.count)
                    .map(|i| json!({"index": i, "title": format!("Title {i}"), "content_type": if i % 2 == 0 {"quiz"} else {"fact"}, "summary": "s"}))
                    .collect();
                return Ok(json!({ "sections": [{"title":"All","from":1,"to":self.count,"focus":"f"}], "entries": entries }));
            }
            if self.fail_first_entries && *calls == 3 {
                return Err(AiError::Timeout);
            }
            // Writer: find requested indexes in the prompt.
            let idx: Vec<u32> = req
                .prompt
                .lines()
                .filter_map(|l| l.strip_prefix("- index "))
                .filter_map(|l| l.split(':').next()?.parse().ok())
                .collect();
            let entries: Vec<Value> = idx
                .iter()
                .map(|i| json!({
                    "index": i, "title": format!("Title {i}"), "content_type": if i % 2 == 0 {"quiz"} else {"fact"},
                    "body": long_body(*i), "fact": "", "challenge": "", "steps": [],
                    "quiz": if i % 2 == 0 {
                        json!({"question":"Q?","choices":["a","b","c"],"answer_index":1,"explanation":"because"})
                    } else {
                        json!({"question":"","choices":[],"answer_index":0,"explanation":""})
                    },
                    "resources": [{"label":"Bad link","url":"javascript:alert(1)"}], "image_prompt": "pic"
                }))
                .collect();
            Ok(json!({ "entries": entries }))
        }
    }

    #[tokio::test]
    async fn full_pipeline_builds_valid_calendar() {
        let ai = FakeAi { count: 10, calls: Mutex::new(0), fail_first_entries: true };
        let req = GenerateRequest { prompt: "A 10-day test calendar".into(), ..Default::default() };
        let cal = generate_calendar(&ai, "m", &req, &NoProgress).await.unwrap();
        assert_eq!(cal.entries.len(), 10);
        assert_eq!(cal.theme, "aurora", "unknown theme falls back");
        // Dates are consecutive and computed by the engine.
        for w in cal.entries.windows(2) {
            assert_eq!((w[1].date - w[0].date).num_days(), 1);
        }
        // The entry missing from the plan was still written.
        assert!(!cal.entries[9].blocks.is_empty());
        // Quizzes are typed, unsafe links are removed.
        assert!(cal.entries[1].blocks.iter().any(|b| matches!(b, Block::Quiz { answer_index: 1, .. })));
        assert!(cal.entries.iter().flat_map(|e| &e.blocks).all(|b| !matches!(b, Block::Resource { url: Some(_), .. })));
    }

    #[test]
    fn issues_detect_missing_empty_and_bad_quiz() {
        let mut m = BTreeMap::new();
        m.insert(1, GenEntry { index: 1, title: "a".into(), content_type: "fact".into(), body: long_body(1), ..Default::default() });
        m.insert(2, GenEntry { index: 2, title: "b".into(), content_type: "fact".into(), body: "too short".into(), ..Default::default() });
        m.insert(3, GenEntry {
            index: 3, title: "c".into(), content_type: "quiz".into(), body: long_body(3),
            quiz: GenQuiz { question: "Q".into(), choices: vec!["x".into()], answer_index: 4, explanation: "".into() },
            ..Default::default()
        });
        assert_eq!(find_issues(&m, 4), vec![Issue::EmptyBody(2), Issue::BadQuiz(3), Issue::Missing(4)]);
    }

    #[test]
    fn warnings_detect_duplicates() {
        let mut m = BTreeMap::new();
        for i in 1..=2 {
            m.insert(i, GenEntry { index: i, title: "Same Title!".into(), content_type: "fact".into(), body: long_body(0), ..Default::default() });
        }
        let w = find_warnings(&m, 2);
        assert!(w.iter().any(|x| x.contains("same title")));
        assert!(w.iter().any(|x| x.contains("very similar")));
    }

    #[test]
    fn choice_labels_are_stripped() {
        assert_eq!(strip_choice_label("A) UFC 1 (1993)"), "UFC 1 (1993)");
        assert_eq!(strip_choice_label("b. Paris"), "Paris");
        assert_eq!(strip_choice_label("1993"), "1993");
        assert_eq!(strip_choice_label("6"), "6");
    }

    #[test]
    fn plan_duplicates_are_found() {
        let e = |i: u32, t: &str| PlannedEntry { index: i, title: t.into(), content_type: "x".into(), summary: "".into() };
        let plan = Plan { sections: vec![], entries: vec![e(1, "Intro"), e(2, "Loops"), e(3, "intro!"), e(4, "Entry 4")] };
        assert_eq!(duplicate_plan_entries(&plan), vec![3, 4]);
    }

    #[test]
    fn request_validation() {
        assert!(GenerateRequest { prompt: "short".into(), ..Default::default() }.validate().is_err());
        assert!(GenerateRequest { prompt: "A long enough prompt".into(), entry_count: Some(500), ..Default::default() }.validate().is_err());
        assert!(GenerateRequest { prompt: "A long enough prompt".into(), ..Default::default() }.validate().is_ok());
    }
}
