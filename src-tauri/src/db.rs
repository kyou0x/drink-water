use std::path::Path;

use chrono::{DateTime, Local, NaiveDate, NaiveTime, TimeZone};
use rusqlite::{params, Connection, OptionalExtension};

use crate::model::{parse_day, validate_amount, DailyTotal, Entry, Settings};

pub struct Db {
    conn: Connection,
}

fn db_err(e: rusqlite::Error) -> String {
    format!("Erro no banco de dados: {e}")
}

const MIGRATIONS: &[&str] = &[
    // v1
    "CREATE TABLE entries (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        amount_ml  INTEGER NOT NULL CHECK (amount_ml > 0 AND amount_ml <= 5000),
        ts         INTEGER NOT NULL,
        day        TEXT    NOT NULL CHECK (length(day) = 10)
     );
     CREATE INDEX idx_entries_day ON entries(day, ts);
     CREATE TABLE settings (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL
     );",
];

impl Db {
    pub fn open(path: &Path) -> Result<Self, String> {
        let conn = Connection::open(path).map_err(db_err)?;
        Self::init(conn)
    }

    #[cfg(test)]
    pub fn open_in_memory() -> Result<Self, String> {
        Self::init(Connection::open_in_memory().map_err(db_err)?)
    }

    fn init(conn: Connection) -> Result<Self, String> {
        // WAL + FULL sync: every committed write survives crashes and power loss.
        conn.execute_batch(
            "PRAGMA journal_mode = WAL;
             PRAGMA synchronous = FULL;
             PRAGMA foreign_keys = ON;
             PRAGMA busy_timeout = 3000;",
        )
        .map_err(db_err)?;
        let mut db = Self { conn };
        db.migrate()?;
        Ok(db)
    }

    fn migrate(&mut self) -> Result<(), String> {
        let version: usize = self
            .conn
            .query_row("PRAGMA user_version", [], |r| r.get::<_, i64>(0))
            .map_err(db_err)? as usize;
        for (i, sql) in MIGRATIONS.iter().enumerate().skip(version) {
            let tx = self.conn.transaction().map_err(db_err)?;
            tx.execute_batch(sql).map_err(db_err)?;
            tx.pragma_update(None, "user_version", (i + 1) as i64).map_err(db_err)?;
            tx.commit().map_err(db_err)?;
        }
        Ok(())
    }

    pub fn add_entry(&self, amount_ml: i64, at: DateTime<Local>) -> Result<Entry, String> {
        let amount_ml = validate_amount(amount_ml)?;
        let ts = at.timestamp_millis();
        let day = at.date_naive().format("%Y-%m-%d").to_string();
        self.conn
            .execute(
                "INSERT INTO entries (amount_ml, ts, day) VALUES (?1, ?2, ?3)",
                params![amount_ml, ts, day],
            )
            .map_err(db_err)?;
        Ok(Entry {
            id: self.conn.last_insert_rowid(),
            amount_ml,
            ts,
            day,
        })
    }

    pub fn get_entry(&self, id: i64) -> Result<Option<Entry>, String> {
        self.conn
            .query_row(
                "SELECT id, amount_ml, ts, day FROM entries WHERE id = ?1",
                [id],
                row_to_entry,
            )
            .optional()
            .map_err(db_err)
    }

    /// Changes amount and time-of-day; the entry stays on its original local day.
    pub fn update_entry(
        &self,
        id: i64,
        amount_ml: i64,
        time: NaiveTime,
        now: DateTime<Local>,
    ) -> Result<Entry, String> {
        let amount_ml = validate_amount(amount_ml)?;
        let entry = self.get_entry(id)?.ok_or("Registro não encontrado.")?;
        let date: NaiveDate = parse_day(&entry.day)?;
        let local = Local
            .from_local_datetime(&date.and_time(time))
            .earliest()
            .ok_or("Horário inexistente neste dia (horário de verão).")?;
        if local > now {
            return Err("O horário não pode estar no futuro.".into());
        }
        let ts = local.timestamp_millis();
        self.conn
            .execute(
                "UPDATE entries SET amount_ml = ?1, ts = ?2 WHERE id = ?3",
                params![amount_ml, ts, id],
            )
            .map_err(db_err)?;
        Ok(Entry { amount_ml, ts, ..entry })
    }

