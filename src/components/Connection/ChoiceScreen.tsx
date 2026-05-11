// Экран выбора — Host или Join

import { useUserStore } from '../../stores/userStore';
import { useConnectionStore } from '../../stores/connectionStore';

export default function ChoiceScreen() {
  const { setScreen } = useUserStore();
  const { setIsHost } = useConnectionStore();

  return (
    <div className="screen-container">
      <div className="screen-card">
        <h1>dotConnect</h1>
        <p className="subtitle">Выбери режим подключения</p>

        <div className="choice-buttons">
          <button
            className="choice-btn"
            onClick={() => {
              setIsHost(true);
              setScreen('host');
            }}
          >
            <h3>🖥️ Создать комнату</h3>
            <p>Запустить сервер — друзья подключатся к тебе</p>
          </button>

          <button
            className="choice-btn"
            onClick={() => {
              setIsHost(false);
              setScreen('join');
            }}
          >
            <h3>🔗 Подключиться</h3>
            <p>Присоединиться к другу по IP-адресу</p>
          </button>
        </div>

        <button className="back-link" onClick={() => setScreen('login')}>
          ← Назад
        </button>
      </div>
    </div>
  );
}
