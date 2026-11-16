mod db;
mod i18n;
mod model;
mod reminder;

use std::sync::{Mutex, MutexGuard};
use std::time::Duration as StdDuration;

use chrono::{DateTime, Local};
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::Wry;
use tauri::{AppHandle, Manager, State, WindowEvent};
use tauri_plugin_autostart::{MacosLauncher, ManagerExt as AutostartExt};
use tauri_plugin_notification::{NotificationExt, PermissionState};

use db::Db;
use model::{parse_time, CloseBehavior, DailyTotal, Entry, Settings};

const MAIN_WINDOW: &str = "main";
const AUTOSTART_FLAG: &str = "--minimized";
const TRAY_ID: &str = "aqua-tray";

struct AppState {
    db: Mutex<Db>,
    started_at: DateTime<Local>,
    last_reminder: Mutex<Option<DateTime<Local>>>,
}

impl AppState {
    fn db(&self) -> Result<MutexGuard<'_, Db>, String> {
        self.db.lock().map_err(|_| "db_unavailable".to_string())
    }
}

type CmdResult<T> = Result<T, String>;

// ---------- commands ----------

#[tauri::command]
fn get_settings(app: AppHandle, state: State<'_, AppState>) -> CmdResult<Settings> {
    let mut settings = state.db()?.get_settings()?;
    // The OS registry is the source of truth for autostart.
    if let Ok(enabled) = app.autolaunch().is_enabled() {
        settings.autostart = enabled;
    }
    Ok(settings)
}

#[tauri::command]
fn save_settings(app: AppHandle, state: State<'_, AppState>, settings: Settings) -> CmdResult<Settings> {
    settings.validate()?;
    let autolaunch = app.autolaunch();
    if autolaunch.is_enabled().unwrap_or(false) != settings.autostart {
        let res = if settings.autostart {
            autolaunch.enable()
        } else {
            autolaunch.disable()
        };
        res.map_err(|e| format!("autostart_failed: {e}"))?;
    }
    if settings.reminders_enabled {
        let notifications = app.notification();
        if notifications.permission_state().ok() != Some(PermissionState::Granted) {
            let _ = notifications.request_permission();
        }
    }
    state.db()?.save_settings(&settings)?;
    if let Some(tray) = app.tray_by_id(TRAY_ID) {
        if let Ok(menu) = tray_menu(&app, &settings.language) {
            let _ = tray.set_menu(Some(menu));
        }
    }
    Ok(settings)
}

#[tauri::command]
fn add_entry(state: State<'_, AppState>, amount_ml: i64) -> CmdResult<Entry> {
    state.db()?.add_entry(amount_ml, Local::now())
}

#[tauri::command]
fn update_entry(state: State<'_, AppState>, id: i64, amount_ml: i64, time: String) -> CmdResult<Entry> {
    let time = parse_time(&time)?;
    state.db()?.update_entry(id, amount_ml, time, Local::now())
}

#[tauri::command]
fn delete_entry(state: State<'_, AppState>, id: i64) -> CmdResult<()> {
    state.db()?.delete_entry(id)
}

#[tauri::command]
fn list_entries(state: State<'_, AppState>, day: String) -> CmdResult<Vec<Entry>> {
    state.db()?.list_entries(&day)
}

#[tauri::command]
fn daily_totals(state: State<'_, AppState>, from_day: String, to_day: String) -> CmdResult<Vec<DailyTotal>> {
    state.db()?.daily_totals(&from_day, &to_day)
}

// ---------- window / tray ----------

fn show_main(app: &AppHandle) {
    if let Some(w) = app.get_webview_window(MAIN_WINDOW) {
        let _ = w.unminimize();
        let _ = w.show();
        let _ = w.set_focus();
    }
}

fn tray_menu(app: &AppHandle, language: &str) -> tauri::Result<Menu<Wry>> {
    let text = i18n::strings(language);
    let open = MenuItem::with_id(app, "open", text.open, true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", text.quit, true, None::<&str>)?;
    Menu::with_items(app, &[&open, &PredefinedMenuItem::separator(app)?, &quit])
}

fn setup_tray(app: &AppHandle, language: &str) -> tauri::Result<()> {
    let menu = tray_menu(app, language)?;

    let mut builder = TrayIconBuilder::with_id(TRAY_ID)
        .tooltip("Aqua")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "open" => show_main(app),
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                show_main(tray.app_handle());
            }
        });
    if let Some(icon) = app.default_window_icon() {
        builder = builder.icon(icon.clone());
    }
    builder.build(app)?;
    Ok(())
}

// ---------- reminders ----------

fn reminder_tick(app: &AppHandle) -> Result<(), String> {
    let state = app.state::<AppState>();
    let now = Local::now();
    let today = now.date_naive().format("%Y-%m-%d").to_string();
    let (settings, total, last_intake) = {
        let db = state.db()?;
        (db.get_settings()?, db.day_total(&today)?, db.last_entry_ts(&today)?)
    };
    if !settings.reminders_enabled {
        return Ok(());
    }

    let mut last_reminder = state.last_reminder.lock().map_err(|_| "lock")?;
    let mut last_activity = state.started_at;
    if let Some(r) = *last_reminder {
        last_activity = last_activity.max(r);
    }
    if let Some(ts) = last_intake.and_then(DateTime::from_timestamp_millis) {
        last_activity = last_activity.max(ts.with_timezone(&Local));
    }

    if reminder::should_remind(now.naive_local(), &settings, total, last_activity.naive_local()) {
        *last_reminder = Some(now);
        let notifications = app.notification();
        if notifications.permission_state().ok() == Some(PermissionState::Granted) {
            notifications
                .builder()
                .title("Aqua")
                .body(i18n::strings(&settings.language).reminder)
                .show()
                .map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

fn spawn_reminders(app: AppHandle) {
    std::thread::Builder::new()
        .name("aqua-reminders".into())
        .spawn(move || loop {
            std::thread::sleep(StdDuration::from_secs(20));
            if let Err(e) = reminder_tick(&app) {
                eprintln!("reminder error: {e}");
            }
        })
        .expect("failed to spawn reminder thread");
}

// ---------- entry point ----------

pub fn run() {
    tauri::Builder::default()
        // Must be registered first: a second launch just focuses the running instance.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| show_main(app)))
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            Some(vec![AUTOSTART_FLAG]),
        ))
        .plugin(tauri_plugin_notification::init())
        .setup(|app| {
            let dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&dir)?;
            let db = Db::open(&dir.join("aqua.db"))?;
            let language = db.get_settings().map(|s| s.language).unwrap_or_default();
            app.manage(AppState {
                db: Mutex::new(db),
                started_at: Local::now(),
                last_reminder: Mutex::new(None),
            });

            setup_tray(app.handle(), &language)?;
            spawn_reminders(app.handle().clone());

            // Launched by Windows at login: stay quietly in the tray.
            if !std::env::args().any(|a| a == AUTOSTART_FLAG) {
                show_main(app.handle());
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                let behavior = window
                    .state::<AppState>()
                    .db()
                    .and_then(|db| db.get_settings())
                    .map(|s| s.close_behavior)
                    .unwrap_or(CloseBehavior::Tray);
                if behavior == CloseBehavior::Tray {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            get_settings,
            save_settings,
            add_entry,
            update_entry,
            delete_entry,
            list_entries,
            daily_totals
        ])
        .run(tauri::generate_context!())
        .expect("error while running Aqua");
}
