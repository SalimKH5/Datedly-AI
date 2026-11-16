//! Publication: encrypted bundles, server-side unlocking, public views.
//!
//! How content stays secret until its date:
//! 1. The studio encrypts every entry with its own key and writes a *bundle*
//!    (`published/<slug>.enc.json`). Bundles can be committed to a public repo:
//!    without the master key they are unreadable.
//! 2. Each entry key is derived from one master key (HKDF-SHA256). The master
//!    key lives only in `data/master.key` (git-ignored) or the
//!    `DATEDLY_MASTER_KEY` environment variable / GitHub secret.
//! 3. A scheduled job (`datedly-publish`) decides with the server clock which
//!    entries are unlocked, decrypts only those, and writes the public JSON.
//!    Locked entries are never written in clear: no title, no content.

use std::path::{Path, PathBuf};

use aes_gcm::{
    aead::{Aead, KeyInit, Payload},
    Aes256Gcm, Nonce,
};
use base64::{engine::general_purpose::STANDARD as B64, Engine};
use chrono::{DateTime, Duration, NaiveDate, Utc};
use hkdf::Hkdf;
use rand::RngCore;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use uuid::Uuid;

use crate::models::{Block, Calendar, Publication};
use crate::schedule::unlock_instant;

pub const MASTER_KEY_ENV: &str = "DATEDLY_MASTER_KEY";

#[derive(Debug, thiserror::Error)]
pub enum PublishError {
    #[error("No master key: set {MASTER_KEY_ENV} (base64, 32 bytes)")]
    MissingKey,
    #[error("The master key is invalid: it must be 32 bytes encoded in base64")]
    BadKey,
    #[error("Cannot decrypt entry {0}: the master key does not match the one used to publish")]
    Decrypt(u32),
    #[error("{0}")]
    Io(#[from] std::io::Error),
    #[error("{0}")]
    Json(#[from] serde_json::Error),
}

// ---------------------------------------------------------------- master key

pub struct MasterKey([u8; 32]);

impl MasterKey {
    pub fn from_base64(s: &str) -> Result<Self, PublishError> {
        let bytes = B64.decode(s.trim()).map_err(|_| PublishError::BadKey)?;
        let arr: [u8; 32] = bytes.try_into().map_err(|_| PublishError::BadKey)?;
        Ok(MasterKey(arr))
    }

    pub fn generate() -> Self {
        let mut k = [0u8; 32];
        rand::rngs::OsRng.fill_bytes(&mut k);
        MasterKey(k)
    }

    pub fn to_base64(&self) -> String {
        B64.encode(self.0)
    }

    /// Env variable first, then the local key file.
    pub fn from_env() -> Result<Self, PublishError> {
        match std::env::var(MASTER_KEY_ENV) {
            Ok(v) if !v.trim().is_empty() => Self::from_base64(&v),
            _ => Err(PublishError::MissingKey),
        }
    }

    /// Studio side: env variable, else `<data>/master.key`, created on first use.
    pub fn load_or_create(data_dir: &Path) -> Result<(Self, KeySource), PublishError> {
        if let Ok(k) = Self::from_env() {
            return Ok((k, KeySource::Env));
        }
        let path = data_dir.join("master.key");
        match std::fs::read_to_string(&path) {
            Ok(s) => Ok((Self::from_base64(&s)?, KeySource::File(path))),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
                let k = Self::generate();
                std::fs::create_dir_all(data_dir)?;
                std::fs::write(&path, k.to_base64())?;
                Ok((k, KeySource::Created(path)))
            }
            Err(e) => Err(e.into()),
        }
    }

    fn entry_cipher(&self, calendar_id: Uuid, index: u32) -> Aes256Gcm {
        let hk = Hkdf::<Sha256>::new(Some(b"datedly-v1"), &self.0);
        let mut okm = [0u8; 32];
        let info = format!("entry:{calendar_id}:{index}");
        hk.expand(info.as_bytes(), &mut okm).expect("32 bytes is a valid HKDF length");
        Aes256Gcm::new_from_slice(&okm).expect("32-byte key")
    }
}

#[derive(Debug, Clone)]
pub enum KeySource {
    Env,
    File(PathBuf),
    Created(PathBuf),
}

// ---------------------------------------------------------------- bundle

/// What gets committed: public metadata + one ciphertext per entry.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Bundle {
    pub version: u32,
    pub calendar_id: Uuid,
    pub slug: String,
    pub title: String,
    pub description: String,
    pub theme: String,
    pub language: String,
    pub timezone: String,
    pub demo: bool,
    pub published_at: DateTime<Utc>,
    pub entries: Vec<SealedEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SealedEntry {
    pub index: u32,
    pub date: NaiveDate,
    pub unlock_at: DateTime<Utc>,
    pub nonce: String,
    pub ciphertext: String,
}

/// The secret part of an entry.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct EntryContent {
    pub title: String,
    pub content_type: String,
    pub blocks: Vec<Block>,
}

