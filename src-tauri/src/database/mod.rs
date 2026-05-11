// Модуль базы данных — Actor-паттерн для безопасного доступа к SQLite
// Один поток монопольно владеет подключением к БД,
// остальные общаются с ним через каналы (tokio::sync::mpsc)

pub mod actor;

use tokio::sync::{mpsc, oneshot};
use serde::{Deserialize, Serialize};

// === Типы данных ===

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct User {
    pub id: String,
    pub username: String,
    pub display_name: String,
    pub avatar_color: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Channel {
    pub id: String,
    pub name: String,
    pub description: String,
    pub position: i32,
    pub created_by: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Message {
    pub id: String,
    pub channel_id: String,
    pub author_id: String,
    pub content: String,
    pub message_type: String,
    pub file_path: Option<String>,
    pub file_name: Option<String>,
    pub file_size: Option<i64>,
    pub created_at: String,
}

// === Команды для DB Actor ===

pub enum DbCommand {
    // Пользователи
    CreateUser {
        user: User,
        reply: oneshot::Sender<Result<(), String>>,
    },
    RemoveUser {
        user_id: String,
        reply: oneshot::Sender<Result<(), String>>,
    },
    GetAllUsers {
        reply: oneshot::Sender<Result<Vec<User>, String>>,
    },

    // Каналы
    CreateChannel {
        channel: Channel,
        reply: oneshot::Sender<Result<(), String>>,
    },
    DeleteChannel {
        channel_id: String,
        reply: oneshot::Sender<Result<(), String>>,
    },
    GetAllChannels {
        reply: oneshot::Sender<Result<Vec<Channel>, String>>,
    },
    GetChannelCount {
        reply: oneshot::Sender<Result<i32, String>>,
    },

    // Сообщения
    SaveMessage {
        message: Message,
        reply: oneshot::Sender<Result<(), String>>,
    },
    GetRecentMessages {
        channel_id: String,
        limit: i32,
        reply: oneshot::Sender<Result<Vec<Message>, String>>,
    },
    GetMessagesSince {
        channel_id: String,
        since_id: String,
        reply: oneshot::Sender<Result<Vec<Message>, String>>,
    },
}

// Хэндл для отправки команд в DB Actor
#[derive(Clone)]
pub struct DbHandle {
    sender: mpsc::Sender<DbCommand>,
}

impl DbHandle {
    pub fn new(sender: mpsc::Sender<DbCommand>) -> Self {
        Self { sender }
    }

    // --- Пользователи ---

    pub async fn create_user(&self, user: User) -> Result<(), String> {
        let (reply, rx) = oneshot::channel();
        self.sender
            .send(DbCommand::CreateUser { user, reply })
            .await
            .map_err(|e| format!("DB Actor недоступен: {}", e))?;
        rx.await.map_err(|e| format!("DB Actor не ответил: {}", e))?
    }

    pub async fn remove_user(&self, user_id: String) -> Result<(), String> {
        let (reply, rx) = oneshot::channel();
        self.sender
            .send(DbCommand::RemoveUser { user_id, reply })
            .await
            .map_err(|e| format!("DB Actor недоступен: {}", e))?;
        rx.await.map_err(|e| format!("DB Actor не ответил: {}", e))?
    }

    pub async fn get_all_users(&self) -> Result<Vec<User>, String> {
        let (reply, rx) = oneshot::channel();
        self.sender
            .send(DbCommand::GetAllUsers { reply })
            .await
            .map_err(|e| format!("DB Actor недоступен: {}", e))?;
        rx.await.map_err(|e| format!("DB Actor не ответил: {}", e))?
    }

    // --- Каналы ---

    pub async fn create_channel(&self, channel: Channel) -> Result<(), String> {
        let (reply, rx) = oneshot::channel();
        self.sender
            .send(DbCommand::CreateChannel { channel, reply })
            .await
            .map_err(|e| format!("DB Actor недоступен: {}", e))?;
        rx.await.map_err(|e| format!("DB Actor не ответил: {}", e))?
    }

    pub async fn delete_channel(&self, channel_id: String) -> Result<(), String> {
        let (reply, rx) = oneshot::channel();
        self.sender
            .send(DbCommand::DeleteChannel { channel_id, reply })
            .await
            .map_err(|e| format!("DB Actor недоступен: {}", e))?;
        rx.await.map_err(|e| format!("DB Actor не ответил: {}", e))?
    }

    pub async fn get_all_channels(&self) -> Result<Vec<Channel>, String> {
        let (reply, rx) = oneshot::channel();
        self.sender
            .send(DbCommand::GetAllChannels { reply })
            .await
            .map_err(|e| format!("DB Actor недоступен: {}", e))?;
        rx.await.map_err(|e| format!("DB Actor не ответил: {}", e))?
    }

    pub async fn get_channel_count(&self) -> Result<i32, String> {
        let (reply, rx) = oneshot::channel();
        self.sender
            .send(DbCommand::GetChannelCount { reply })
            .await
            .map_err(|e| format!("DB Actor недоступен: {}", e))?;
        rx.await.map_err(|e| format!("DB Actor не ответил: {}", e))?
    }

    // --- Сообщения ---

    pub async fn save_message(&self, message: Message) -> Result<(), String> {
        let (reply, rx) = oneshot::channel();
        self.sender
            .send(DbCommand::SaveMessage { message, reply })
            .await
            .map_err(|e| format!("DB Actor недоступен: {}", e))?;
        rx.await.map_err(|e| format!("DB Actor не ответил: {}", e))?
    }

    pub async fn get_recent_messages(
        &self,
        channel_id: String,
        limit: i32,
    ) -> Result<Vec<Message>, String> {
        let (reply, rx) = oneshot::channel();
        self.sender
            .send(DbCommand::GetRecentMessages {
                channel_id,
                limit,
                reply,
            })
            .await
            .map_err(|e| format!("DB Actor недоступен: {}", e))?;
        rx.await.map_err(|e| format!("DB Actor не ответил: {}", e))?
    }

    pub async fn get_messages_since(
        &self,
        channel_id: String,
        since_id: String,
    ) -> Result<Vec<Message>, String> {
        let (reply, rx) = oneshot::channel();
        self.sender
            .send(DbCommand::GetMessagesSince {
                channel_id,
                since_id,
                reply,
            })
            .await
            .map_err(|e| format!("DB Actor недоступен: {}", e))?;
        rx.await.map_err(|e| format!("DB Actor не ответил: {}", e))?
    }
}
