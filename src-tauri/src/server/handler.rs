// Обработка входящих WebSocket-сообщений от клиентов
// Каждое сообщение — JSON с полями { type, payload, timestamp }

use crate::database::{User, Message, Channel};
use crate::server::{ServerState, ConnectedClient};
use serde_json::Value;
use uuid::Uuid;

/// Обрабатывает одно текстовое WS-сообщение от клиента.
/// Возвращает Option<String> — персональный ответ клиенту (не broadcast).
pub async fn handle_client_message(
    raw: &str,
    state: &ServerState,
    client_id: &mut Option<String>,
) -> Option<String> {
    // Парсим JSON
    let msg: Value = match serde_json::from_str(raw) {
        Ok(v) => v,
        Err(_) => {
            return Some(error_response("invalid_json", "Невалидный JSON"));
        }
    };

    let msg_type = msg["type"].as_str().unwrap_or("");

    match msg_type {
        "join" => handle_join(msg, state, client_id).await,
        "send_message" => handle_send_message(msg, state, client_id).await,
        "typing_start" => handle_typing(msg, state, client_id).await,
        "create_channel" => handle_create_channel(msg, state, client_id).await,
        "delete_channel" => handle_delete_channel(msg, state, client_id).await,
        "sync_messages" => handle_sync_messages(msg, state).await,
        "join_voice" | "leave_voice" | "webrtc_offer" | "webrtc_answer" | "webrtc_ice_candidate" | "voice_state_update" |
        "start_screen_share" | "stop_screen_share" | "webrtc_screen_offer" | "webrtc_screen_answer" | "webrtc_screen_ice" => {
            handle_webrtc_signaling(msg, state, client_id).await
        }
        _ => Some(error_response("unknown_type", &format!("Неизвестный тип: {}", msg_type))),
    }
}

// === Обработчики ===

async fn handle_join(
    msg: Value,
    state: &ServerState,
    client_id: &mut Option<String>,
) -> Option<String> {
    let payload = &msg["payload"];
    let username = payload["username"].as_str().unwrap_or("").trim();
    let display_name = payload["display_name"].as_str().unwrap_or("").trim();
    let room_password = payload["room_password"].as_str().unwrap_or("");

    // Проверяем пароль комнаты
    if !state.room_password.is_empty() && room_password != state.room_password {
        return Some(serde_json::json!({
            "type": "auth_error",
            "payload": { "reason": "Неверный пароль комнаты" },
            "timestamp": chrono::Utc::now().timestamp_millis()
        }).to_string());
    }

    if username.is_empty() || display_name.is_empty() {
        return Some(error_response("invalid_join", "Имя пользователя и отображаемое имя обязательны"));
    }

    // Проверяем лимит (10 пользователей)
    let clients = state.clients.read().await;
    if clients.len() >= 10 {
        return Some(error_response("room_full", "Комната заполнена (максимум 10 человек)"));
    }

    // Проверяем уникальность username
    if clients.values().any(|c| c.username == username) {
        return Some(error_response("username_taken", "Этот никнейм уже занят"));
    }
    drop(clients);

    // Генерируем случайный цвет аватара
    let colors = ["#7C6AEF", "#5B8DEF", "#EF6A6A", "#6AEF8B", "#EFC46A", "#EF6AD4", "#6AE1EF", "#EFA46A"];
    let avatar_color = colors[username.len() % colors.len()];

    // Создаём пользователя
    let user_id = Uuid::new_v4().to_string();
    let user = User {
        id: user_id.clone(),
        username: username.to_string(),
        display_name: display_name.to_string(),
        avatar_color: avatar_color.to_string(),
    };

    // Сохраняем в БД
    if let Err(e) = state.db.create_user(user.clone()).await {
        return Some(error_response("db_error", &format!("Ошибка БД: {}", e)));
    }

    // Добавляем в список подключённых
    {
        let mut clients = state.clients.write().await;
        clients.insert(user_id.clone(), ConnectedClient {
            user_id: user_id.clone(),
            username: username.to_string(),
            display_name: display_name.to_string(),
            avatar_color: avatar_color.to_string(),
        });
    }

    *client_id = Some(user_id.clone());

    // Получаем данные для welcome
    let channels = state.db.get_all_channels().await.unwrap_or_default();
    let users = state.db.get_all_users().await.unwrap_or_default();

    // Получаем последние сообщения для #general
    let recent_messages = state.db
        .get_recent_messages("general".to_string(), 50)
        .await
        .unwrap_or_default();

    // Уведомляем всех о новом пользователе (broadcast)
    let join_broadcast = serde_json::json!({
        "type": "user_joined",
        "payload": {
            "user": {
                "id": user.id,
                "username": user.username,
                "display_name": user.display_name,
                "avatar_color": user.avatar_color
            }
        },
        "timestamp": chrono::Utc::now().timestamp_millis()
    });
    let _ = state.broadcast_tx.send(join_broadcast.to_string());

    // Отправляем welcome конкретному клиенту
    Some(serde_json::json!({
        "type": "welcome",
        "payload": {
            "user_id": user_id,
            "channels": channels,
            "users": users,
            "recent_messages": recent_messages
        },
        "timestamp": chrono::Utc::now().timestamp_millis()
    }).to_string())
}

