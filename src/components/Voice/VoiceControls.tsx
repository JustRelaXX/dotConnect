// Панель управления голосом (микрофон, звук, выход)

import { useVoiceStore } from '../../stores/voiceStore';
import { useWebSocket } from '../../hooks/useWebSocket';

export default function VoiceControls() {
  const {
    activeVoiceChannel,
    isMuted,
    isDeafened,
    setIsMuted,
    setIsDeafened,
    setActiveVoiceChannel,
    localScreenStream,
    setLocalScreenStream,
  } = useVoiceStore();
  const { sendJson } = useWebSocket();

  if (!activeVoiceChannel) return null;

  const toggleMute = () => {
    setIsMuted(!isMuted);
    // Отправляем всем наш новый статус
    sendJson('voice_state_update', { is_muted: !isMuted, is_deafened: isDeafened });
  };

  const toggleDeafen = () => {
    const newDeafened = !isDeafened;
    setIsDeafened(newDeafened);
    // Если мы выключили звук, логично выключить и микрофон (как в Discord)
    if (newDeafened) {
      setIsMuted(true);
      sendJson('voice_state_update', { is_muted: true, is_deafened: true });
    } else {
      sendJson('voice_state_update', { is_muted: isMuted, is_deafened: false });
    }
  };

  const toggleScreenShare = async () => {
    if (localScreenStream) {
      // Останавливаем стрим
      localScreenStream.getTracks().forEach((track) => track.stop());
      setLocalScreenStream(null);
      sendJson('stop_screen_share', {});
    } else {
      // Запускаем стрим
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        // Если пользователь сам закроет доступ через браузерную плашку "Закрыть доступ"
        stream.getVideoTracks()[0].onended = () => {
          setLocalScreenStream(null);
          sendJson('stop_screen_share', {});
        };
        setLocalScreenStream(stream);
        sendJson('start_screen_share', {});
      } catch (e) {
        console.error('Ошибка доступа к экрану:', e);
      }
    }
  };

  const leaveVoice = () => {
    if (localScreenStream) {
      localScreenStream.getTracks().forEach((track) => track.stop());
      setLocalScreenStream(null);
      sendJson('stop_screen_share', {});
    }
    sendJson('leave_voice', { channel_id: activeVoiceChannel });
    setActiveVoiceChannel(null);
  };

  return (
    <div className="voice-controls">
      <div className="voice-status">
        <div className="voice-status-text">Голосовой канал подключен</div>
        <div className="voice-status-channel">General Voice</div>
      </div>
      <div className="voice-actions">
        <button
          className={`icon-btn ${isMuted ? 'danger' : ''}`}
          onClick={toggleMute}
          title={isMuted ? 'Включить микрофон' : 'Выключить микрофон'}
        >
          {isMuted ? '🔇' : '🎙️'}
        </button>
        <button
          className={`icon-btn ${isDeafened ? 'danger' : ''}`}
          onClick={toggleDeafen}
          title={isDeafened ? 'Включить звук' : 'Отключить звук'}
        >
          {isDeafened ? '🎧❌' : '🎧'}
        </button>
        <button
          className={`icon-btn ${localScreenStream ? 'active-share' : ''}`}
          onClick={toggleScreenShare}
          title={localScreenStream ? 'Остановить стрим' : 'Стрим экрана'}
          style={localScreenStream ? { color: 'var(--success)' } : {}}
        >
          📺
        </button>
        <button className="icon-btn danger" onClick={leaveVoice} title="Отключиться">
          ✖
        </button>
      </div>
    </div>
  );
}
