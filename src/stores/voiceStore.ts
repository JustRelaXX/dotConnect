// Zustand store для управления голосовым каналом (WebRTC)

import { create } from 'zustand';

export interface VoiceUser {
  id: string;
  isMuted: boolean;
  isDeafened: boolean;
}

interface VoiceState {
  activeVoiceChannel: string | null;
  setActiveVoiceChannel: (channelId: string | null) => void;

  localStream: MediaStream | null;
  setLocalStream: (stream: MediaStream | null) => void;

  peers: Record<string, RTCPeerConnection>;
  addPeer: (userId: string, peer: RTCPeerConnection) => void;
  removePeer: (userId: string) => void;
  clearPeers: () => void;

  remoteStreams: Record<string, MediaStream>;
  addRemoteStream: (userId: string, stream: MediaStream) => void;
  removeRemoteStream: (userId: string) => void;
  clearRemoteStreams: () => void;

  localScreenStream: MediaStream | null;
  setLocalScreenStream: (stream: MediaStream | null) => void;

  screenPeers: Record<string, RTCPeerConnection>;
  addScreenPeer: (userId: string, peer: RTCPeerConnection) => void;
  removeScreenPeer: (userId: string) => void;
  clearScreenPeers: () => void;

  remoteScreenStreams: Record<string, MediaStream>;
  addRemoteScreenStream: (userId: string, stream: MediaStream) => void;
  removeRemoteScreenStream: (userId: string) => void;
  clearRemoteScreenStreams: () => void;

  isMuted: boolean;
  setIsMuted: (muted: boolean) => void;

  isDeafened: boolean;
  setIsDeafened: (deafened: boolean) => void;

  voiceUsers: Record<string, VoiceUser>;
  updateVoiceUser: (userId: string, data: Partial<VoiceUser>) => void;
  removeVoiceUser: (userId: string) => void;
  clearVoiceUsers: () => void;
}

export const useVoiceStore = create<VoiceState>((set, get) => ({
  activeVoiceChannel: null,
  setActiveVoiceChannel: (channelId) => set({ activeVoiceChannel: channelId }),

  localStream: null,
  setLocalStream: (stream) => {
    // Останавливаем старый стрим при замене
    const oldStream = get().localStream;
    if (oldStream && oldStream !== stream) {
      oldStream.getTracks().forEach(track => track.stop());
    }
    set({ localStream: stream });
  },

  peers: {},
  addPeer: (userId, peer) => set((state) => ({ peers: { ...state.peers, [userId]: peer } })),
  removePeer: (userId) => set((state) => {
    const newPeers = { ...state.peers };
    if (newPeers[userId]) {
      newPeers[userId].close();
      delete newPeers[userId];
    }
    return { peers: newPeers };
  }),
  clearPeers: () => set((state) => {
    Object.values(state.peers).forEach(peer => peer.close());
    return { peers: {} };
  }),

  remoteStreams: {},
  addRemoteStream: (userId, stream) => set((state) => ({ remoteStreams: { ...state.remoteStreams, [userId]: stream } })),
  removeRemoteStream: (userId) => set((state) => {
    const newStreams = { ...state.remoteStreams };
    delete newStreams[userId];
    return { remoteStreams: newStreams };
  }),
  clearRemoteStreams: () => set({ remoteStreams: {} }),

  localScreenStream: null,
  setLocalScreenStream: (stream) => {
    const oldStream = get().localScreenStream;
    if (oldStream && oldStream !== stream) {
      oldStream.getTracks().forEach(track => track.stop());
    }
    set({ localScreenStream: stream });
  },

  screenPeers: {},
  addScreenPeer: (userId, peer) => set((state) => ({ screenPeers: { ...state.screenPeers, [userId]: peer } })),
  removeScreenPeer: (userId) => set((state) => {
    const newPeers = { ...state.screenPeers };
    if (newPeers[userId]) {
      newPeers[userId].close();
      delete newPeers[userId];
    }
    return { screenPeers: newPeers };
  }),
  clearScreenPeers: () => set((state) => {
    Object.values(state.screenPeers).forEach(peer => peer.close());
    return { screenPeers: {} };
  }),

  remoteScreenStreams: {},
  addRemoteScreenStream: (userId, stream) => set((state) => ({ remoteScreenStreams: { ...state.remoteScreenStreams, [userId]: stream } })),
  removeRemoteScreenStream: (userId) => set((state) => {
    const newStreams = { ...state.remoteScreenStreams };
    delete newStreams[userId];
    return { remoteScreenStreams: newStreams };
  }),
  clearRemoteScreenStreams: () => set({ remoteScreenStreams: {} }),

  isMuted: false,
  setIsMuted: (muted) => {
    const { localStream } = get();
    if (localStream) {
      localStream.getAudioTracks().forEach(track => {
        track.enabled = !muted; // Включаем/выключаем трек
      });
    }
    set({ isMuted: muted });
  },

  isDeafened: false,
  setIsDeafened: (deafened) => set({ isDeafened: deafened }),

  voiceUsers: {},
  updateVoiceUser: (userId, data) => set((state) => ({
    voiceUsers: {
      ...state.voiceUsers,
      [userId]: { ...(state.voiceUsers[userId] || { id: userId, isMuted: false, isDeafened: false }), ...data }
    }
  })),
  removeVoiceUser: (userId) => set((state) => {
    const newUsers = { ...state.voiceUsers };
    delete newUsers[userId];
    return { voiceUsers: newUsers };
  }),
  clearVoiceUsers: () => set({ voiceUsers: {} }),
}));
