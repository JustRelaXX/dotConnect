// Экран хоста — создание комнаты (запуск сервера)

import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useUserStore } from '../../stores/userStore';
import { useConnectionStore } from '../../stores/connectionStore';
import { useWebSocket } from '../../hooks/useWebSocket';

export default function HostScreen() {
  const { setScreen, username, displayName } = useUserStore();
  const { setServerInfo, setRoomPassword, serverPort, setErrorMessage, errorMessage } = useConnectionStore();
  const { connect } = useWebSocket();

  const [port, setPort] = useState(String(serverPort || 9150));
  const [password, setPassword] = useState('');
  const [serverIp, setServerIpLocal] = useState('');
  const [isStarting, setIsStarting] = useState(false);
  const [isStarted, setIsStarted] = useState(false);

  const handleStart = async () => {
    setIsStarting(true);
    setErrorMessage('');

    try {
      const resultStr = await invoke<string>('start_server', {
        port: parseInt(port),
        roomPassword: password,
      });
      const result = JSON.parse(resultStr);

      setServerIpLocal(result.ip);
      setServerInfo(result.ip, parseInt(port));
      setRoomPassword(password);
      setIsStarted(true);

      // Подключаемся к собственному серверу
      setTimeout(() => {
        connect('127.0.0.1', parseInt(port), username, displayName, password);
      }, 500);
    } catch (e: any) {
      setErrorMessage(e.toString());
    } finally {
      setIsStarting(false);
    }
  };

  return (
    <div className="screen-container">
      <div className="screen-card">
        <h1>Создать комнату</h1>
        <p className="subtitle">Друзья подключатся по твоему IP</p>

        {!isStarted ? (
          <>
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
              <label>Пароль комнаты (необязательно)</label>
              <input
                type="password"
                placeholder="Оставь пустым, если без пароля"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <button
              className="btn btn-primary"
              onClick={handleStart}
              disabled={isStarting}
            >
              {isStarting ? 'Запускаю...' : '🚀 Запустить сервер'}
            </button>
          </>
        ) : (
          <div className="server-info">
            <p style={{ color: 'var(--success)', fontWeight: 600 }}>
              ✅ Сервер запущен!
            </p>
            <div className="ip-display">{serverIp}</div>
            <p className="port-display">Порт: {port}</p>
            <p style={{ marginTop: 12, fontSize: 12, color: 'var(--text-muted)' }}>
              Отправь этот IP друзьям для подключения
            </p>
          </div>
        )}

        {errorMessage && <p className="error-text">{errorMessage}</p>}

        <button className="back-link" onClick={() => setScreen('choice')}>
          ← Назад
        </button>
      </div>
    </div>
  );
}
