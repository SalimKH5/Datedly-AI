//! Universal calendar data model.
//!
//! Nothing here is tied to a theme: a calendar is a list of entries, and each
//! entry is a list of typed content blocks. New content formats are added as
//! new block kinds (or carried by `Block::Custom`) without changing storage.

use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "snake_case")]
pub enum CalendarStatus {
    #[default]
    Draft,
    Published,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum Interval {
    Daily,
    Weekly,
    Monthly,
    /// Every `days` days.
    EveryNDays { days: u32 },
}

impl Default for Interval {
    fn default() -> Self {
        Interval::Daily
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct Schedule {
    pub start_date: NaiveDate,
    #[serde(default)]
    pub interval: Interval,
    /// IANA time zone, e.g. "Europe/Paris".
    #[serde(default = "default_timezone")]
    pub timezone: String,
    /// Local time at which an entry unlocks, "HH:MM".
    #[serde(default = "default_unlock_time")]
    pub unlock_time: String,
}

pub fn default_timezone() -> String {
    "Europe/Paris".into()
}
fn default_unlock_time() -> String {
    "00:00".into()
}

/// One piece of content inside an entry.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum Block {
    Text { body: String },
    Fact { body: String },
    Story { body: String },
    Challenge { body: String },
    Activity { body: String, #[serde(default)] steps: Vec<String> },
    Quiz {
        question: String,
        choices: Vec<String>,
        answer_index: usize,
        #[serde(default)]
        explanation: Option<String>,
    },
    Resource { label: String, url: Option<String> },
    ImagePrompt { description: String },
    /// Escape hatch for formats the AI invents for a specific idea.
    Custom { label: String, data: serde_json::Value },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
#[serde(rename_all = "snake_case")]
pub enum EntryStatus {
    #[default]
    Scheduled,
    Hidden,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Entry {
    pub id: Uuid,
    /// 1-based position in the calendar.
    pub index: u32,
    pub title: String,
    pub date: NaiveDate,
    /// Short label of the main format ("quiz", "challenge", ...).
    pub content_type: String,
    #[serde(default)]
    pub blocks: Vec<Block>,
    #[serde(default)]
    pub metadata: serde_json::Map<String, serde_json::Value>,
    #[serde(default)]
    pub status: EntryStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Calendar {
    pub id: Uuid,
    pub slug: String,
    pub title: String,
    #[serde(default)]
    pub description: String,
    /// The prompt the calendar was generated from.
    #[serde(default)]
    pub prompt: String,
    #[serde(default = "default_language")]
    pub language: String,
    #[serde(default = "default_theme")]
    pub theme: String,
    pub schedule: Schedule,
    #[serde(default)]
    pub status: CalendarStatus,
    #[serde(default)]
    pub entries: Vec<Entry>,
    /// How the calendar was produced (model, duration, validation notes).
    #[serde(default)]
    pub generation: Option<GenerationReport>,
    /// Set when the calendar is published.
    #[serde(default)]
    pub publication: Option<Publication>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Publication {
    pub published_at: DateTime<Utc>,
    /// Accelerated demonstration: one entry every `every_minutes` from `start`,
    /// instead of following the calendar dates.
    #[serde(default)]
    pub demo: Option<Demo>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Demo {
    pub start: DateTime<Utc>,
    pub every_minutes: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
pub struct GenerationReport {
    pub provider: String,
    pub model: String,
    pub duration_secs: u64,
    /// Non-blocking findings from validation (e.g. similar titles).
    #[serde(default)]
    pub warnings: Vec<String>,
    /// AI planning notes: sections of the progression.
    #[serde(default)]
    pub sections: Vec<serde_json::Value>,
    #[serde(default)]
    pub audience: String,
    #[serde(default)]
    pub tone: String,
}

fn default_language() -> String {
    "en".into()
}
fn default_theme() -> String {
    "aurora".into()
}

/// Lightweight view used for dashboard lists (no entry content).
#[derive(Debug, Clone, Serialize)]
pub struct CalendarSummary {
    pub id: Uuid,
    pub slug: String,
    pub title: String,
    pub description: String,
    pub status: CalendarStatus,
    pub entry_count: usize,
    pub start_date: NaiveDate,
    pub end_date: Option<NaiveDate>,
    pub theme: String,
    pub updated_at: DateTime<Utc>,
}

impl From<&Calendar> for CalendarSummary {
    fn from(c: &Calendar) -> Self {
        CalendarSummary {
            id: c.id,
            slug: c.slug.clone(),
            title: c.title.clone(),
            description: c.description.clone(),
            status: c.status,
            entry_count: c.entries.len(),
            start_date: c.schedule.start_date,
            end_date: c.entries.iter().map(|e| e.date).max(),
            theme: c.theme.clone(),
            updated_at: c.updated_at,
        }
    }
}

/// Payload to create a calendar by hand (AI generation comes in phase 2).
#[derive(Debug, Clone, Deserialize)]
pub struct NewCalendar {
    pub title: String,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub prompt: String,
    pub schedule: Schedule,
    #[serde(default)]
    pub entry_count: u32,
}

/// Turns a title into a URL-safe slug.
pub fn slugify(s: &str) -> String {
    let mut out = String::new();
    let mut dash = false;
    for ch in s.to_lowercase().chars() {
        if ch.is_ascii_alphanumeric() {
            out.push(ch);
            dash = false;
        } else if !dash && !out.is_empty() {
            out.push('-');
            dash = true;
        }
    }
    let trimmed = out.trim_end_matches('-').to_string();
    if trimmed.is_empty() {
        "calendar".into()
    } else {
        trimmed.chars().take(60).collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn slugify_works() {
        assert_eq!(slugify("24-Day MMA Advent!"), "24-day-mma-advent");
        assert_eq!(slugify("  ***  "), "calendar");
    }

    #[test]
    fn blocks_roundtrip_json() {
        let b = Block::Quiz {
            question: "How many branches does a snowflake have?".into(),
            choices: vec!["4".into(), "6".into(), "8".into()],
            answer_index: 1,
            explanation: None,
        };
        let s = serde_json::to_string(&b).unwrap();
        assert!(s.contains("\"type\":\"quiz\""));
        let back: Block = serde_json::from_str(&s).unwrap();
        assert_eq!(b, back);
    }
}
