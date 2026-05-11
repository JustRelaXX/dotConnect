// Zustand store для управления пользователем и навигацией

import { create } from 'zustand';
import { AppScreen, User } from '../types';

interface UserState {
  // Текущий экран
  currentScreen: AppScreen;
  setScreen: (screen: AppScreen) => void;

  // Текущий пользователь
  currentUser: User | null;
  setCurrentUser: (user: User | null) => void;

  // Данные логина
  username: string;
  displayName: string;
  setUsername: (name: string) => void;
  setDisplayName: (name: string) => void;

  // Онлайн-пользователи
  onlineUsers: User[];
  setOnlineUsers: (users: User[]) => void;
  addOnlineUser: (user: User) => void;
  removeOnlineUser: (userId: string) => void;
}

export const useUserStore = create<UserState>((set) => ({
  currentScreen: 'login',
  setScreen: (screen) => set({ currentScreen: screen }),

  currentUser: null,
  setCurrentUser: (user) => set({ currentUser: user }),

  username: '',
  displayName: '',
  setUsername: (name) => set({ username: name }),
  setDisplayName: (name) => set({ displayName: name }),

  onlineUsers: [],
  setOnlineUsers: (users) => set({ onlineUsers: users }),
  addOnlineUser: (user) =>
    set((state) => ({
      onlineUsers: state.onlineUsers.some((u) => u.id === user.id)
        ? state.onlineUsers
        : [...state.onlineUsers, user],
    })),
  removeOnlineUser: (userId) =>
    set((state) => ({
      onlineUsers: state.onlineUsers.filter((u) => u.id !== userId),
    })),
}));
