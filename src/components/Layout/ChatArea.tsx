// ChatArea — центральная область чата

import { useEffect, useRef } from 'react';
import { useChatStore } from '../../stores/chatStore';
import { useUserStore } from '../../stores/userStore';
import InputBar from './InputBar';
import ScreenShareView from '../Voice/ScreenShareView';

export default function ChatArea() {
  const { activeChannelId, channels, messagesByChannel, typingUsers } = useChatStore();
  const { onlineUsers, currentUser } = useUserStore();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const activeChannel = channels.find((c) => c.id === activeChannelId);
  const messages = messagesByChannel[activeChannelId] || [];
  const typing = typingUsers[activeChannelId] || [];

  // Авто-скролл к последнему сообщению
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // Получаем имена печатающих (исключая себя)
  const typingNames = typing
    .filter((id) => id !== currentUser?.id)
    .map((id) => {
      const user = onlineUsers.find((u) => u.id === id);
      return user?.display_name || 'Кто-то';
    });

  const formatTime = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleTimeString('ru-RU', {
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '';
    }
  };

  return (
    <div className="chat-area">
      {/* Заголовок канала */}
      <div className="chat-header">
        <span className="hash">#</span>
        <h3>{activeChannel?.name || 'general'}</h3>
        {activeChannel?.description && (
          <span className="description">{activeChannel.description}</span>
        )}
      </div>

      <ScreenShareView />

      {/* Список сообщений */}
      <div className="message-list">
        {messages.length === 0 ? (
          <div className="empty-chat">
            <span className="emoji">💬</span>
            <p>Это начало канала #{activeChannel?.name || 'general'}</p>
            <p style={{ fontSize: 12 }}>Напиши первое сообщение!</p>
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className="message-group">
              <div
                className="message-avatar"
                style={{
                  background: msg.author_color || '#7C6AEF',
                }}
              >
                {(msg.author_name || msg.author_username || '?').charAt(0).toUpperCase()}
              </div>
              <div className="message-content">
                <div className="message-header">
                  <span className="message-author" style={{ color: msg.author_color || '#7C6AEF' }}>
                    {msg.author_name || msg.author_username || 'Unknown'}
                  </span>
                  <span className="message-time">{formatTime(msg.created_at)}</span>
                </div>
                <div className="message-text">{msg.content}</div>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Typing indicator */}
      <div className="typing-indicator">
        {typingNames.length > 0 && (
          <span>
            <strong>{typingNames.join(', ')}</strong>
            {typingNames.length === 1 ? ' печатает...' : ' печатают...'}
          </span>
        )}
      </div>

      {/* Ввод сообщения */}
      <InputBar />
    </div>
  );
}
