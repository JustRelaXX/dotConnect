// Zustand store для чата — каналы и сообщения

import { create } from 'zustand';
import { Channel, ChatMessage } from '../types';

interface ChatState {
  // Каналы
  channels: Channel[];
  activeChannelId: string;
  setChannels: (channels: Channel[]) => void;
  setActiveChannel: (channelId: string) => void;
  addChannel: (channel: Channel) => void;
  removeChannel: (channelId: string) => void;

  // Сообщения (по каналам)
  messagesByChannel: Record<string, ChatMessage[]>;
  addMessage: (message: ChatMessage) => void;
  setMessages: (channelId: string, messages: ChatMessage[]) => void;
  appendMessages: (channelId: string, messages: ChatMessage[]) => void;

  // Typing
  typingUsers: Record<string, string[]>; // channelId -> userIds
  setTyping: (channelId: string, userId: string) => void;
  clearTyping: (channelId: string, userId: string) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  channels: [],
  activeChannelId: 'general',
  setChannels: (channels) => set({ channels }),
  setActiveChannel: (channelId) => set({ activeChannelId: channelId }),
  addChannel: (channel) =>
    set((state) => ({ channels: [...state.channels, channel] })),
  removeChannel: (channelId) =>
    set((state) => ({
      channels: state.channels.filter((c) => c.id !== channelId),
      activeChannelId:
        state.activeChannelId === channelId ? 'general' : state.activeChannelId,
    })),

  messagesByChannel: {},
  addMessage: (message) =>
    set((state) => {
      const channelId = message.channel_id;
      const existing = state.messagesByChannel[channelId] || [];
      // Проверяем дубликаты
      if (existing.some((m) => m.id === message.id)) return state;
      return {
        messagesByChannel: {
          ...state.messagesByChannel,
          [channelId]: [...existing, message],
        },
      };
    }),
  setMessages: (channelId, messages) =>
    set((state) => ({
      messagesByChannel: {
        ...state.messagesByChannel,
        [channelId]: messages,
      },
    })),
  appendMessages: (channelId, messages) =>
    set((state) => {
      const existing = state.messagesByChannel[channelId] || [];
      const existingIds = new Set(existing.map((m) => m.id));
      const newMsgs = messages.filter((m) => !existingIds.has(m.id));
      return {
        messagesByChannel: {
          ...state.messagesByChannel,
          [channelId]: [...existing, ...newMsgs],
        },
      };
    }),

  typingUsers: {},
  setTyping: (channelId, userId) =>
    set((state) => {
      const current = state.typingUsers[channelId] || [];
      if (current.includes(userId)) return state;
      return {
        typingUsers: {
          ...state.typingUsers,
          [channelId]: [...current, userId],
        },
      };
    }),
  clearTyping: (channelId, userId) =>
    set((state) => ({
      typingUsers: {
        ...state.typingUsers,
        [channelId]: (state.typingUsers[channelId] || []).filter(
          (id) => id !== userId
        ),
      },
    })),
}));
