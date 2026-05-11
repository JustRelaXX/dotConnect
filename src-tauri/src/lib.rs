// Точка входа Tauri — регистрация модулей, команд и плагинов

mod database;
mod server;
mod commands;

use std::sync::Arc;
use tokio::sync::Mutex;
use commands::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        // Регистрируем глобальное состояние приложения
        .manage(Arc::new(Mutex::new(AppState::new())))
        // Регистрируем Tauri-команды (вызываются из JS)
        .invoke_handler(tauri::generate_handler![
            commands::start_server,
            commands::stop_server,
            commands::get_local_ip,
            commands::is_server_running,
        ])
        .run(tauri::generate_context!())
        .expect("ошибка запуска dotConnect");
}
