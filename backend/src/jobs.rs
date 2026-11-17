//! In-memory registry of generation jobs, polled by the studio for progress.

use std::collections::HashMap;
use std::sync::{Arc, Mutex};

use chrono::{DateTime, Utc};
use serde::Serialize;
use uuid::Uuid;

use crate::generate::{Brief, Plan, Progress, Stage};

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum JobStatus {
    Running,
    Done,
    Failed,
}

#[derive(Debug, Clone, Serialize)]
pub struct Job {
    pub id: Uuid,
    pub status: JobStatus,
    pub stage: Stage,
    pub message: String,
    pub done: u32,
    pub total: u32,
    pub model: String,
    pub log: Vec<String>,
    pub brief: Option<Brief>,
    pub plan: Option<Plan>,
    pub calendar_id: Option<Uuid>,
    pub error: Option<String>,
    pub started_at: DateTime<Utc>,
}

#[derive(Clone, Default)]
pub struct Jobs(Arc<Mutex<HashMap<Uuid, Job>>>);

impl Jobs {
    /// Starts a job unless another one is running (one local GPU = one job).
    pub fn start(&self, model: &str) -> Result<Uuid, Uuid> {
        let mut map = self.0.lock().unwrap();
        if let Some(j) = map.values().find(|j| j.status == JobStatus::Running) {
            return Err(j.id);
        }
        // Keep memory bounded: forget finished jobs older than an hour.
        let cutoff = Utc::now() - chrono::Duration::hours(1);
        map.retain(|_, j| j.status == JobStatus::Running || j.started_at > cutoff);
        let id = Uuid::new_v4();
        map.insert(
            id,
            Job {
                id,
                status: JobStatus::Running,
                stage: Stage::Understanding,
                message: "Starting".into(),
                done: 0,
                total: 0,
                model: model.into(),
                log: vec![],
                brief: None,
                plan: None,
                calendar_id: None,
                error: None,
                started_at: Utc::now(),
            },
        );
        Ok(id)
    }

    pub fn get(&self, id: Uuid) -> Option<Job> {
        self.0.lock().unwrap().get(&id).cloned()
    }

    pub fn running(&self) -> Option<Job> {
        self.0
            .lock()
            .unwrap()
            .values()
            .find(|j| j.status == JobStatus::Running)
            .cloned()
    }

    pub fn update(&self, id: Uuid, f: impl FnOnce(&mut Job)) {
        if let Some(j) = self.0.lock().unwrap().get_mut(&id) {
            f(j);
        }
    }

    pub fn handle(&self, id: Uuid) -> JobHandle {
        JobHandle {
            jobs: self.clone(),
            id,
        }
    }
}

pub struct JobHandle {
    jobs: Jobs,
    id: Uuid,
}

impl Progress for JobHandle {
    fn stage(&self, stage: Stage, message: &str) {
        let m = message.to_string();
        self.jobs.update(self.id, |j| {
            j.stage = stage;
            j.log.push(m.clone());
            j.message = m;
        });
    }
    fn entries(&self, done: u32, total: u32) {
        self.jobs.update(self.id, |j| {
            j.done = done;
            j.total = total;
        });
    }
    fn brief(&self, brief: &Brief) {
        let b = brief.clone();
        self.jobs.update(self.id, |j| {
            j.total = b.entry_count;
            j.brief = Some(b);
        });
    }
    fn plan(&self, plan: &Plan) {
        let p = plan.clone();
        self.jobs.update(self.id, |j| j.plan = Some(p));
    }
    fn log(&self, message: &str) {
        let m = message.to_string();
        self.jobs.update(self.id, |j| {
            if j.log.len() < 200 {
                j.log.push(m);
            }
        });
    }
}
