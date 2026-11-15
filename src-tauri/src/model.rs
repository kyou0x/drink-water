use serde::{Deserialize, Serialize};

pub const MIN_ENTRY_ML: i64 = 1;
pub const MAX_ENTRY_ML: i64 = 5000;
pub const MIN_GOAL_ML: i64 = 250;
pub const MAX_GOAL_ML: i64 = 20000;
pub const REMINDER_INTERVALS: [i64; 5] = [30, 45, 60, 90, 120];

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Entry {
    pub id: i64,
    pub amount_ml: i64,
    /// Unix epoch, milliseconds.
    pub ts: i64,
    /// Local calendar day (YYYY-MM-DD).
    pub day: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DailyTotal {
    pub day: String,
    pub total_ml: i64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum CloseBehavior {
    Tray,
    Quit,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct Settings {
    pub goal_ml: i64,
    pub quick_amounts: Vec<i64>,
    pub reminders_enabled: bool,
    pub reminder_interval_min: i64,
    pub reminder_start: String,
    pub reminder_end: String,
    pub autostart: bool,
    pub close_behavior: CloseBehavior,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            goal_ml: 4500,
            quick_amounts: vec![150, 250, 350, 500],
            reminders_enabled: false,
            reminder_interval_min: 45,
            reminder_start: "08:00".into(),
            reminder_end: "22:00".into(),
            autostart: false,
            close_behavior: CloseBehavior::Tray,
        }
    }
}

pub fn validate_amount(ml: i64) -> Result<i64, String> {
    if ml < MIN_ENTRY_ML {
        return Err("A quantidade deve ser maior que zero.".into());
    }
    if ml > MAX_ENTRY_ML {
        return Err(format!("Máximo de {MAX_ENTRY_ML} ml por registro."));
    }
    Ok(ml)
}

pub fn parse_time(value: &str) -> Result<chrono::NaiveTime, String> {
    if value.len() != 5 {
        return Err("Horário inválido (use HH:MM).".into());
    }
    chrono::NaiveTime::parse_from_str(value, "%H:%M").map_err(|_| "Horário inválido (use HH:MM).".into())
}

pub fn parse_day(value: &str) -> Result<chrono::NaiveDate, String> {
    if value.len() != 10 {
        return Err("Data inválida.".into());
    }
    chrono::NaiveDate::parse_from_str(value, "%Y-%m-%d").map_err(|_| "Data inválida.".into())
}

impl Settings {
    pub fn validate(&self) -> Result<(), String> {
        if !(MIN_GOAL_ML..=MAX_GOAL_ML).contains(&self.goal_ml) {
            return Err(format!("A meta deve ficar entre {MIN_GOAL_ML} e {MAX_GOAL_ML} ml."));
        }
        if self.quick_amounts.len() != 4 {
            return Err("Defina 4 botões rápidos.".into());
        }
        for &q in &self.quick_amounts {
            validate_amount(q).map_err(|e| format!("Botão rápido: {e}"))?;
        }
        if !REMINDER_INTERVALS.contains(&self.reminder_interval_min) {
            return Err("Intervalo de lembrete inválido.".into());
        }
        let start = parse_time(&self.reminder_start)?;
        let end = parse_time(&self.reminder_end)?;
        if start == end {
            return Err("Início e término dos lembretes não podem ser iguais.".into());
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn defaults_are_valid() {
        let s = Settings::default();
        assert_eq!(s.goal_ml, 4500);
        assert!(s.validate().is_ok());
    }

    #[test]
    fn rejects_bad_values() {
        assert!(validate_amount(0).is_err());
        assert!(validate_amount(-250).is_err());
        assert!(validate_amount(5001).is_err());
        assert!(Settings {
            goal_ml: 10,
            ..Default::default()
        }
        .validate()
        .is_err());
        assert!(Settings {
            reminder_interval_min: 7,
            ..Default::default()
        }
        .validate()
        .is_err());
        assert!(Settings {
            reminder_start: "25:00".into(),
            ..Default::default()
        }
        .validate()
        .is_err());
        assert!(Settings {
            quick_amounts: vec![1, 2, 3],
            ..Default::default()
        }
        .validate()
        .is_err());
    }

    #[test]
    fn partial_json_falls_back_to_defaults() {
        let s: Settings = serde_json::from_str(r#"{"goalMl": 3000}"#).unwrap();
        assert_eq!(s.goal_ml, 3000);
        assert_eq!(s.quick_amounts, vec![150, 250, 350, 500]);
    }
}
