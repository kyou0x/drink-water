use chrono::{Duration, NaiveDateTime, NaiveTime};

use crate::model::{parse_time, Settings};

/// Whether `t` falls inside the [start, end) window; supports windows crossing midnight.
pub fn in_window(t: NaiveTime, start: NaiveTime, end: NaiveTime) -> bool {
    if start < end {
        t >= start && t < end
    } else {
        t >= start || t < end
    }
}

/// Decides whether a reminder is due.
///
/// `last_activity` is the latest of: app start, last reminder sent, last intake today.
/// The countdown also restarts at the beginning of each active window, so the first
/// reminder of the morning comes one interval after the window opens.
pub fn should_remind(
    now: NaiveDateTime,
    settings: &Settings,
    today_total_ml: i64,
    last_activity: NaiveDateTime,
) -> bool {
    if !settings.reminders_enabled || today_total_ml >= settings.goal_ml {
        return false;
    }
    let (Ok(start), Ok(end)) = (parse_time(&settings.reminder_start), parse_time(&settings.reminder_end)) else {
        return false;
    };
    let t = now.time();
    if !in_window(t, start, end) {
        return false;
    }
    let window_start = if t >= start {
        now.date().and_time(start)
    } else {
        (now.date() - Duration::days(1)).and_time(start)
    };
    let reference = last_activity.max(window_start);
    now - reference >= Duration::minutes(settings.reminder_interval_min)
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::NaiveDate;

    fn dt(h: u32, m: u32) -> NaiveDateTime {
        NaiveDate::from_ymd_opt(2026, 11, 15)
            .unwrap()
            .and_hms_opt(h, m, 0)
            .unwrap()
    }

    fn on(interval: i64) -> Settings {
        Settings {
            reminders_enabled: true,
            reminder_interval_min: interval,
            ..Default::default()
        }
    }

    #[test]
    fn disabled_by_default() {
        assert!(!should_remind(dt(12, 0), &Settings::default(), 0, dt(8, 0)));
    }

    #[test]
    fn fires_after_interval() {
        let s = on(45);
        assert!(!should_remind(dt(10, 44), &s, 0, dt(10, 0)));
        assert!(should_remind(dt(10, 45), &s, 0, dt(10, 0)));
        for i in [30, 60] {
            assert!(should_remind(dt(11, 0) + Duration::minutes(i), &on(i), 0, dt(11, 0)));
        }
    }

    #[test]
    fn silent_once_goal_reached() {
        assert!(!should_remind(dt(12, 0), &on(30), 4500, dt(8, 0)));
        assert!(!should_remind(dt(12, 0), &on(30), 6000, dt(8, 0)));
    }

    #[test]
    fn respects_quiet_hours() {
        let s = on(30);
        assert!(!should_remind(dt(7, 0), &s, 0, dt(0, 0)));
        assert!(!should_remind(dt(23, 0), &s, 0, dt(12, 0)));
        // first reminder of the day comes one interval after the window opens
        assert!(!should_remind(dt(8, 10), &s, 0, dt(0, 0)));
        assert!(should_remind(dt(8, 30), &s, 0, dt(0, 0)));
    }

    #[test]
    fn supports_overnight_windows() {
        let s = Settings {
            reminder_start: "22:00".into(),
            reminder_end: "06:00".into(),
            ..on(60)
        };
        assert!(in_window(
            NaiveTime::from_hms_opt(2, 0, 0).unwrap(),
            parse_time("22:00").unwrap(),
            parse_time("06:00").unwrap()
        ));
        assert!(should_remind(dt(23, 0), &s, 0, dt(12, 0)));
        assert!(!should_remind(dt(12, 0), &s, 0, dt(8, 0)));
    }

    #[test]
    fn drinking_resets_the_countdown() {
        let s = on(60);
        assert!(!should_remind(dt(14, 30), &s, 1000, dt(14, 0)));
        assert!(should_remind(dt(15, 0), &s, 1000, dt(14, 0)));
    }
}
