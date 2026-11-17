//! `datedly-publish`: run by the scheduled GitHub Action.
//!
//! Reads every encrypted bundle in `--input`, decrypts only the entries whose
//! unlock time has passed (server clock, never the visitor's), and writes the
//! public JSON consumed by the static site into `--out`:
//!   index.json        list of published calendars
//!   <slug>.json       one public calendar (locked entries: number + time only)
//!   state.txt         fingerprint of what is unlocked (lets the job skip deploys)
//!
//! Usage: datedly-publish --input published --out frontend/public/data [--now 2026-12-01T23:00:00Z]

use std::path::PathBuf;
use std::process::ExitCode;

use chrono::{DateTime, Utc};
use datedly::publish::{public_from_bundle, state_fingerprint, Bundle, MasterKey, PublicCalendar};
use serde_json::json;

fn arg(name: &str) -> Option<String> {
    let args: Vec<String> = std::env::args().collect();
    args.iter()
        .position(|a| a == name)
        .and_then(|i| args.get(i + 1).cloned())
}

fn main() -> ExitCode {
    match run() {
        Ok(msg) => {
            println!("{msg}");
            ExitCode::SUCCESS
        }
        Err(e) => {
            eprintln!("datedly-publish: {e}");
            ExitCode::FAILURE
        }
    }
}

fn run() -> Result<String, Box<dyn std::error::Error>> {
    let input = PathBuf::from(arg("--input").unwrap_or_else(|| "published".into()));
    let out = PathBuf::from(arg("--out").unwrap_or_else(|| "frontend/public/data".into()));
    let now: DateTime<Utc> = match arg("--now") {
        Some(s) => s.parse()?,
        None => Utc::now(),
    };

    let mut bundles: Vec<Bundle> = vec![];
    if input.is_dir() {
        let mut paths: Vec<PathBuf> = std::fs::read_dir(&input)?
            .filter_map(|e| e.ok().map(|e| e.path()))
            .filter(|p| p.to_string_lossy().ends_with(".enc.json"))
            .collect();
        paths.sort();
        for p in paths {
            let b: Bundle = serde_json::from_slice(&std::fs::read(&p)?)
                .map_err(|e| format!("{}: {e}", p.display()))?;
            bundles.push(b);
        }
    }

    std::fs::create_dir_all(&out)?;
    let mut views: Vec<PublicCalendar> = vec![];
    if !bundles.is_empty() {
        // The key is only needed when there is something to decrypt.
        let key = MasterKey::from_env()?;
        for b in &bundles {
            views.push(public_from_bundle(b, &key, now)?);
        }
    }

    for v in &views {
        std::fs::write(out.join(format!("{}.json", v.slug)), serde_json::to_vec(v)?)?;
    }
    let index: Vec<_> = views
        .iter()
        .map(|v| {
            json!({
                "slug": v.slug, "title": v.title, "description": v.description, "theme": v.theme,
                "language": v.language, "entry_count": v.entry_count, "unlocked_count": v.unlocked_count,
                "next_unlock_at": v.next_unlock_at, "demo": v.demo,
            })
        })
        .collect();
    std::fs::write(
        out.join("index.json"),
        serde_json::to_vec(&json!({ "generated_at": now, "calendars": index }))?,
    )?;
    std::fs::write(out.join("state.txt"), state_fingerprint(&views))?;

    // Counts only: content never goes to the logs.
    let summary: Vec<String> = views
        .iter()
        .map(|v| format!("{} {}/{}", v.slug, v.unlocked_count, v.entry_count))
        .collect();
    Ok(format!(
        "Published {} calendar(s) at {now}: {}",
        views.len(),
        summary.join(", ")
    ))
}
