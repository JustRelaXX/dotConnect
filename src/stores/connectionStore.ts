// Zustand store для управления подключением

import { create } from 'zustand';
import { ConnectionStatus } from '../types';

interface ConnectionState {
  status: ConnectionStatus;
  setStatus: (status: ConnectionStatus) => void;

  ws: WebSocket | null;
  setWs: (ws: WebSocket | null) => void;

  serverIp: string;
  serverPort: number;
  setServerInfo: (ip: string, port: number) => void;

  isHost: boolean;
  setIsHost: (isHost: boolean) => void;

  roomPassword: string;
  setRoomPassword: (password: string) => void;

  errorMessage: string;
  setErrorMessage: (msg: string) => void;
}

export const useConnectionStore = create<ConnectionState>((set) => ({
  status: 'disconnected',
  setStatus: (status) => set({ status }),

  ws: null,
  setWs: (ws) => set({ ws }),

  serverIp: '',
  serverPort: 9150,
  setServerInfo: (ip, port) => set({ serverIp: ip, serverPort: port }),

  isHost: false,
  setIsHost: (isHost) => set({ isHost }),

  roomPassword: '',
  setRoomPassword: (password) => set({ roomPassword: password }),

  errorMessage: '',
  setErrorMessage: (msg) => set({ errorMessage: msg }),
}));
