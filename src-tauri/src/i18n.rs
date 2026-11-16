//! Strings shown by the native side (tray menu and reminder notifications).
//! The UI itself is translated in `src/i18n`; keep both locale lists in sync.

pub struct Strings {
    pub open: &'static str,
    pub quit: &'static str,
    pub reminder: &'static str,
}

/// (code, tray "open", tray "quit", reminder body)
const LOCALES: [(&str, &str, &str, &str); 16] = [
    ("en", "Open Aqua", "Quit", "Time to drink water 💧"),
    ("pt-BR", "Abrir Aqua", "Sair", "Hora de beber água 💧"),
    ("es", "Abrir Aqua", "Salir", "Es hora de beber agua 💧"),
    ("fr", "Ouvrir Aqua", "Quitter", "C’est l’heure de boire de l’eau 💧"),
    ("de", "Aqua öffnen", "Beenden", "Zeit, Wasser zu trinken 💧"),
    ("it", "Apri Aqua", "Esci", "È ora di bere acqua 💧"),
    ("nl", "Aqua openen", "Afsluiten", "Tijd om water te drinken 💧"),
    ("pl", "Otwórz Aqua", "Zakończ", "Czas napić się wody 💧"),
    ("ru", "Открыть Aqua", "Выход", "Пора выпить воды 💧"),
    ("uk", "Відкрити Aqua", "Вийти", "Час випити води 💧"),
    ("tr", "Aqua’yı aç", "Çıkış", "Su içme zamanı 💧"),
    ("id", "Buka Aqua", "Keluar", "Saatnya minum air 💧"),
    ("hi", "Aqua खोलें", "बंद करें", "पानी पीने का समय 💧"),
    ("ja", "Aqua を開く", "終了", "水を飲む時間です 💧"),
    ("ko", "Aqua 열기", "종료", "물 마실 시간이에요 💧"),
    ("zh-CN", "打开 Aqua", "退出", "该喝水了 💧"),
];

pub fn is_language_pref(value: &str) -> bool {
    value == "auto" || LOCALES.iter().any(|l| l.0 == value)
}

/// Best supported match for a BCP 47 / POSIX tag: exact, then by base language.
fn match_locale(tag: &str) -> Option<&'static str> {
    let tag = tag
        .trim()
        .split('.')
        .next()
        .unwrap_or("")
        .replace('_', "-")
        .to_lowercase();
    if tag.is_empty() {
        return None;
    }
    if let Some(l) = LOCALES.iter().find(|l| l.0.to_lowercase() == tag) {
        return Some(l.0);
    }
    let base = tag.split('-').next().unwrap_or("");
    LOCALES
        .iter()
        .find(|l| l.0.split('-').next() == Some(base))
        .map(|l| l.0)
}

/// Resolves a language preference ("auto" or a code) against the given system tags.
pub fn resolve(pref: &str, system: impl IntoIterator<Item = String>) -> &'static str {
    if pref != "auto" {
        if let Some(l) = LOCALES.iter().find(|l| l.0 == pref) {
            return l.0;
        }
    }
    system.into_iter().find_map(|t| match_locale(&t)).unwrap_or("en")
}

pub fn strings(pref: &str) -> Strings {
    let code = resolve(pref, sys_locale::get_locales());
    let l = LOCALES.iter().find(|l| l.0 == code).unwrap_or(&LOCALES[0]);
    Strings {
        open: l.1,
        quit: l.2,
        reminder: l.3,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sys(tags: &[&str]) -> Vec<String> {
        tags.iter().map(|t| t.to_string()).collect()
    }

    #[test]
    fn resolves_preferences() {
        assert_eq!(resolve("ja", sys(&["pt-BR"])), "ja");
        assert_eq!(resolve("auto", sys(&["pt-BR"])), "pt-BR");
        assert_eq!(resolve("auto", sys(&["pt-PT"])), "pt-BR");
        assert_eq!(resolve("auto", sys(&["zh-Hans-CN"])), "zh-CN");
        assert_eq!(resolve("auto", sys(&["de_AT.UTF-8"])), "de");
        assert_eq!(resolve("auto", sys(&["sw", "fr-CA"])), "fr");
        assert_eq!(resolve("auto", sys(&["sw"])), "en");
        assert_eq!(resolve("xx", sys(&[])), "en");
    }

    #[test]
    fn validates_preferences() {
        assert!(is_language_pref("auto"));
        assert!(is_language_pref("zh-CN"));
        assert!(!is_language_pref("zh"));
        assert!(!is_language_pref(""));
    }
}
