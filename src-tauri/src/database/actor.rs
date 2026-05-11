// DB Actor — один поток, который монопольно владеет SQLite-подключением.
// Все WS-клиенты общаются с ним через tokio::sync::mpsc каналы.
// Это решает проблему Arc<Mutex<Connection>> — БД никогда не блокируется.

use rusqlite::{Connection, params};
use tokio::sync::mpsc;
use crate::database::{DbCommand, User, Channel, Message};

/// Инициализирует SQLite базу данных и создаёт таблицы
fn init_database(db_path: &str) -> Result<Connection, String> {
    let conn = Connection::open(db_path)
        .map_err(|e| format!("Не удалось открыть БД: {}", e))?;

    // Включаем WAL-режим для лучшей производительности
    conn.execute_batch("PRAGMA journal_mode=WAL;")
        .map_err(|e| format!("Ошибка PRAGMA: {}", e))?;

    // Создаём таблицы
    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS users (
            id          TEXT PRIMARY KEY,
            username    TEXT NOT NULL UNIQUE,
            display_name TEXT NOT NULL,
            avatar_color TEXT DEFAULT '#7C6AEF'
        );

        CREATE TABLE IF NOT EXISTS channels (
            id          TEXT PRIMARY KEY,
            name        TEXT NOT NULL,
            description TEXT DEFAULT '',
            position    INTEGER DEFAULT 0,
            created_by  TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS messages (
            id           TEXT PRIMARY KEY,
            channel_id   TEXT NOT NULL,
            author_id    TEXT NOT NULL,
            content      TEXT NOT NULL,
            message_type TEXT DEFAULT 'text',
            file_path    TEXT,
            file_name    TEXT,
            file_size    INTEGER,
            created_at   TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_messages_channel
            ON messages(channel_id, created_at);
        "
    )
    .map_err(|e| format!("Ошибка создания таблиц: {}", e))?;

    // Создаём канал #general если его ещё нет
    let count: i32 = conn
        .query_row("SELECT COUNT(*) FROM channels", [], |row| row.get(0))
        .unwrap_or(0);

    if count == 0 {
        conn.execute(
            "INSERT INTO channels (id, name, description, position, created_by)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![
                "general",
                "general",
                "Основной канал для общения",
                0,
                "system"
            ],
        )
        .map_err(|e| format!("Ошибка создания #general: {}", e))?;
    }

    Ok(conn)
}

