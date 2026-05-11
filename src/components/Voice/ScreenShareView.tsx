// Компонент для отображения трансляций экрана (своей и чужих)

import { useEffect, useRef } from 'react';
import { useVoiceStore } from '../../stores/voiceStore';

export default function ScreenShareView() {
  const { localScreenStream, remoteScreenStreams } = useVoiceStore();

  const streams = [
    ...(localScreenStream ? [{ id: 'local', stream: localScreenStream, isLocal: true }] : []),
    ...Object.entries(remoteScreenStreams).map(([id, stream]) => ({ id, stream, isLocal: false })),
  ];

  if (streams.length === 0) return null;

  return (
    <div className="screen-share-grid">
      {streams.map(({ id, stream, isLocal }) => (
        <div key={id} className="screen-share-container">
          <VideoPlayer stream={stream} muted={isLocal} />
          <div className="screen-share-label">{isLocal ? 'Ваш стрим' : `Стрим: ${id}`}</div>
        </div>
      ))}
    </div>
  );
}

function VideoPlayer({ stream, muted }: { stream: MediaStream; muted: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return <video ref={videoRef} autoPlay playsInline muted={muted} />;
}