async fn handle_send_message(
    msg: Value,
    state: &ServerState,
    client_id: &Option<String>,
) -> Option<String> {
    let user_id = match client_id {
        Some(id) => id.clone(),
        None => return Some(error_response("not_joined", "Сначала нужно войти (join)")),
    };

    let payload = &msg["payload"];
    let channel_id = payload["channel_id"].as_str().unwrap_or("general");
    let content = payload["content"].as_str().unwrap_or("").trim();

    if content.is_empty() {
        return Some(error_response("empty_message", "Пустое сообщение"));
    }

    let message_id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    let message = Message {
        id: message_id.clone(),
        channel_id: channel_id.to_string(),
        author_id: user_id.clone(),
        content: content.to_string(),
        message_type: "text".to_string(),
        file_path: None,
        file_name: None,
        file_size: None,
        created_at: now.clone(),
    };

    // Сохраняем в БД
    if let Err(e) = state.db.save_message(message.clone()).await {
        return Some(error_response("db_error", &format!("Ошибка сохранения: {}", e)));
    }

    // Получаем данные автора
    let clients = state.clients.read().await;
    let author = clients.get(&user_id);
    let author_name = author.map(|a| a.display_name.clone()).unwrap_or_default();
    let author_username = author.map(|a| a.username.clone()).unwrap_or_default();
    let author_color = author.map(|a| a.avatar_color.clone()).unwrap_or_default();
    drop(clients);

    // Broadcast всем клиентам
    let broadcast_msg = serde_json::json!({
        "type": "new_message",
        "payload": {
            "message": {
                "id": message_id,
                "channel_id": channel_id,
                "author_id": user_id,
                "author_name": author_name,
                "author_username": author_username,
                "author_color": author_color,
                "content": content,
                "message_type": "text",
                "created_at": now
            }
        },
        "timestamp": chrono::Utc::now().timestamp_millis()
    });
    let _ = state.broadcast_tx.send(broadcast_msg.to_string());

    None // Ответ уже ушёл через broadcast
}

async fn handle_typing(
    msg: Value,
    state: &ServerState,
    client_id: &Option<String>,
) -> Option<String> {
    let user_id = match client_id {
        Some(id) => id.clone(),
        None => return None,
    };

    let channel_id = msg["payload"]["channel_id"].as_str().unwrap_or("general");

    let typing_msg = serde_json::json!({
        "type": "typing",
        "payload": {
            "user_id": user_id,
            "channel_id": channel_id
        },
        "timestamp": chrono::Utc::now().timestamp_millis()
    });
    let _ = state.broadcast_tx.send(typing_msg.to_string());

    None
}