/// Запускает DB Actor — бесконечный цикл обработки команд
pub async fn run_db_actor(db_path: String, mut rx: mpsc::Receiver<DbCommand>) {
    // Инициализируем БД в отдельном потоке (rusqlite — синхронная библиотека)
    let conn = match init_database(&db_path) {
        Ok(c) => c,
        Err(e) => {
            eprintln!("FATAL: Не удалось инициализировать БД: {}", e);
            return;
        }
    };

    println!("[DB Actor] Запущен, БД: {}", db_path);

    // Основной цикл — читаем команды из канала и выполняем их
    while let Some(cmd) = rx.recv().await {
        match cmd {
            // === Пользователи ===
            DbCommand::CreateUser { user, reply } => {
                let result = conn.execute(
                    "INSERT OR REPLACE INTO users (id, username, display_name, avatar_color)
                     VALUES (?1, ?2, ?3, ?4)",
                    params![user.id, user.username, user.display_name, user.avatar_color],
                );
                let _ = reply.send(result.map(|_| ()).map_err(|e| e.to_string()));
            }

            DbCommand::RemoveUser { user_id, reply } => {
                let result = conn.execute(
                    "DELETE FROM users WHERE id = ?1",
                    params![user_id],
                );
                let _ = reply.send(result.map(|_| ()).map_err(|e| e.to_string()));
            }

            DbCommand::GetAllUsers { reply } => {
                let result = (|| {
                    let mut stmt = conn.prepare(
                        "SELECT id, username, display_name, avatar_color FROM users"
                    ).map_err(|e| e.to_string())?;
                    let users = stmt
                        .query_map([], |row| {
                            Ok(User {
                                id: row.get(0)?,
                                username: row.get(1)?,
                                display_name: row.get(2)?,
                                avatar_color: row.get(3)?,
                            })
                        })
                        .map_err(|e| e.to_string())?
                        .filter_map(|r| r.ok())
                        .collect::<Vec<_>>();
                    Ok(users)
                })();
                let _ = reply.send(result);
            }

            // === Каналы ===
            DbCommand::CreateChannel { channel, reply } => {
                let result = conn.execute(
                    "INSERT INTO channels (id, name, description, position, created_by)
                     VALUES (?1, ?2, ?3, ?4, ?5)",
                    params![
                        channel.id,
                        channel.name,
                        channel.description,
                        channel.position,
                        channel.created_by
                    ],
                );
                let _ = reply.send(result.map(|_| ()).map_err(|e| e.to_string()));
            }

            DbCommand::DeleteChannel { channel_id, reply } => {
                let result = (|| {
                    conn.execute(
                        "DELETE FROM messages WHERE channel_id = ?1",
                        params![channel_id],
                    ).map_err(|e| e.to_string())?;
                    conn.execute(
                        "DELETE FROM channels WHERE id = ?1",
                        params![channel_id],
                    ).map_err(|e| e.to_string())?;
                    Ok(())
                })();
                let _ = reply.send(result);
            }

            DbCommand::GetAllChannels { reply } => {
                let result = (|| {
                    let mut stmt = conn.prepare(
                        "SELECT id, name, description, position, created_by
                         FROM channels ORDER BY position ASC"
                    ).map_err(|e| e.to_string())?;
                    let channels = stmt
                        .query_map([], |row| {
                            Ok(Channel {
                                id: row.get(0)?,
                                name: row.get(1)?,
                                description: row.get(2)?,
                                position: row.get(3)?,
                                created_by: row.get(4)?,
                            })
                        })
                        .map_err(|e| e.to_string())?
                        .filter_map(|r| r.ok())
                        .collect::<Vec<_>>();
                    Ok(channels)
                })();
                let _ = reply.send(result);
            }

            DbCommand::GetChannelCount { reply } => {
                let result = conn
                    .query_row("SELECT COUNT(*) FROM channels", [], |row| row.get(0))
                    .map_err(|e| e.to_string());
                let _ = reply.send(result);
            }

            // === Сообщения ===
            DbCommand::SaveMessage { message, reply } => {
                let result = conn.execute(
                    "INSERT INTO messages (id, channel_id, author_id, content, message_type, file_path, file_name, file_size, created_at)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
                    params![
                        message.id,
                        message.channel_id,
                        message.author_id,
                        message.content,
                        message.message_type,
                        message.file_path,
                        message.file_name,
                        message.file_size,
                        message.created_at
                    ],
                );
                let _ = reply.send(result.map(|_| ()).map_err(|e| e.to_string()));
            }

            DbCommand::GetRecentMessages {
                channel_id,
                limit,
                reply,
            } => {
                let result = (|| {
                    let mut stmt = conn.prepare(
                        "SELECT id, channel_id, author_id, content, message_type,
                                file_path, file_name, file_size, created_at
                         FROM messages
                         WHERE channel_id = ?1
                         ORDER BY created_at DESC
                         LIMIT ?2"
                    ).map_err(|e| e.to_string())?;
                    let mut messages: Vec<Message> = stmt
                        .query_map(params![channel_id, limit], |row| {
                            Ok(Message {
                                id: row.get(0)?,
                                channel_id: row.get(1)?,
                                author_id: row.get(2)?,
                                content: row.get(3)?,
                                message_type: row.get(4)?,
                                file_path: row.get(5)?,
                                file_name: row.get(6)?,
                                file_size: row.get(7)?,
                                created_at: row.get(8)?,
                            })
                        })
                        .map_err(|e| e.to_string())?
                        .filter_map(|r| r.ok())
                        .collect();
                    // Переворачиваем — от старых к новым
                    messages.reverse();
                    Ok(messages)
                })();
                let _ = reply.send(result);
            }

            DbCommand::GetMessagesSince {
                channel_id,
                since_id,
                reply,
            } => {
                let result = (|| {
                    // Находим timestamp сообщения с данным ID
                    let since_time: String = conn
                        .query_row(
                            "SELECT created_at FROM messages WHERE id = ?1",
                            params![since_id],
                            |row| row.get(0),
                        )
                        .map_err(|e| e.to_string())?;

                    let mut stmt = conn.prepare(
                        "SELECT id, channel_id, author_id, content, message_type,
                                file_path, file_name, file_size, created_at
                         FROM messages
                         WHERE channel_id = ?1 AND created_at > ?2
                         ORDER BY created_at ASC"
                    ).map_err(|e| e.to_string())?;
                    let messages = stmt
                        .query_map(params![channel_id, since_time], |row| {
                            Ok(Message {
                                id: row.get(0)?,
                                channel_id: row.get(1)?,
                                author_id: row.get(2)?,
                                content: row.get(3)?,
                                message_type: row.get(4)?,
                                file_path: row.get(5)?,
                                file_name: row.get(6)?,
                                file_size: row.get(7)?,
                                created_at: row.get(8)?,
                            })
                        })
                        .map_err(|e| e.to_string())?
                        .filter_map(|r| r.ok())
                        .collect();
                    Ok(messages)
                })();
                let _ = reply.send(result);
            }
        }
    }

    println!("[DB Actor] Остановлен");
}