fn aad(calendar_id: Uuid, index: u32) -> Vec<u8> {
    format!("{calendar_id}:{index}").into_bytes()
}

/// UTC unlock instant of every entry, in order.
pub fn unlock_times(cal: &Calendar) -> Vec<DateTime<Utc>> {
    let demo = cal.publication.as_ref().and_then(|p| p.demo.as_ref());
    cal.entries
        .iter()
        .enumerate()
        .map(|(i, e)| match demo {
            Some(d) => d.start + Duration::minutes(d.every_minutes.max(1) as i64 * i as i64),
            None => unlock_instant(&cal.schedule, e.date),
        })
        .collect()
}

pub fn seal(cal: &Calendar, key: &MasterKey) -> Result<Bundle, PublishError> {
    let times = unlock_times(cal);
    let mut entries = Vec::with_capacity(cal.entries.len());
    for (e, unlock_at) in cal.entries.iter().zip(times) {
        let content = EntryContent { title: e.title.clone(), content_type: e.content_type.clone(), blocks: e.blocks.clone() };
        let plain = serde_json::to_vec(&content)?;
        let mut nonce = [0u8; 12];
        rand::rngs::OsRng.fill_bytes(&mut nonce);
        let ct = key
            .entry_cipher(cal.id, e.index)
            .encrypt(Nonce::from_slice(&nonce), Payload { msg: &plain, aad: &aad(cal.id, e.index) })
            .expect("AES-GCM encryption cannot fail with a valid key");
        entries.push(SealedEntry { index: e.index, date: e.date, unlock_at, nonce: B64.encode(nonce), ciphertext: B64.encode(ct) });
    }
    let publication = cal.publication.clone().unwrap_or(Publication { published_at: Utc::now(), demo: None });
    Ok(Bundle {
        version: 1,
        calendar_id: cal.id,
        slug: cal.slug.clone(),
        title: cal.title.clone(),
        description: cal.description.clone(),
        theme: cal.theme.clone(),
        language: cal.language.clone(),
        timezone: cal.schedule.timezone.clone(),
        demo: publication.demo.is_some(),
        published_at: publication.published_at,
        entries,
    })
}

pub fn open_entry(bundle: &Bundle, sealed: &SealedEntry, key: &MasterKey) -> Result<EntryContent, PublishError> {
    let err = || PublishError::Decrypt(sealed.index);
    let nonce = B64.decode(&sealed.nonce).map_err(|_| err())?;
    let ct = B64.decode(&sealed.ciphertext).map_err(|_| err())?;
    if nonce.len() != 12 {
        return Err(err());
    }
    let plain = key
        .entry_cipher(bundle.calendar_id, sealed.index)
        .decrypt(Nonce::from_slice(&nonce), Payload { msg: &ct, aad: &aad(bundle.calendar_id, sealed.index) })
        .map_err(|_| err())?;
    Ok(serde_json::from_slice(&plain)?)
}

// ---------------------------------------------------------------- public view

