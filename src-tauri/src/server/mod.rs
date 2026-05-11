// WebSocket-сервер для dotConnect
// Хост запускает этот сервер, клиенты подключаются к нему

pub mod handler;

use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{mpsc, broadcast, RwLock};
use tokio::net::TcpListener;
use futures_util::{StreamExt, SinkExt};
use tokio_tungstenite::accept_async;
use tokio_tungstenite::tungstenite::Message as WsMsg;

use crate::database::DbHandle;
use crate::server::handler::handle_client_message;

// Информация о подключённом клиенте
#[derive(Debug, Clone)]
pub struct ConnectedClient {
    pub user_id: String,
    pub username: String,
    pub display_name: String,
    pub avatar_color: String,
}

// Общее состояние сервера
pub struct ServerState {
    pub clients: RwLock<HashMap<String, ConnectedClient>>,
    pub db: DbHandle,
    pub broadcast_tx: broadcast::Sender<String>,
    pub room_password: String,
}

/// Запускает WebSocket-сервер на указанном порту
pub async fn start_ws_server(
    port: u16,
    db: DbHandle,
    room_password: String,
    mut shutdown_rx: mpsc::Receiver<()>,
) -> Result<(), String> {
    let addr = format!("0.0.0.0:{}", port);
    let listener = TcpListener::bind(&addr)
        .await
        .map_err(|e| format!("Не удалось запустить сервер на {}: {}", addr, e))?;

    println!("[WS Server] Слушаю на {}", addr);

    // Канал для broadcast сообщений всем клиентам
    let (broadcast_tx, _) = broadcast::channel::<String>(100);

    let state = Arc::new(ServerState {
        clients: RwLock::new(HashMap::new()),
        db,
        broadcast_tx,
        room_password,
    });

    loop {
        tokio::select! {
            // Ждём новое подключение
            result = listener.accept() => {
                match result {
                    Ok((stream, addr)) => {
                        println!("[WS Server] Новое подключение: {}", addr);
                        let state = state.clone();
                        tokio::spawn(handle_connection(stream, state));
                    }
                    Err(e) => {
                        eprintln!("[WS Server] Ошибка принятия соединения: {}", e);
                    }
                }
            }
            // Ждём сигнал остановки
            _ = shutdown_rx.recv() => {
                println!("[WS Server] Получен сигнал остановки");
                break;
            }
        }
    }

    println!("[WS Server] Остановлен");
    Ok(())
}

/// Обрабатывает одно WebSocket-подключение
async fn handle_connection(
    stream: tokio::net::TcpStream,
    state: Arc<ServerState>,
) {
    // Апгрейдим TCP -> WebSocket
    let ws_stream = match accept_async(stream).await {
        Ok(ws) => ws,
        Err(e) => {
            eprintln!("[WS] Ошибка handshake: {}", e);
            return;
        }
    };

    let (mut ws_sender, mut ws_receiver) = ws_stream.split();
    let mut broadcast_rx = state.broadcast_tx.subscribe();

    // ID клиента (будет заполнен после "join")
    let mut client_id: Option<String> = None;

    loop {
        tokio::select! {
            // Получаем сообщение от клиента
            msg = ws_receiver.next() => {
                match msg {
                    Some(Ok(WsMsg::Text(text))) => {
                        let response = handle_client_message(
                            &text,
                            &state,
                            &mut client_id,
                        ).await;

                        // Если handler вернул ответ — отправляем клиенту
                        if let Some(resp) = response {
                            if ws_sender.send(WsMsg::Text(resp.into())).await.is_err() {
                                break;
                            }
                        }
                    }
                    Some(Ok(WsMsg::Close(_))) | None => {
                        break;
                    }
                    Some(Err(e)) => {
                        eprintln!("[WS] Ошибка чтения: {}", e);
                        break;
                    }
                    _ => {}
                }
            }
            // Получаем broadcast и пересылаем клиенту
            result = broadcast_rx.recv() => {
                if let Ok(msg) = result {
                    if ws_sender.send(WsMsg::Text(msg.into())).await.is_err() {
                        break;
                    }
                }
            }
        }
    }

    // Клиент отключился — удаляем из списка
    if let Some(id) = &client_id {
        let mut clients = state.clients.write().await;
        let removed = clients.remove(id);

        if let Some(user) = removed {
            println!("[WS Server] Отключился: {}", user.display_name);

            // Уведомляем всех об отключении
            let leave_msg = serde_json::json!({
                "type": "user_left",
                "payload": { "user_id": id },
                "timestamp": chrono::Utc::now().timestamp_millis()
            });
            let _ = state.broadcast_tx.send(leave_msg.to_string());

            // Удаляем из БД
            let _ = state.db.remove_user(id.clone()).await;
        }
    }
}
