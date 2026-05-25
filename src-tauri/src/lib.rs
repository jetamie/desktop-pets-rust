mod models;
mod resources;

use models::{AppConfig, EditableConfig, GameModes, PetConfig};
use resources::{pet_assets_path, read_app_config, read_pet_config, write_app_config};
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, LogicalPosition, Manager, PhysicalPosition, PhysicalSize, Position, Size,
    WebviewUrl, WebviewWindowBuilder,
};

const ALLOWED_PETS: &[&str] = &["cat", "totoro", "totoro-v2", "coal-balls"];

fn resource_dir(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    app.path()
        .resource_dir()
        .map_err(|error| format!("failed to resolve resource directory: {error}"))
}

fn app_config_dir(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    app.path()
        .app_config_dir()
        .map_err(|error| format!("failed to resolve app config directory: {error}"))
}

fn validate_time(value: &str) -> bool {
    let Some((hours, minutes)) = value.split_once(':') else {
        return false;
    };
    if hours.len() != 2 || minutes.len() != 2 {
        return false;
    }
    let Ok(hours) = hours.parse::<u8>() else {
        return false;
    };
    let Ok(minutes) = minutes.parse::<u8>() else {
        return false;
    };
    hours < 24 && minutes < 60
}

fn validate_game_modes(game_modes: &GameModes) -> Result<(), String> {
    if !game_modes.modes.contains_key(&game_modes.default) {
        return Err("default mode must exist in modes".to_string());
    }
    for schedule in &game_modes.schedules {
        if !game_modes.modes.contains_key(&schedule.mode) {
            return Err(format!("scheduled mode does not exist: {}", schedule.mode));
        }
        if !validate_time(&schedule.start_time) || !validate_time(&schedule.end_time) {
            return Err(format!(
                "invalid schedule time for mode {}: {}-{}",
                schedule.mode, schedule.start_time, schedule.end_time
            ));
        }
    }
    Ok(())
}

fn validate_pet_name(pet_name: &str) -> Result<(), String> {
    if ALLOWED_PETS.contains(&pet_name) {
        Ok(())
    } else {
        Err(format!("unsupported pet: {pet_name}"))
    }
}

fn validate_config(config: &AppConfig) -> Result<(), String> {
    validate_pet_name(&config.current_pet)?;
    if !(1..=3600).contains(&config.interval_seconds) {
        return Err("interval_seconds must be between 1 and 3600".to_string());
    }
    if !config.move_speed.is_finite() || config.move_speed < 0.1 || config.move_speed > 50.0 {
        return Err("move_speed must be between 0.1 and 50".to_string());
    }
    if !(32..=512).contains(&config.pet_size) {
        return Err("pet_size must be between 32 and 512".to_string());
    }
    validate_game_modes(&config.game_modes)?;
    if let Some(current_mode) = &config.current_mode {
        if !config.game_modes.modes.contains_key(current_mode) {
            return Err(format!("current mode does not exist: {current_mode}"));
        }
    }
    Ok(())
}

fn merge_editable_config(mut config: AppConfig, editable: EditableConfig) -> AppConfig {
    config.current_pet = editable.current_pet;
    config.interval_seconds = editable.interval_seconds;
    config.move_speed = editable.move_speed;
    config.pet_size = editable.pet_size;
    config.current_mode = editable.current_mode;
    config.game_modes = editable.game_modes;
    config
}

#[tauri::command]
fn get_config(app: tauri::AppHandle) -> Result<AppConfig, String> {
    read_app_config(&resource_dir(&app)?, &app_config_dir(&app)?)
}

#[tauri::command]
fn get_editable_config(app: tauri::AppHandle) -> Result<EditableConfig, String> {
    let config = read_app_config(&resource_dir(&app)?, &app_config_dir(&app)?)?;
    Ok(EditableConfig {
        current_pet: config.current_pet,
        interval_seconds: config.interval_seconds,
        move_speed: config.move_speed,
        pet_size: config.pet_size,
        current_mode: config.current_mode,
        game_modes: config.game_modes,
    })
}