    pub fn delete_entry(&self, id: i64) -> Result<(), String> {
        let n = self
            .conn
            .execute("DELETE FROM entries WHERE id = ?1", [id])
            .map_err(db_err)?;
        if n == 0 {
            return Err("Registro não encontrado.".into());
        }
        Ok(())
    }

    pub fn list_entries(&self, day: &str) -> Result<Vec<Entry>, String> {
        parse_day(day)?;
        let mut stmt = self
            .conn
            .prepare_cached("SELECT id, amount_ml, ts, day FROM entries WHERE day = ?1 ORDER BY ts, id")
            .map_err(db_err)?;
        let rows = stmt.query_map([day], row_to_entry).map_err(db_err)?;
        rows.collect::<Result<_, _>>().map_err(db_err)
    }

    pub fn daily_totals(&self, from: &str, to: &str) -> Result<Vec<DailyTotal>, String> {
        parse_day(from)?;
        parse_day(to)?;
        let mut stmt = self
            .conn
            .prepare_cached(
                "SELECT day, SUM(amount_ml) FROM entries WHERE day BETWEEN ?1 AND ?2 GROUP BY day ORDER BY day",
            )
            .map_err(db_err)?;
        let rows = stmt
            .query_map([from, to], |r| {
                Ok(DailyTotal {
                    day: r.get(0)?,
                    total_ml: r.get(1)?,
                })
            })
            .map_err(db_err)?;
        rows.collect::<Result<_, _>>().map_err(db_err)
    }

    pub fn day_total(&self, day: &str) -> Result<i64, String> {
        self.conn
            .query_row(
                "SELECT COALESCE(SUM(amount_ml), 0) FROM entries WHERE day = ?1",
                [day],
                |r| r.get(0),
            )
            .map_err(db_err)
    }

    pub fn last_entry_ts(&self, day: &str) -> Result<Option<i64>, String> {
        self.conn
            .query_row("SELECT MAX(ts) FROM entries WHERE day = ?1", [day], |r| r.get(0))
            .map_err(db_err)
    }

    pub fn get_settings(&self) -> Result<Settings, String> {
        let raw: Option<String> = self
            .conn
            .query_row("SELECT value FROM settings WHERE key = 'settings'", [], |r| r.get(0))
            .optional()
            .map_err(db_err)?;
        // Corrupt or invalid stored settings fall back to defaults instead of breaking the app.
        Ok(raw
            .and_then(|s| serde_json::from_str::<Settings>(&s).ok())
            .filter(|s| s.validate().is_ok())
            .unwrap_or_default())
    }

    pub fn save_settings(&self, settings: &Settings) -> Result<(), String> {
        settings.validate()?;
        let json = serde_json::to_string(settings).map_err(|e| e.to_string())?;
        self.conn
            .execute(
                "INSERT INTO settings (key, value) VALUES ('settings', ?1)
                 ON CONFLICT(key) DO UPDATE SET value = excluded.value",
                [json],
            )
            .map_err(db_err)?;
        Ok(())
    }
}

