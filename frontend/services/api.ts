import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import * as SecureStore from 'expo-secure-store';

// ── Change this to your backend IP when testing on a physical device ──────────
export const API_BASE_URL = 'http://192.168.1.11:3000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

// ── Request interceptor: attach access token ──────────────────
api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const token = await SecureStore.getItemAsync('access_token');
  if (token && config.headers) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
});

// ── Response interceptor: auto-refresh on 401 ────────────────
let isRefreshing = false;
let failedQueue: Array<{ resolve: (v: string) => void; reject: (e: any) => void }> = [];

function processQueue(error: any, token: string | null = null) {
  failedQueue.forEach((p) => (error ? p.reject(error) : p.resolve(token!)));
  failedQueue = [];
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    const errCode = (error.response?.data as any)?.error?.code;

    if (errCode === 'AUTH_EXPIRED' && !original._retry) {
      if (isRefreshing) {
        return new Promise<string>((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          original.headers['Authorization'] = `Bearer ${token}`;
          return api(original);
        });
      }

      original._retry = true;
      isRefreshing = true;

      try {
        const refresh_token = await SecureStore.getItemAsync('refresh_token');
        const { data } = await axios.post(`${API_BASE_URL}/auth/refresh`, { refresh_token });
        await SecureStore.setItemAsync('access_token', data.access_token);
        processQueue(null, data.access_token);
        original.headers['Authorization'] = `Bearer ${data.access_token}`;
        return api(original);
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        await SecureStore.deleteItemAsync('access_token');
        await SecureStore.deleteItemAsync('refresh_token');
        throw refreshErr;
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

// ── Auth ──────────────────────────────────────────────────────
export const authApi = {
  register: (data: { email: string; password: string; first_name: string; last_name: string }) =>
    api.post('/auth/register', data),
  login: (data: { email: string; password: string }) =>
    api.post('/auth/login', data),
  refresh: (refresh_token: string) =>
    api.post('/auth/refresh', { refresh_token }),
};

// ── Users ─────────────────────────────────────────────────────
export const usersApi = {
  me: () => api.get('/users/me'),
  search: (email: string) => api.get(`/users/search?email=${encodeURIComponent(email)}`),
  deposit: (amount: number) => api.post('/users/deposit', { amount }),
};

// ── Transfers ─────────────────────────────────────────────────
export const transfersApi = {
  send: (data: { receiver_email: string; amount: number; note?: string }) =>
    api.post('/transfers', data),
  history: (page = 1, limit = 20) =>
    api.get(`/transfers?page=${page}&limit=${limit}`),
};

// ── Goals ─────────────────────────────────────────────────────
export const goalsApi = {
  list: () => api.get('/goals'),
  create: (data: any) => api.post('/goals', data),
  update: (id: string, data: any) => api.patch(`/goals/${id}`, data),
  delete: (id: string) => api.delete(`/goals/${id}`),
};

// ── Streaks ───────────────────────────────────────────────────
export const streaksApi = {
  ping: () => api.post('/streaks/ping'),
  get: () => api.get('/streaks'),
  restore: () => api.post('/streaks/restore'),
  history: () => api.get('/streaks/history'),
};

export default api;
