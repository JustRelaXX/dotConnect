// Экран подключения — ввод IP и подключение к серверу

import { useState } from 'react';
import { useUserStore } from '../../stores/userStore';
import { useConnectionStore } from '../../stores/connectionStore';
import { useWebSocket } from '../../hooks/useWebSocket';

export default function JoinScreen() {
  const { setScreen, username, displayName } = useUserStore();
  const { status, errorMessage, setErrorMessage } = useConnectionStore();
  const { connect } = useWebSocket();

  const [ip, setIp] = useState('');
  const [port, setPort] = useState('9150');
  const [password, setPassword] = useState('');

  const handleJoin = () => {
    if (!ip.trim()) {
      setErrorMessage('Введи IP-адрес');
      return;
    }
    setErrorMessage('');
    connect(ip.trim(), parseInt(port), username, displayName, password);
  };

  const isConnecting = status === 'connecting';

  return (
    <div className="screen-container">
      <form
        className="screen-card"
        onSubmit={(e) => {
          e.preventDefault();
          handleJoin();
        }}
      >
        <h1>Подключиться</h1>
        <p className="subtitle">Введи IP-адрес сервера друга</p>

        <div className="form-group">
          <label>IP-адрес</label>
          <input
            type="text"
            placeholder="192.168.1.100"
            value={ip}
            onChange={(e) => setIp(e.target.value)}
            autoFocus
          />
        </div>

        <div className="form-group">
          <label>Порт</label>
          <input
            type="number"
            placeholder="9150"
            value={port}
            onChange={(e) => setPort(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label>Пароль комнаты</label>
          <input
            type="password"
            placeholder="Если есть"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <button type="submit" className="btn btn-primary" disabled={isConnecting || !ip.trim()}>
          {isConnecting ? 'Подключение...' : '🔗 Подключиться'}
        </button>

        {errorMessage && <p className="error-text">{errorMessage}</p>}

        <button type="button" className="back-link" onClick={() => setScreen('choice')}>
          ← Назад
        </button>
      </form>
    </div>
  );
}
