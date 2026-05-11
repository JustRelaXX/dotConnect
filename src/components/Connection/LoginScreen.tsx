// Экран входа — ввод никнейма

import { useState } from 'react';
import { useUserStore } from '../../stores/userStore';

export default function LoginScreen() {
  const { setScreen, setUsername, setDisplayName } = useUserStore();
  const [name, setName] = useState('');
  const [nick, setNick] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !nick.trim()) return;
    setUsername(nick.trim().toLowerCase().replace(/\s/g, '_'));
    setDisplayName(name.trim());
    setScreen('choice');
  };

  return (
    <div className="screen-container">
      <form className="screen-card" onSubmit={handleSubmit}>
        <h1>dotConnect</h1>
        <p className="subtitle">Мессенджер для тебя и друзей</p>

        <div className="form-group">
          <label>Отображаемое имя</label>
          <input
            type="text"
            placeholder="Как тебя зовут?"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={32}
            autoFocus
          />
        </div>

        <div className="form-group">
          <label>Никнейм</label>
          <input
            type="text"
            placeholder="username (без пробелов)"
            value={nick}
            onChange={(e) => setNick(e.target.value.replace(/\s/g, '_'))}
            maxLength={20}
          />
        </div>

        <button
          type="submit"
          className="btn btn-primary"
          disabled={!name.trim() || !nick.trim()}
        >
          Продолжить
        </button>
      </form>
    </div>
  );
}
