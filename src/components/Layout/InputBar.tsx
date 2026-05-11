// InputBar — поле ввода сообщений

import { useState, useRef } from 'react';
import { useWebSocket } from '../../hooks/useWebSocket';
import { useChatStore } from '../../stores/chatStore';

export default function InputBar() {
  const [text, setText] = useState('');
  const { sendMessage, sendTyping } = useWebSocket();
  const { activeChannelId, channels } = useChatStore();
  const lastTypingRef = useRef(0);

  const activeChannel = channels.find((c) => c.id === activeChannelId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    sendMessage(activeChannelId, text.trim());
    setText('');
  };

  const handleInput = (value: string) => {
    setText(value);

    // Отправляем typing не чаще раз в 2 секунды
    const now = Date.now();
    if (now - lastTypingRef.current > 2000) {
      sendTyping(activeChannelId);
      lastTypingRef.current = now;
    }
  };

  return (
    <div className="input-area">
      <form className="input-wrapper" onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder={`Написать в #${activeChannel?.name || 'general'}...`}
          value={text}
          onChange={(e) => handleInput(e.target.value)}
          maxLength={2000}
        />
      </form>
    </div>
  );
}