fn row_to_entry(r: &rusqlite::Row<'_>) -> rusqlite::Result<Entry> {
    Ok(Entry {
        id: r.get(0)?,
        amount_ml: r.get(1)?,
        ts: r.get(2)?,
        day: r.get(3)?,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn at(y: i32, m: u32, d: u32, h: u32, min: u32) -> DateTime<Local> {
        Local.with_ymd_and_hms(y, m, d, h, min, 0).earliest().unwrap()
    }

    fn t(h: u32, m: u32) -> NaiveTime {
        NaiveTime::from_hms_opt(h, m, 0).unwrap()
    }

    #[test]
    fn adds_and_totals_by_local_day() {
        let db = Db::open_in_memory().unwrap();
        db.add_entry(500, at(2026, 11, 15, 8, 0)).unwrap();
        db.add_entry(250, at(2026, 11, 15, 9, 0)).unwrap();
        db.add_entry(420, at(2026, 11, 15, 23, 59)).unwrap();
        db.add_entry(300, at(2026, 11, 16, 0, 1)).unwrap();
        assert_eq!(db.day_total("2026-11-15").unwrap(), 1170);
        assert_eq!(db.day_total("2026-11-16").unwrap(), 300);
        assert_eq!(db.list_entries("2026-11-15").unwrap().len(), 3);
        let totals = db.daily_totals("2026-11-01", "2026-11-30").unwrap();
        assert_eq!(
            totals,
            vec![
                DailyTotal {
                    day: "2026-11-15".into(),
                    total_ml: 1170
                },
                DailyTotal {
                    day: "2026-11-16".into(),
                    total_ml: 300
                },
            ]
        );
    }

    #[test]
    fn rejects_invalid_amounts() {
        let db = Db::open_in_memory().unwrap();
        for v in [0, -1, 5001, i64::MAX, i64::MIN] {
            assert!(db.add_entry(v, at(2026, 11, 15, 8, 0)).is_err());
        }
        assert_eq!(db.day_total("2026-11-15").unwrap(), 0);
    }

    #[test]
    fn edits_amount_and_time_keeping_the_day() {
        let db = Db::open_in_memory().unwrap();
        let e = db.add_entry(250, at(2026, 11, 15, 10, 0)).unwrap();
        let now = at(2026, 11, 15, 12, 0);
        let u = db.update_entry(e.id, 400, t(7, 30), now).unwrap();
        assert_eq!(u.amount_ml, 400);
        assert_eq!(u.day, "2026-11-15");
        assert_eq!(u.ts, at(2026, 11, 15, 7, 30).timestamp_millis());
        assert_eq!(db.get_entry(e.id).unwrap().unwrap(), u);
        assert_eq!(db.day_total("2026-11-15").unwrap(), 400);
    }

    #[test]
    fn rejects_invalid_edits() {
        let db = Db::open_in_memory().unwrap();
        let e = db.add_entry(250, at(2026, 11, 15, 10, 0)).unwrap();
        let now = at(2026, 11, 15, 12, 0);
        assert!(db.update_entry(e.id, -5, t(9, 0), now).is_err());
        assert!(db.update_entry(e.id, 300, t(13, 0), now).is_err(), "future time");
        assert!(db.update_entry(9999, 300, t(9, 0), now).is_err(), "missing id");
        assert_eq!(db.get_entry(e.id).unwrap().unwrap().amount_ml, 250);
    }

    #[test]
    fn deletes_entries() {
        let db = Db::open_in_memory().unwrap();
        let a = db.add_entry(250, at(2026, 11, 15, 10, 0)).unwrap();
        db.add_entry(500, at(2026, 11, 15, 11, 0)).unwrap();
        db.delete_entry(a.id).unwrap();
        assert_eq!(db.day_total("2026-11-15").unwrap(), 500);
        assert!(db.delete_entry(a.id).is_err());
    }

    #[test]
    fn keeps_counting_past_the_goal() {
        let db = Db::open_in_memory().unwrap();
        for h in 8..18 {
            db.add_entry(500, at(2026, 11, 15, h, 0)).unwrap();
        }
        assert_eq!(db.day_total("2026-11-15").unwrap(), 5000);
    }

    #[test]
    fn settings_roundtrip_and_validation() {
        let db = Db::open_in_memory().unwrap();
        assert_eq!(db.get_settings().unwrap(), Settings::default());
        let s = Settings {
            goal_ml: 3000,
            reminders_enabled: true,
            ..Default::default()
        };
        db.save_settings(&s).unwrap();
        assert_eq!(db.get_settings().unwrap(), s);
        assert!(db
            .save_settings(&Settings {
                goal_ml: -1,
                ..Default::default()
            })
            .is_err());
        assert_eq!(db.get_settings().unwrap().goal_ml, 3000);
    }

    #[test]
    fn data_survives_reopen() {
        let dir = std::env::temp_dir().join(format!("aqua-test-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("aqua.db");
        {
            let db = Db::open(&path).unwrap();
            db.add_entry(750, at(2026, 11, 15, 10, 0)).unwrap();
        }
        let db = Db::open(&path).unwrap();
        assert_eq!(db.day_total("2026-11-15").unwrap(), 750);
        drop(db);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn rejects_malformed_days() {
        let db = Db::open_in_memory().unwrap();
        assert!(db.list_entries("2026-13-01").is_err());
        assert!(db.list_entries("' OR 1=1 --").is_err());
        assert!(db.daily_totals("x", "2026-11-15").is_err());
    }
}