#[tauri::command]
fn save_config(app: tauri::AppHandle, config: EditableConfig) -> Result<AppConfig, String> {
    let resource_dir = resource_dir(&app)?;
    let current = read_app_config(&resource_dir, &app_config_dir(&app)?)?;
    let next = merge_editable_config(current, config);
    validate_config(&next)?;
    read_pet_config(&resource_dir, &next.current_pet)?;
    write_app_config(&app_config_dir(&app)?, &next)?;

    if let Some(window) = app.get_webview_window("main") {
        let pet_size = next.pet_size;
        window
            .set_size(Size::Physical(PhysicalSize::new(pet_size, pet_size)))
            .map_err(|error| format!("failed to resize main window: {error}"))?;
    }

    app.emit("config-changed", &next)
        .map_err(|error| format!("failed to emit config change: {error}"))?;
    Ok(next)
}

#[tauri::command]
fn get_pet_config(app: tauri::AppHandle, pet_name: String) -> Result<PetConfig, String> {
    read_pet_config(&resource_dir(&app)?, &pet_name)
}

#[tauri::command]
fn get_pet_assets_path(app: tauri::AppHandle) -> Result<String, String> {
    let path = pet_assets_path(&resource_dir(&app)?)
        .to_string_lossy()
        .to_string();
    Ok(path
        .strip_prefix(r"\\?\")
        .unwrap_or(&path)
        .replace('\\', "/"))
}

#[tauri::command]
fn quit_app(app: tauri::AppHandle) {
    app.exit(0);
}

#[tauri::command]
fn set_window_position(window: tauri::Window, x: f64, y: f64) -> Result<(), String> {
    window
        .set_position(Position::Logical(LogicalPosition::new(x, y)))
        .map_err(|error| format!("failed to set window position: {error}"))
}

fn show_main_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
    }
}

fn open_config_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("config") {
        let _ = window.show();
        let _ = window.set_focus();
        return;
    }

    if let Ok(window) = WebviewWindowBuilder::new(app, "config", WebviewUrl::App("index.html?view=config".into()))
        .title("配置")
        .inner_size(520.0, 620.0)
        .resizable(false)
        .decorations(true)
        .transparent(false)
        .build()
    {
        let _ = window.show();
        let _ = window.set_focus();
    }
}

fn setup_tray(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let config = MenuItem::with_id(app, "config", "配置", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&config, &quit])?;

    TrayIconBuilder::new()
        .icon(
            app.default_window_icon()
                .ok_or("default window icon is unavailable")?
                .clone(),
        )
        .tooltip("桌面宠物")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id().as_ref() {
            "config" => open_config_window(app),
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::DoubleClick {
                button: MouseButton::Left,
                ..
            }
            | TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                show_main_window(tray.app_handle());
            }
        })
        .build(app)?;

    Ok(())
}

fn setup_main_window(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let window = app
        .get_webview_window("main")
        .ok_or("main window was not created")?;
    let config = read_app_config(&app.handle().path().resource_dir()?, &app.handle().path().app_config_dir()?)?;
    let pet_size = config.pet_size;

    window.set_size(Size::Physical(PhysicalSize::new(pet_size, pet_size)))?;
    window.set_always_on_top(true)?;
    window.set_shadow(false)?;
    window.set_skip_taskbar(true)?;
    window.set_resizable(false)?;

    if let Some(monitor) = window.primary_monitor()? {
        let screen_size = monitor.size();
        let x = screen_size.width as i32 - pet_size as i32 - 20;
        let y = screen_size.height as i32 - pet_size as i32 - config.bottom_margin as i32;
        window.set_position(Position::Physical(PhysicalPosition::new(x, y)))?;
    }

    window.show()?;
    Ok(())
}

pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            get_config,
            get_editable_config,
            save_config,
            get_pet_config,
            get_pet_assets_path,
            quit_app,
            set_window_position
        ])
        .setup(|app| {
            setup_tray(app)?;
            setup_main_window(app)
        })
        .run(tauri::generate_context!())
        .expect("failed to run desktop pet application");
}
