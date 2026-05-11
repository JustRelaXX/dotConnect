// Sidebar — панель каналов (левая колонка)

import { useChatStore } from '../../stores/chatStore';
import { useConnectionStore } from '../../stores/connectionStore';
import { useVoiceStore } from '../../stores/voiceStore';
import { useWebSocket } from '../../hooks/useWebSocket';
import VoiceControls from '../Voice/VoiceControls';
import AudioRenderer from '../Voice/AudioRenderer';
import { useState } from 'react';

export default function Sidebar() {
  const { channels, activeChannelId, setActiveChannel } = useChatStore();
  const { serverIp, serverPort } = useConnectionStore();
  const { activeVoiceChannel, setActiveVoiceChannel, setLocalStream, voiceUsers } = useVoiceStore();
  const { sendJson } = useWebSocket();
  const [copied, setCopied] = useState(false);

  const handleJoinVoice = async (channelId: string) => {
    if (activeVoiceChannel === channelId) return; // Already joined

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setLocalStream(stream);
      setActiveVoiceChannel(channelId);
      sendJson('join_voice', { channel_id: channelId });
    } catch (e) {
      console.error('Failed to get microphone access:', e);
      alert('Нет доступа к микрофону. Разреши доступ в браузере/системе.');
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(`${serverIp}:${serverPort}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h2>dotConnect</h2>
      </div>

      {serverIp && (
        <div className="sidebar-connection-info" onClick={handleCopy} title="Нажми, чтобы скопировать">
          <div className="info-row">
            <span className="label">IP:</span>
            <span className="value">{serverIp}:{serverPort}</span>
          </div>
          <div className="copy-hint">{copied ? 'Скопировано!' : 'Копировать адрес'}</div>
        </div>
      )}

      <div className="channel-list">
        <div className="channel-category">Текстовые каналы</div>

        {channels.map((channel) => (
          <div
            key={channel.id}
            className={`channel-item ${activeChannelId === channel.id ? 'active' : ''}`}
            onClick={() => setActiveChannel(channel.id)}
          >
            <span className="hash">#</span>
            <span>{channel.name}</span>
          </div>
        ))}

        <div className="channel-category" style={{ marginTop: '16px' }}>Голосовые каналы</div>
        
        {/* Hardcoded General Voice Channel for now */}
        <div
          className={`channel-item voice-channel ${activeVoiceChannel === 'general_voice' ? 'active' : ''}`}
          onClick={() => handleJoinVoice('general_voice')}
        >
          <span className="hash">🔊</span>
          <span>General Voice</span>
        </div>

        {/* Display users in the voice channel if we are viewing it or connected to it */}
        <div className="voice-users-list">
          {Object.values(voiceUsers).map((u) => {
            return (
              <div key={u.id} className="voice-user-item">
                <div className="voice-user-avatar">
                  {/* We could lookup actual avatar color from userStore, using simple circle for now */}
                </div>
                <span className="voice-user-name">{u.id === useConnectionStore.getState().ws?.url ? 'Loading...' : u.id}</span>
                <div className="voice-user-status">
                  {u.isMuted && <span title="Микрофон выключен">🔇</span>}
                  {u.isDeafened && <span title="Звук отключен">🎧❌</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <VoiceControls />
      <AudioRenderer />
    </div>
  );
}
