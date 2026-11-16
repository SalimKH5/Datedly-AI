//! Server-side date logic. The browser clock is never trusted.

use chrono::{DateTime, Duration, NaiveDate, NaiveTime, TimeZone, Utc};
use chrono_tz::Tz;

use crate::models::{Interval, Schedule};

/// Date of the n-th entry (0-based) for a schedule.
pub fn entry_date(schedule: &Schedule, n: u32) -> NaiveDate {
    let step = match schedule.interval {
        Interval::Daily => 1,
        Interval::Weekly => 7,
        Interval::EveryNDays { days } => days.max(1) as i64,
    };
    schedule.start_date + Duration::days(step * n as i64)
}

pub fn parse_tz(name: &str) -> Tz {
    name.parse().unwrap_or(chrono_tz::Europe::Paris)
}

/// The UTC instant at which an entry dated `date` unlocks.
pub fn unlock_instant(schedule: &Schedule, date: NaiveDate) -> DateTime<Utc> {
    let tz = parse_tz(&schedule.timezone);
    let time = NaiveTime::parse_from_str(&schedule.unlock_time, "%H:%M").unwrap_or(NaiveTime::MIN);
    let local = date.and_time(time);
    // On DST gaps take the earliest valid instant.
    tz.from_local_datetime(&local)
        .earliest()
        .unwrap_or_else(|| tz.from_utc_datetime(&local))
        .with_timezone(&Utc)
}

pub fn is_unlocked(schedule: &Schedule, date: NaiveDate, now: DateTime<Utc>) -> bool {
    now >= unlock_instant(schedule, date)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sched(interval: Interval) -> Schedule {
        Schedule {
            start_date: NaiveDate::from_ymd_opt(2026, 12, 1).unwrap(),
            interval,
            timezone: "Europe/Paris".into(),
            unlock_time: "00:00".into(),
        }
    }

    #[test]
    fn dates_follow_interval() {
        let d = sched(Interval::Daily);
        assert_eq!(entry_date(&d, 23), NaiveDate::from_ymd_opt(2026, 12, 24).unwrap());
        let w = sched(Interval::Weekly);
        assert_eq!(entry_date(&w, 2), NaiveDate::from_ymd_opt(2026, 12, 15).unwrap());
    }

    #[test]
    fn unlock_uses_paris_time_not_utc() {
        let s = sched(Interval::Daily);
        let day = NaiveDate::from_ymd_opt(2026, 12, 2).unwrap();
        // Midnight in Paris (UTC+1 in winter) is 23:00 UTC the previous day.
        let before = Utc.with_ymd_and_hms(2026, 12, 1, 22, 59, 0).unwrap();
        let after = Utc.with_ymd_and_hms(2026, 12, 1, 23, 0, 0).unwrap();
        assert!(!is_unlocked(&s, day, before));
        assert!(is_unlocked(&s, day, after));
    }
}
