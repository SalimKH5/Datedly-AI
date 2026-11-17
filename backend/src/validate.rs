//! Server-side validation of calendars saved from the editor.
//! The browser is never trusted: everything is checked and normalised here.

use crate::generate::THEMES;
use crate::models::{slugify, Block, Calendar};

pub const MAX_ENTRIES: usize = 366;
const MAX_TITLE: usize = 140;
const MAX_TEXT: usize = 8_000;

fn clip(s: &str, max: usize) -> String {
    s.trim().chars().take(max).collect()
}

fn safe_url(u: &Option<String>) -> Option<String> {
    u.as_deref()
        .map(str::trim)
        .filter(|u| u.starts_with("https://") && u.len() < 500 && !u.contains(char::is_whitespace))
        .map(String::from)
}

/// Checks a calendar, fixes what can be fixed silently, rejects the rest.
pub fn sanitize_calendar(cal: &mut Calendar) -> Result<(), String> {
    cal.title = clip(&cal.title, MAX_TITLE);
    if cal.title.is_empty() {
        return Err("The calendar needs a title.".into());
    }
    cal.description = clip(&cal.description, 1_000);
    cal.slug = slugify(if cal.slug.trim().is_empty() {
        &cal.title
    } else {
        &cal.slug
    });
    if !THEMES.contains(&cal.theme.as_str()) {
        cal.theme = "aurora".into();
    }
    if cal.schedule.timezone.parse::<chrono_tz::Tz>().is_err() {
        return Err("Unknown time zone.".into());
    }
    if chrono::NaiveTime::parse_from_str(&cal.schedule.unlock_time, "%H:%M").is_err() {
        return Err("Unlock time must look like 08:30.".into());
    }
    if cal.entries.len() > MAX_ENTRIES {
        return Err(format!(
            "A calendar can have at most {MAX_ENTRIES} entries."
        ));
    }

    // Order is the editor's order; indexes are always 1..n.
    cal.entries.sort_by_key(|e| e.index);
    for (i, e) in cal.entries.iter_mut().enumerate() {
        e.index = i as u32 + 1;
        e.title = clip(&e.title, MAX_TITLE);
        if e.title.is_empty() {
            return Err(format!("Entry {} needs a title.", i + 1));
        }
        e.content_type = clip(&e.content_type.to_lowercase(), 40);
        if e.content_type.is_empty() {
            e.content_type = "text".into();
        }
        let mut blocks = Vec::with_capacity(e.blocks.len());
        for b in e.blocks.drain(..) {
            let b = match b {
                Block::Text { body } => Block::Text {
                    body: clip(&body, MAX_TEXT),
                },
                Block::Fact { body } => Block::Fact {
                    body: clip(&body, MAX_TEXT),
                },
                Block::Story { body } => Block::Story {
                    body: clip(&body, MAX_TEXT),
                },
                Block::Challenge { body } => Block::Challenge {
                    body: clip(&body, MAX_TEXT),
                },
                Block::Activity { body, steps } => Block::Activity {
                    body: clip(&body, MAX_TEXT),
                    steps: steps
                        .iter()
                        .map(|s| clip(s, 1_000))
                        .filter(|s| !s.is_empty())
                        .take(30)
                        .collect(),
                },
                Block::Quiz {
                    question,
                    choices,
                    answer_index,
                    explanation,
                } => {
                    let choices: Vec<String> = choices
                        .iter()
                        .map(|c| clip(c, 300))
                        .filter(|c| !c.is_empty())
                        .take(8)
                        .collect();
                    let question = clip(&question, 1_000);
                    if question.is_empty() || choices.len() < 2 {
                        return Err(format!(
                            "The quiz of entry {} needs a question and at least 2 answers.",
                            i + 1
                        ));
                    }
                    if answer_index >= choices.len() {
                        return Err(format!(
                            "The quiz of entry {} has no correct answer selected.",
                            i + 1
                        ));
                    }
                    Block::Quiz {
                        question,
                        choices,
                        answer_index,
                        explanation: explanation
                            .map(|x| clip(&x, 1_000))
                            .filter(|x| !x.is_empty()),
                    }
                }
                Block::Resource { label, url } => Block::Resource {
                    label: clip(&label, 200),
                    url: safe_url(&url),
                },
                Block::ImagePrompt { description } => Block::ImagePrompt {
                    description: clip(&description, 1_000),
                },
                Block::Custom { label, data } => Block::Custom {
                    label: clip(&label, 80),
                    data,
                },
            };
            // Drop blocks left empty in the editor.
            let empty = match &b {
                Block::Text { body }
                | Block::Fact { body }
                | Block::Story { body }
                | Block::Challenge { body } => body.is_empty(),
                Block::Activity { body, steps } => body.is_empty() && steps.is_empty(),
                Block::Resource { label, .. } => label.is_empty(),
                Block::ImagePrompt { description } => description.is_empty(),
                _ => false,
            };
            if !empty {
                blocks.push(b);
            }
        }
        e.blocks = blocks.into_iter().take(40).collect();
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::*;
    use chrono::{NaiveDate, Utc};
    use uuid::Uuid;

    fn entry(index: u32, blocks: Vec<Block>) -> Entry {
        Entry {
            id: Uuid::new_v4(),
            index,
            title: format!(" Title {index} "),
            date: NaiveDate::from_ymd_opt(2026, 12, index).unwrap(),
            content_type: "Quiz".into(),
            blocks,
            metadata: Default::default(),
            status: EntryStatus::Scheduled,
        }
    }

    fn cal(entries: Vec<Entry>) -> Calendar {
        Calendar {
            id: Uuid::new_v4(),
            slug: "".into(),
            title: "My calendar".into(),
            description: "".into(),
            prompt: "".into(),
            language: "en".into(),
            theme: "nope".into(),
            schedule: Schedule {
                start_date: NaiveDate::from_ymd_opt(2026, 12, 1).unwrap(),
                interval: Interval::Daily,
                timezone: "Europe/Paris".into(),
                unlock_time: "00:00".into(),
            },
            status: CalendarStatus::Draft,
            entries,
            generation: None,
            publication: None,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        }
    }

    #[test]
    fn renumbers_cleans_and_drops_unsafe_links() {
        let mut c = cal(vec![
            entry(
                7,
                vec![
                    Block::Text { body: "  ".into() },
                    Block::Resource {
                        label: "x".into(),
                        url: Some("javascript:alert(1)".into()),
                    },
                ],
            ),
            entry(3, vec![]),
        ]);
        sanitize_calendar(&mut c).unwrap();
        assert_eq!(
            c.entries.iter().map(|e| e.index).collect::<Vec<_>>(),
            vec![1, 2]
        );
        assert_eq!(c.entries[0].title, "Title 3");
        assert_eq!(
            c.entries[1].blocks,
            vec![Block::Resource {
                label: "x".into(),
                url: None
            }]
        );
        assert_eq!(c.theme, "aurora");
        assert_eq!(c.slug, "my-calendar");
        assert_eq!(c.entries[0].content_type, "quiz");
    }

    #[test]
    fn rejects_broken_quiz_and_empty_title() {
        let quiz = Block::Quiz {
            question: "Q?".into(),
            choices: vec!["a".into(), "b".into()],
            answer_index: 5,
            explanation: None,
        };
        let mut c = cal(vec![entry(1, vec![quiz])]);
        assert!(sanitize_calendar(&mut c).is_err());
        let mut c = cal(vec![]);
        c.title = "   ".into();
        assert!(sanitize_calendar(&mut c).is_err());
    }
}
