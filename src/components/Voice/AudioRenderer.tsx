// Невидимый компонент для воспроизведения аудио от других пользователей

import { useEffect, useRef } from 'react';
import { useVoiceStore } from '../../stores/voiceStore';

export default function AudioRenderer() {
  const { remoteStreams, isDeafened } = useVoiceStore();

  return (
    <div style={{ display: 'none' }}>
      {Object.entries(remoteStreams).map(([userId, stream]) => (
        <AudioPlayer key={userId} stream={stream} muted={isDeafened} />
      ))}
    </div>
  );
}

function AudioPlayer({ stream, muted }: { stream: MediaStream; muted: boolean }) {
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.srcObject = stream;
    }
  }, [stream]);

  return <audio ref={audioRef} autoPlay muted={muted} />;
}
