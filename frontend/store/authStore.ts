import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { authApi, usersApi, streaksApi } from '../services/api';
import { router } from 'expo-router';

// ── Types ─────────────────────────────────────────────────────
interface User {
  id:         string;
  email:      string;
  first_name: string;
  last_name:  string;
  balance:    number;
}

interface Streak {
  current_streak:          number;
  longest_streak:          number;
  badge_level:             'seedling' | 'sprout' | 'plant' | 'tree';
  restore_uses_this_month: number;
  last_active_utc_date:    string | null;
}

interface AuthState {
  user:         User | null;
  streak:       Streak | null;
  isLoading:    boolean;
  isHydrated:   boolean;
  // Actions
  login:        (email: string, password: string) => Promise<void>;
  register:     (data: { email: string; password: string; first_name: string; last_name: string }) => Promise<void>;
  logout:       () => Promise<void>;
  hydrate:      () => Promise<void>;
  refreshUser:  () => Promise<void>;
  pingStreak:   () => Promise<void>;
  setBalance:   (balance: number) => void;
}

// ── Store ─────────────────────────────────────────────────────
export const useAuthStore = create<AuthState>((set, get) => ({
  user:       null,
  streak:     null,
  isLoading:  false,
  isHydrated: false,

  // ── Login ─────────────────────────────────────────────────
  login: async (email, password) => {
    set({ isLoading: true });
    try {
      const { data } = await authApi.login({ email, password });
      await SecureStore.setItemAsync('access_token',  data.access_token);
      await SecureStore.setItemAsync('refresh_token', data.refresh_token);
      set({ user: data.user, isLoading: false });
      // Ping streak on login (counts as app open)
      get().pingStreak();
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  },

  // ── Register ──────────────────────────────────────────────
  register: async (formData) => {
    set({ isLoading: true });
    try {
      const { data } = await authApi.register(formData);
      await SecureStore.setItemAsync('access_token',  data.access_token);
      await SecureStore.setItemAsync('refresh_token', data.refresh_token);
      set({ user: data.user, isLoading: false });
      get().pingStreak();
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  },

  // ── Logout ────────────────────────────────────────────────
  logout: async () => {
    await SecureStore.deleteItemAsync('access_token');
    await SecureStore.deleteItemAsync('refresh_token');
    set({ user: null, streak: null });
    router.replace('/(auth)/login');
  },

  // ── Hydrate from SecureStore on app launch ────────────────
  hydrate: async () => {
    try {
      const token = await SecureStore.getItemAsync('access_token');
      if (!token) {
        set({ isHydrated: true });
        return;
      }
      const { data } = await usersApi.me();
      set({ user: data, isHydrated: true });
      get().pingStreak();
    } catch {
      await SecureStore.deleteItemAsync('access_token');
      await SecureStore.deleteItemAsync('refresh_token');
      set({ isHydrated: true });
    }
  },

  // ── Refresh user data (balance etc.) ──────────────────────
  refreshUser: async () => {
    try {
      const { data } = await usersApi.me();
      set({ user: data });
    } catch {}
  },

  // ── Streak ping ───────────────────────────────────────────
  pingStreak: async () => {
    try {
      const { data } = await streaksApi.ping();
      set({ streak: data.streak });
    } catch {}
  },

  setBalance: (balance) =>
    set((state) => ({ user: state.user ? { ...state.user, balance } : null })),
}));