async fn handle_create_channel(
    msg: Value,
    state: &ServerState,
    client_id: &Option<String>,
) -> Option<String> {
    let user_id = match client_id {
        Some(id) => id.clone(),
        None => return Some(error_response("not_joined", "Сначала нужно войти")),
    };

    let payload = &msg["payload"];
    let name = payload["name"].as_str().unwrap_or("").trim().to_lowercase();
    let description = payload["description"].as_str().unwrap_or("").trim();

    if name.is_empty() {
        return Some(error_response("invalid_name", "Имя канала обязательно"));
    }

    // Проверяем лимит (10 каналов)
    let count = state.db.get_channel_count().await.unwrap_or(0);
    if count >= 10 {
        return Some(error_response("channel_limit", "Максимум 10 каналов"));
    }

    let channel_id = Uuid::new_v4().to_string();
    let channel = Channel {
        id: channel_id.clone(),
        name: name.clone(),
        description: description.to_string(),
        position: count,
        created_by: user_id,
    };

    if let Err(e) = state.db.create_channel(channel.clone()).await {
        return Some(error_response("db_error", &format!("Ошибка: {}", e)));
    }

    let broadcast_msg = serde_json::json!({
        "type": "channel_created",
        "payload": { "channel": channel },
        "timestamp": chrono::Utc::now().timestamp_millis()
    });
    let _ = state.broadcast_tx.send(broadcast_msg.to_string());

    None
}

async fn handle_delete_channel(
    msg: Value,
    state: &ServerState,
    client_id: &Option<String>,
) -> Option<String> {
    if client_id.is_none() {
        return Some(error_response("not_joined", "Сначала нужно войти"));
    }

    let channel_id = msg["payload"]["channel_id"].as_str().unwrap_or("");

    if channel_id == "general" {
        return Some(error_response("cannot_delete", "Нельзя удалить #general"));
    }

    if let Err(e) = state.db.delete_channel(channel_id.to_string()).await {
        return Some(error_response("db_error", &format!("Ошибка: {}", e)));
    }

    let broadcast_msg = serde_json::json!({
        "type": "channel_deleted",
        "payload": { "channel_id": channel_id },
        "timestamp": chrono::Utc::now().timestamp_millis()
    });
    let _ = state.broadcast_tx.send(broadcast_msg.to_string());

    None
}

async fn handle_sync_messages(
    msg: Value,
    state: &ServerState,
) -> Option<String> {
    let payload = &msg["payload"];
    let channel_id = payload["channel_id"].as_str().unwrap_or("general");
    let last_seen_id = payload["last_seen_message_id"].as_str().unwrap_or("");

    let messages = if last_seen_id.is_empty() {
        state.db.get_recent_messages(channel_id.to_string(), 50).await.unwrap_or_default()
    } else {
        state.db.get_messages_since(channel_id.to_string(), last_seen_id.to_string()).await.unwrap_or_default()
    };

    Some(serde_json::json!({
        "type": "sync_response",
        "payload": {
            "channel_id": channel_id,
            "messages": messages
        },
        "timestamp": chrono::Utc::now().timestamp_millis()
    }).to_string())
}

async fn handle_webrtc_signaling(
    mut msg: Value,
    state: &ServerState,
    client_id: &Option<String>,
) -> Option<String> {
    let user_id = match client_id {
        Some(id) => id.clone(),
        None => return None,
    };

    // Добавляем sender_id в payload
    if let Some(payload) = msg.get_mut("payload") {
        if let Some(obj) = payload.as_object_mut() {
            obj.insert("sender_id".to_string(), Value::String(user_id));
        }
    }

    // Рассылаем всем клиентам
    let _ = state.broadcast_tx.send(msg.to_string());
    None
}

// === Утилиты ===

fn error_response(code: &str, message: &str) -> String {
    serde_json::json!({
        "type": "error",
        "payload": {
            "code": code,
            "message": message
        },
        "timestamp": chrono::Utc::now().timestamp_millis()
    }).to_string()
}
