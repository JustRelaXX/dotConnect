// Tauri-команды — мост между React (фронтенд) и Rust (бэкенд)
// Эти функции вызываются из JavaScript через `invoke("command_name", { args })`

use tauri::State;
use tokio::sync::mpsc;
use std::sync::Arc;
use tokio::sync::Mutex;

use crate::database::DbHandle;

// Состояние приложения, хранимое в Tauri
pub struct AppState {
    pub db_handle: Option<DbHandle>,
    pub shutdown_tx: Option<mpsc::Sender<()>>,
    pub server_running: bool,
    pub server_port: u16,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            db_handle: None,
            shutdown_tx: None,
            server_running: false,
            server_port: 0,
        }
    }
}

// === Tauri Commands ===

/// Запускает WebSocket-сервер (режим HOST)
#[tauri::command]
pub async fn start_server(
    port: u16,
    room_password: String,
    state: State<'_, Arc<Mutex<AppState>>>,
) -> Result<String, String> {
    let mut app_state = state.lock().await;

    if app_state.server_running {
        return Err("Сервер уже запущен".to_string());
    }

    // Определяем путь к БД
    let db_path = "dotconnect_data.db".to_string();

    // Создаём канал для DB Actor
    let (db_tx, db_rx) = mpsc::channel(100);
    let db_handle = DbHandle::new(db_tx);

    // Запускаем DB Actor
    let db_path_clone = db_path.clone();
    tokio::spawn(async move {
        crate::database::actor::run_db_actor(db_path_clone, db_rx).await;
    });

    // Канал для остановки сервера
    let (shutdown_tx, shutdown_rx) = mpsc::channel::<()>(1);

    // Запускаем WS-сервер
    let db_handle_clone = db_handle.clone();
    let room_password_clone = room_password.clone();
    tokio::spawn(async move {
        if let Err(e) = crate::server::start_ws_server(
            port,
            db_handle_clone,
            room_password_clone,
            shutdown_rx,
        ).await {
            eprintln!("[Server] Ошибка: {}", e);
        }
    });

    app_state.db_handle = Some(db_handle);
    app_state.shutdown_tx = Some(shutdown_tx);
    app_state.server_running = true;
    app_state.server_port = port;

    // Получаем локальный IP
    let local_ip = local_ip_address::local_ip()
        .map(|ip| ip.to_string())
        .unwrap_or_else(|_| "127.0.0.1".to_string());

    println!("[App] Сервер запущен на {}:{}", local_ip, port);

    Ok(serde_json::json!({
        "ip": local_ip,
        "port": port,
        "password_set": !room_password.is_empty()
    }).to_string())
}

/// Останавливает сервер
#[tauri::command]
pub async fn stop_server(
    state: State<'_, Arc<Mutex<AppState>>>,
) -> Result<(), String> {
    let mut app_state = state.lock().await;

    if !app_state.server_running {
        return Err("Сервер не запущен".to_string());
    }

    if let Some(tx) = app_state.shutdown_tx.take() {
        let _ = tx.send(()).await;
    }

    app_state.server_running = false;
    app_state.db_handle = None;

    println!("[App] Сервер остановлен");
    Ok(())
}

/// Получает локальный IP-адрес
#[tauri::command]
pub async fn get_local_ip() -> Result<String, String> {
    local_ip_address::local_ip()
        .map(|ip| ip.to_string())
        .map_err(|e| format!("Не удалось определить IP: {}", e))
}

/// Проверяет, запущен ли сервер
#[tauri::command]
pub async fn is_server_running(
    state: State<'_, Arc<Mutex<AppState>>>,
) -> Result<bool, String> {
    let app_state = state.lock().await;
    Ok(app_state.server_running)
}
