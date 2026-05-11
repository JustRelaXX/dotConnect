// Хук для управления WebSocket-соединением
// Обрабатывает все входящие сообщения и обновляет stores

import { useCallback, useRef } from 'react';
import { useConnectionStore } from '../stores/connectionStore';
import { useUserStore } from '../stores/userStore';
import { useChatStore } from '../stores/chatStore';
import { useVoiceStore } from '../stores/voiceStore';
import { WSMessage } from '../types';

export function useWebSocket() {
  const typingTimers = useRef<Record<string, NodeJS.Timeout>>({});

  const { setWs, setStatus, setErrorMessage } = useConnectionStore();
  const { setCurrentUser, setOnlineUsers, addOnlineUser, removeOnlineUser, setScreen } =
    useUserStore();
  const {
    setChannels,
    setMessages,
    addMessage,
    addChannel,
    removeChannel,
    setTyping,
    clearTyping,
  } = useChatStore();

  const connect = useCallback(
    (ip: string, port: number, username: string, displayName: string, roomPassword: string) => {
      setStatus('connecting');
      setErrorMessage('');

      const wsUrl = `ws://${ip}:${port}`;
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('[WS] Подключено к', wsUrl);
        // Отправляем join
        ws.send(
          JSON.stringify({
            type: 'join',
            payload: {
              username,
              display_name: displayName,
              room_password: roomPassword,
            },
            timestamp: Date.now(),
          })
        );
      };

      ws.onmessage = (event) => {
        try {
          const msg: WSMessage = JSON.parse(event.data);
          handleMessage(msg);
        } catch (e) {
          console.error('[WS] Ошибка парсинга:', e);
        }
      };

      ws.onerror = () => {
        setStatus('error');
        setErrorMessage('Не удалось подключиться к серверу');
      };

      ws.onclose = () => {
        console.log('[WS] Соединение закрыто');
        setStatus('disconnected');
        setWs(null);
      };

      setWs(ws);

      function handleMessage(msg: WSMessage) {
        switch (msg.type) {
          case 'welcome': {
            const { user_id, channels, users, recent_messages } = msg.payload;
            setCurrentUser({
              id: user_id,
              username,
              display_name: displayName,
              avatar_color: '#7C6AEF',
            });
            setChannels(channels);
            setOnlineUsers(users);
            if (recent_messages && recent_messages.length > 0) {
              setMessages('general', recent_messages);
            }
            setStatus('connected');
            setScreen('chat');
            break;
          }

          case 'new_message': {
            const { message } = msg.payload;
            addMessage(message);
            // Очищаем typing для автора
            clearTyping(message.channel_id, message.author_id);
            break;
          }

          case 'user_joined': {
            const { user } = msg.payload;
            addOnlineUser(user);
            break;
          }

          case 'user_left': {
            const { user_id } = msg.payload;
            removeOnlineUser(user_id);
            break;
          }

          case 'channel_created': {
            const { channel } = msg.payload;
            addChannel(channel);
            break;
          }

          case 'channel_deleted': {
            const { channel_id } = msg.payload;
            removeChannel(channel_id);
            break;
          }

          case 'typing': {
            const { user_id, channel_id } = msg.payload;
            setTyping(channel_id, user_id);
            // Автоматически убираем через 3 секунды
            const key = `${channel_id}_${user_id}`;
            if (typingTimers.current[key]) {
              clearTimeout(typingTimers.current[key]);
            }
            typingTimers.current[key] = setTimeout(() => {
              clearTyping(channel_id, user_id);
              delete typingTimers.current[key];
            }, 3000);
            break;
          }

          case 'sync_response': {
            const { channel_id, messages } = msg.payload;
            if (messages && messages.length > 0) {
              const store = useChatStore.getState();
              store.appendMessages(channel_id, messages);
            }
            break;
          }

          case 'auth_error': {
            setStatus('error');
            setErrorMessage(msg.payload.reason || 'Ошибка аутентификации');
            break;
          }

          case 'error': {
            console.error('[WS] Ошибка сервера:', msg.payload);
            setErrorMessage(msg.payload.message || 'Ошибка сервера');
            break;
          }

          // === WebRTC Voice Signaling ===
          case 'join_voice': {
            const { sender_id, channel_id } = msg.payload;
            const currentUserId = useUserStore.getState().currentUser?.id;
            if (sender_id === currentUserId) break; // Ignore our own join

            const voiceStore = useVoiceStore.getState();
            if (voiceStore.activeVoiceChannel !== channel_id) break; // Not in this channel

            console.log(`[WebRTC] ${sender_id} joined voice, creating offer`);
            voiceStore.updateVoiceUser(sender_id, { isMuted: false, isDeafened: false });

            // Create peer connection
            const pc = new RTCPeerConnection({
              iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
            });
            if (voiceStore.localStream) {
              voiceStore.localStream
                .getTracks()
                .forEach((track) => pc.addTrack(track, voiceStore.localStream!));
            }

            pc.onicecandidate = (event) => {
              if (event.candidate) {
                ws.send(
                  JSON.stringify({
                    type: 'webrtc_ice_candidate',
                    payload: { target_id: sender_id, candidate: event.candidate },
                    timestamp: Date.now(),
                  })
                );
              }
            };

            pc.ontrack = (event) => {
              useVoiceStore.getState().addRemoteStream(sender_id, event.streams[0]);
            };

            voiceStore.addPeer(sender_id, pc);

            // Create offer
            pc.createOffer()
              .then((offer) => {
                return pc.setLocalDescription(offer);
              })
              .then(() => {
                ws.send(
                  JSON.stringify({
                    type: 'webrtc_offer',
                    payload: { target_id: sender_id, offer: pc.localDescription },
                    timestamp: Date.now(),
                  })
                );
              });
            break;
          }

          case 'leave_voice': {
            const { sender_id } = msg.payload;
            const voiceStore = useVoiceStore.getState();
            voiceStore.removePeer(sender_id);
            voiceStore.removeRemoteStream(sender_id);
            voiceStore.removeVoiceUser(sender_id);
            break;
          }

          case 'webrtc_offer': {
            const { sender_id, target_id, offer } = msg.payload;
            const currentUserId = useUserStore.getState().currentUser?.id;
            if (target_id !== currentUserId) break;

            console.log(`[WebRTC] Received offer from ${sender_id}`);
            const voiceStore = useVoiceStore.getState();

            const pc = new RTCPeerConnection({
              iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
            });
            if (voiceStore.localStream) {
              voiceStore.localStream
                .getTracks()
                .forEach((track) => pc.addTrack(track, voiceStore.localStream!));
            }

            pc.onicecandidate = (event) => {
              if (event.candidate) {
                ws.send(
                  JSON.stringify({
                    type: 'webrtc_ice_candidate',
                    payload: { target_id: sender_id, candidate: event.candidate },
                    timestamp: Date.now(),
                  })
                );
              }
            };

            pc.ontrack = (event) => {
              useVoiceStore.getState().addRemoteStream(sender_id, event.streams[0]);
            };

            voiceStore.addPeer(sender_id, pc);

            pc.setRemoteDescription(new RTCSessionDescription(offer))
              .then(() => pc.createAnswer())
              .then((answer) => pc.setLocalDescription(answer))
              .then(() => {
                ws.send(
                  JSON.stringify({
                    type: 'webrtc_answer',
                    payload: { target_id: sender_id, answer: pc.localDescription },
                    timestamp: Date.now(),
                  })
                );
              });
            break;
          }

          case 'webrtc_answer': {
            const { sender_id, target_id, answer } = msg.payload;
            const currentUserId = useUserStore.getState().currentUser?.id;
            if (target_id !== currentUserId) break;

            const voiceStore = useVoiceStore.getState();
            const pc = voiceStore.peers[sender_id];
            if (pc) {
              console.log(`[WebRTC] Received answer from ${sender_id}`);
              pc.setRemoteDescription(new RTCSessionDescription(answer)).catch(console.error);
            }
            break;
          }

          case 'webrtc_ice_candidate': {
            const { sender_id, target_id, candidate } = msg.payload;
            const currentUserId = useUserStore.getState().currentUser?.id;
            if (target_id !== currentUserId) break;

            const voiceStore = useVoiceStore.getState();
            const pc = voiceStore.peers[sender_id];
            if (pc) {
              pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(console.error);
            }
            break;
          }

          case 'voice_state_update': {
            const { sender_id, is_muted, is_deafened } = msg.payload;
            useVoiceStore
              .getState()
              .updateVoiceUser(sender_id, { isMuted: is_muted, isDeafened: is_deafened });
            break;
          }

          // === WebRTC Screen Signaling ===
          case 'start_screen_share': {
            const { sender_id } = msg.payload;
            const currentUserId = useUserStore.getState().currentUser?.id;
            if (sender_id === currentUserId) break;

            const voiceStore = useVoiceStore.getState();
            if (!voiceStore.activeVoiceChannel) break;

            console.log(`[WebRTC Screen] ${sender_id} started sharing screen, creating offer`);

            const pc = new RTCPeerConnection({
              iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
            });
            // For screen share, we only SEND our screen stream if WE are sharing.
            // When someone else starts sharing, we just want to RECEIVE it. We don't add local tracks here.

            pc.onicecandidate = (event) => {
              if (event.candidate) {
                ws.send(
                  JSON.stringify({
                    type: 'webrtc_screen_ice',
                    payload: { target_id: sender_id, candidate: event.candidate },
                    timestamp: Date.now(),
                  })
                );
              }
            };

            pc.ontrack = (event) => {
              useVoiceStore.getState().addRemoteScreenStream(sender_id, event.streams[0]);
            };

            voiceStore.addScreenPeer(sender_id, pc);

            // Create offer (recvonly since we are just watching)
            pc.addTransceiver('video', { direction: 'recvonly' });
            pc.createOffer()
              .then((offer) => {
                return pc.setLocalDescription(offer);
              })
              .then(() => {
                ws.send(
                  JSON.stringify({
                    type: 'webrtc_screen_offer',
                    payload: { target_id: sender_id, offer: pc.localDescription },
                    timestamp: Date.now(),
                  })
                );
              });
            break;
          }

          case 'stop_screen_share': {
            const { sender_id } = msg.payload;
            const voiceStore = useVoiceStore.getState();
            voiceStore.removeScreenPeer(sender_id);
            voiceStore.removeRemoteScreenStream(sender_id);
            break;
          }

          case 'webrtc_screen_offer': {
            const { sender_id, target_id, offer } = msg.payload;
            const currentUserId = useUserStore.getState().currentUser?.id;
            if (target_id !== currentUserId) break;

            console.log(`[WebRTC Screen] Received offer from ${sender_id}`);
            const voiceStore = useVoiceStore.getState();

            const pc = new RTCPeerConnection({
              iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
            });

            // We only add our local screen stream to the PC when we RECEIVE an offer from a viewer
            if (voiceStore.localScreenStream) {
              voiceStore.localScreenStream
                .getTracks()
                .forEach((track) => pc.addTrack(track, voiceStore.localScreenStream!));
            }

            pc.onicecandidate = (event) => {
              if (event.candidate) {
                ws.send(
                  JSON.stringify({
                    type: 'webrtc_screen_ice',
                    payload: { target_id: sender_id, candidate: event.candidate },
                    timestamp: Date.now(),
                  })
                );
              }
            };

            pc.ontrack = (event) => {
              useVoiceStore.getState().addRemoteScreenStream(sender_id, event.streams[0]);
            };

            voiceStore.addScreenPeer(sender_id, pc);

            pc.setRemoteDescription(new RTCSessionDescription(offer))
              .then(() => pc.createAnswer())
              .then((answer) => pc.setLocalDescription(answer))
              .then(() => {
                ws.send(
                  JSON.stringify({
                    type: 'webrtc_screen_answer',
                    payload: { target_id: sender_id, answer: pc.localDescription },
                    timestamp: Date.now(),
                  })
                );
              });
            break;
          }

          case 'webrtc_screen_answer': {
            const { sender_id, target_id, answer } = msg.payload;
            const currentUserId = useUserStore.getState().currentUser?.id;
            if (target_id !== currentUserId) break;

            const voiceStore = useVoiceStore.getState();
            const pc = voiceStore.screenPeers[sender_id];
            if (pc) {
              console.log(`[WebRTC Screen] Received answer from ${sender_id}`);
              pc.setRemoteDescription(new RTCSessionDescription(answer)).catch(console.error);
            }
            break;
          }

          case 'webrtc_screen_ice': {
            const { sender_id, target_id, candidate } = msg.payload;
            const currentUserId = useUserStore.getState().currentUser?.id;
            if (target_id !== currentUserId) break;

            const voiceStore = useVoiceStore.getState();
            const pc = voiceStore.screenPeers[sender_id];
            if (pc) {
              pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(console.error);
            }
            break;
          }

          default:
            console.log('[WS] Неизвестный тип:', msg.type);
        }
      }
    },
    [
      setWs,
      setStatus,
      setErrorMessage,
      setCurrentUser,
      setOnlineUsers,
      addOnlineUser,
      removeOnlineUser,
      setScreen,
      setChannels,
      setMessages,
      addMessage,
      addChannel,
      removeChannel,
      setTyping,
      clearTyping,
    ]
  );

  const sendMessage = useCallback((channelId: string, content: string) => {
    const ws = useConnectionStore.getState().ws;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    ws.send(
      JSON.stringify({
        type: 'send_message',
        payload: { channel_id: channelId, content },
        timestamp: Date.now(),
      })
    );
  }, []);

  const sendTyping = useCallback((channelId: string) => {
    const ws = useConnectionStore.getState().ws;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    ws.send(
      JSON.stringify({
        type: 'typing_start',
        payload: { channel_id: channelId },
        timestamp: Date.now(),
      })
    );
  }, []);

  const sendJson = useCallback((type: string, payload: any) => {
    const ws = useConnectionStore.getState().ws;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    ws.send(
      JSON.stringify({
        type,
        payload,
        timestamp: Date.now(),
      })
    );
  }, []);

  const disconnect = useCallback(() => {
    const ws = useConnectionStore.getState().ws;
    if (ws) {
      ws.close();
      setWs(null);
    }
    setStatus('disconnected');

    // Clear voice state on disconnect
    useVoiceStore.getState().clearPeers();
    useVoiceStore.getState().clearRemoteStreams();
    useVoiceStore.getState().setActiveVoiceChannel(null);
  }, [setWs, setStatus]);

  return { connect, sendMessage, sendTyping, sendJson, disconnect };
}
