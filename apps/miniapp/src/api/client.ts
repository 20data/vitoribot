import axios from 'axios';
import { create } from 'zustand';
import { getInitData } from '../telegram';

const API = import.meta.env['VITE_API_URL'] as string | undefined;
const BASE = API ?? 'http://localhost:3001';

interface AuthState {
  token: string | null;
  ready: boolean;
  error: string | null;
  theme: 'auto' | 'dark' | 'light';
  setToken: (t: string | null) => void;
  setReady: (r: boolean) => void;
  setError: (e: string | null) => void;
  setTheme: (t: 'auto' | 'dark' | 'light') => void;
}

/** JWT lives only in memory (never localStorage). */
export const useAuth = create<AuthState>()((set) => ({
  token: null,
  ready: false,
  error: null,
  theme: 'auto',
  setToken: (token) => set({ token }),
  setReady: (ready) => set({ ready }),
  setError: (error) => set({ error }),
  setTheme: (theme) => set({ theme }),
}));

/** Authenticate with the backend using Telegram initData. */
export async function login(): Promise<void> {
  const { setToken, setReady, setError } = useAuth.getState();
  const initData = getInitData();
  if (!initData) {
    setError('لطفاً از داخل ربات تلگرام وارد شوید.');
    setReady(true);
    return;
  }
  try {
    const res = await axios.post(`${BASE}/api/miniapp/auth`, { initData });
    setToken((res.data as { accessToken: string }).accessToken);
    setError(null);
  } catch {
    setError('احراز هویت ناموفق بود.');
  } finally {
    setReady(true);
  }
}

export const api = axios.create({ baseURL: BASE });

api.interceptors.request.use((config) => {
  const token = useAuth.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  const initData = getInitData();
  if (initData) config.headers['X-Telegram-Init-Data'] = initData;
  return config;
});