/// What visitors receive. Locked entries carry only their number and time.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PublicCalendar {
    pub slug: String,
    pub title: String,
    pub description: String,
    pub theme: String,
    pub language: String,
    pub timezone: String,
    pub demo: bool,
    pub generated_at: DateTime<Utc>,
    pub entry_count: usize,
    pub unlocked_count: usize,
    pub next_unlock_at: Option<DateTime<Utc>>,
    pub entries: Vec<PublicEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PublicEntry {
    pub index: u32,
    pub date: NaiveDate,
    pub unlock_at: DateTime<Utc>,
    pub unlocked: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub content: Option<EntryContent>,
}

/// Builds the public view from a bundle: only entries whose time has come are decrypted.
pub fn public_from_bundle(bundle: &Bundle, key: &MasterKey, now: DateTime<Utc>) -> Result<PublicCalendar, PublishError> {
    let mut entries = Vec::with_capacity(bundle.entries.len());
    for s in &bundle.entries {
        let unlocked = now >= s.unlock_at;
        let content = if unlocked { Some(open_entry(bundle, s, key)?) } else { None };
        entries.push(PublicEntry { index: s.index, date: s.date, unlock_at: s.unlock_at, unlocked, content });
    }
    Ok(finish(
        bundle.slug.clone(),
        bundle.title.clone(),
        bundle.description.clone(),
        bundle.theme.clone(),
        bundle.language.clone(),
        bundle.timezone.clone(),
        bundle.demo,
        now,
        entries,
    ))
}

/// Same view computed straight from a calendar (local studio preview).
pub fn public_from_calendar(cal: &Calendar, now: DateTime<Utc>) -> PublicCalendar {
    let entries = cal
        .entries
        .iter()
        .zip(unlock_times(cal))
        .map(|(e, unlock_at)| {
            let unlocked = now >= unlock_at;
            PublicEntry {
                index: e.index,
                date: e.date,
                unlock_at,
                unlocked,
                content: unlocked.then(|| EntryContent { title: e.title.clone(), content_type: e.content_type.clone(), blocks: e.blocks.clone() }),
            }
        })
        .collect();
    finish(
        cal.slug.clone(),
        cal.title.clone(),
        cal.description.clone(),
        cal.theme.clone(),
        cal.language.clone(),
        cal.schedule.timezone.clone(),
        cal.publication.as_ref().is_some_and(|p| p.demo.is_some()),
        now,
        entries,
    )
}

#[allow(clippy::too_many_arguments)]
fn finish(
    slug: String,
    title: String,
    description: String,
    theme: String,
    language: String,
    timezone: String,
    demo: bool,
    now: DateTime<Utc>,
    mut entries: Vec<PublicEntry>,
) -> PublicCalendar {
    entries.sort_by_key(|e| e.index);
    let unlocked_count = entries.iter().filter(|e| e.unlocked).count();
    let next_unlock_at = entries.iter().filter(|e| !e.unlocked).map(|e| e.unlock_at).min();
    PublicCalendar {
        slug,
        title,
        description,
        theme,
        language,
        timezone,
        demo,
        generated_at: now,
        entry_count: entries.len(),
        unlocked_count,
        next_unlock_at,
        entries,
    }
}

/// Fingerprint of what is unlocked: the deploy job skips work when it is unchanged.
pub fn state_fingerprint(views: &[PublicCalendar]) -> String {
    let mut h = Sha256::new();
    for v in views {
        h.update(v.slug.as_bytes());
        h.update(v.title.as_bytes());
        for e in v.entries.iter().filter(|e| e.unlocked) {
            h.update(e.index.to_le_bytes());
            if let Some(c) = &e.content {
                h.update(serde_json::to_vec(c).unwrap_or_default());
            }
        }
        h.update(b"|");
    }
    format!("{:x}", h.finalize())
}

