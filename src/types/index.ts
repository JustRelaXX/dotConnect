// === TypeScript типы для dotConnect ===

export interface User {
  id: string;
  username: string;
  display_name: string;
  avatar_color: string;
}

export interface Channel {
  id: string;
  name: string;
  description: string;
  position: number;
  created_by: string;
}

export interface ChatMessage {
  id: string;
  channel_id: string;
  author_id: string;
  author_name?: string;
  author_username?: string;
  author_color?: string;
  content: string;
  message_type: string;
  file_path?: string;
  file_name?: string;
  file_size?: number;
  created_at: string;
}

export interface WSMessage {
  type: string;
  payload: any;
  timestamp: number;
}

export type AppScreen = 'login' | 'choice' | 'host' | 'join' | 'chat';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';
