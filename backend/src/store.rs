//! Local private storage: one JSON file per calendar under `data/`.
//! The `data/` folder is git-ignored, so drafts never reach public history.

use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use tokio::fs;
use uuid::Uuid;

use crate::models::{Calendar, CalendarSummary};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Settings {
    pub ollama_endpoint: String,
    pub model: Option<String>,
}

impl Default for Settings {
    fn default() -> Self {
        Settings { ollama_endpoint: "http://localhost:11434".into(), model: None }
    }
}

#[derive(Clone)]
pub struct Store {
    root: PathBuf,
}

impl Store {
    pub async fn open(root: impl AsRef<Path>) -> std::io::Result<Self> {
        let root = root.as_ref().to_path_buf();
        fs::create_dir_all(root.join("calendars")).await?;
        Ok(Store { root })
    }

    fn calendar_path(&self, id: Uuid) -> PathBuf {
        self.root.join("calendars").join(format!("{id}.json"))
    }

    pub async fn list(&self) -> std::io::Result<Vec<CalendarSummary>> {
        let mut out = vec![];
        let mut dir = fs::read_dir(self.root.join("calendars")).await?;
        while let Some(e) = dir.next_entry().await? {
            if e.path().extension().is_some_and(|x| x == "json") {
                if let Ok(bytes) = fs::read(e.path()).await {
                    if let Ok(c) = serde_json::from_slice::<Calendar>(&bytes) {
                        out.push(CalendarSummary::from(&c));
                    }
                }
            }
        }
        out.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
        Ok(out)
    }

    pub async fn get(&self, id: Uuid) -> std::io::Result<Option<Calendar>> {
        match fs::read(self.calendar_path(id)).await {
            Ok(b) => Ok(serde_json::from_slice(&b).ok()),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
            Err(e) => Err(e),
        }
    }

    pub async fn save(&self, c: &Calendar) -> std::io::Result<()> {
        let tmp = self.calendar_path(c.id).with_extension("json.tmp");
        fs::write(&tmp, serde_json::to_vec_pretty(c)?).await?;
        fs::rename(&tmp, self.calendar_path(c.id)).await
    }

    pub async fn delete(&self, id: Uuid) -> std::io::Result<bool> {
        match fs::remove_file(self.calendar_path(id)).await {
            Ok(()) => Ok(true),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(false),
            Err(e) => Err(e),
        }
    }

    pub async fn settings(&self) -> Settings {
        match fs::read(self.root.join("settings.json")).await {
            Ok(b) => serde_json::from_slice(&b).unwrap_or_default(),
            Err(_) => Settings::default(),
        }
    }

    pub async fn save_settings(&self, s: &Settings) -> std::io::Result<()> {
        fs::write(self.root.join("settings.json"), serde_json::to_vec_pretty(s)?).await
    }
}