pub fn bundle_path(dir: &Path, slug: &str) -> PathBuf {
    dir.join(format!("{slug}.enc.json"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::*;
    use chrono::TimeZone;

    fn cal(demo: Option<Demo>) -> Calendar {
        let entries = (1..=3)
            .map(|i| Entry {
                id: Uuid::new_v4(),
                index: i,
                title: format!("Secret {i}"),
                date: NaiveDate::from_ymd_opt(2026, 12, i).unwrap(),
                content_type: "fact".into(),
                blocks: vec![Block::Text { body: format!("Surprise number {i}") }],
                metadata: Default::default(),
                status: EntryStatus::Scheduled,
            })
            .collect();
        Calendar {
            id: Uuid::new_v4(),
            slug: "test".into(),
            title: "Test".into(),
            description: "".into(),
            prompt: "".into(),
            language: "fr".into(),
            theme: "arcade".into(),
            schedule: Schedule {
                start_date: NaiveDate::from_ymd_opt(2026, 12, 1).unwrap(),
                interval: Interval::Daily,
                timezone: "Europe/Paris".into(),
                unlock_time: "00:00".into(),
            },
            status: CalendarStatus::Published,
            entries,
            generation: None,
            publication: Some(Publication { published_at: Utc::now(), demo }),
            created_at: Utc::now(),
            updated_at: Utc::now(),
        }
    }

    #[test]
    fn bundle_hides_everything_and_unlocks_by_date() {
        let key = MasterKey::generate();
        let c = cal(None);
        let bundle = seal(&c, &key).unwrap();
        let raw = serde_json::to_string(&bundle).unwrap();
        assert!(!raw.contains("Secret") && !raw.contains("Surprise"), "no clear text in the bundle");

        // Dec 2, 00:30 in Paris: entries 1 and 2 are open, 3 is not.
        let now = Utc.with_ymd_and_hms(2026, 12, 1, 23, 30, 0).unwrap();
        let view = public_from_bundle(&bundle, &key, now).unwrap();
        assert_eq!(view.unlocked_count, 2);
        assert_eq!(view.entries[1].content.as_ref().unwrap().title, "Secret 2");
        assert!(view.entries[2].content.is_none());
        let public_json = serde_json::to_string(&view).unwrap();
        assert!(!public_json.contains("Secret 3") && !public_json.contains("Surprise number 3"));
        // Next unlock: Dec 3 midnight Paris = Dec 2 23:00 UTC.
        assert_eq!(view.next_unlock_at, Some(Utc.with_ymd_and_hms(2026, 12, 2, 23, 0, 0).unwrap()));
    }

    #[test]
    fn wrong_key_is_refused() {
        let bundle = seal(&cal(None), &MasterKey::generate()).unwrap();
        let now = Utc.with_ymd_and_hms(2027, 1, 1, 0, 0, 0).unwrap();
        assert!(matches!(public_from_bundle(&bundle, &MasterKey::generate(), now), Err(PublishError::Decrypt(1))));
    }

    #[test]
    fn tampered_ciphertext_is_refused() {
        let key = MasterKey::generate();
        let mut bundle = seal(&cal(None), &key).unwrap();
        // Moving entry 3's ciphertext into slot 1 must fail (bound to its index).
        bundle.entries[0].ciphertext = bundle.entries[2].ciphertext.clone();
        bundle.entries[0].nonce = bundle.entries[2].nonce.clone();
        assert!(open_entry(&bundle, &bundle.entries[0], &key).is_err());
    }

    #[test]
    fn demo_mode_unlocks_every_n_minutes() {
        let start = Utc.with_ymd_and_hms(2026, 11, 16, 20, 0, 0).unwrap();
        let c = cal(Some(Demo { start, every_minutes: 5 }));
        let view = public_from_calendar(&c, start + Duration::minutes(6));
        assert_eq!(view.unlocked_count, 2);
        assert!(view.demo);
        assert_eq!(view.next_unlock_at, Some(start + Duration::minutes(10)));
    }

    #[test]
    fn key_roundtrip_and_validation() {
        let k = MasterKey::generate();
        assert!(MasterKey::from_base64(&k.to_base64()).is_ok());
        assert!(MasterKey::from_base64("too-short").is_err());
    }
}
