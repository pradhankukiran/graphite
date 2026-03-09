import { create } from 'zustand';
import type { User } from '@/types';
import { auth } from '@/lib/api/endpoints';
import { apiClient } from '@/lib/api/client';

const DEMO_AUTO_LOGIN = process.env.NEXT_PUBLIC_DEMO_AUTO_LOGIN !== 'false';
const DEMO_EMAIL = process.env.NEXT_PUBLIC_DEMO_EMAIL || 'demo@graphite.dev';
const DEMO_PASSWORD = process.env.NEXT_PUBLIC_DEMO_PASSWORD || 'demo1234';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  login: (email: string, password: string) => Promise<void>;
  register: (data: {
    full_name: string;
    email: string;
    password: string;
    organization?: string;
  }) => Promise<void>;
  logout: () => void;
  fetchUser: () => Promise<void>;
  setUser: (user: User | null) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,

  login: async (email: string, password: string) => {
    const tokens = await auth.login(email, password);
    apiClient.setToken(tokens.access);
    apiClient.setRefreshToken(tokens.refresh);

    if (tokens.user) {
      set({ user: tokens.user, isAuthenticated: true, isLoading: false });
    } else {
      const user = await auth.getMe();
      set({ user, isAuthenticated: true, isLoading: false });
    }
  },

  register: async (data) => {
    const tokens = await auth.register(data);
    apiClient.setToken(tokens.access);
    apiClient.setRefreshToken(tokens.refresh);

    if (tokens.user) {
      set({ user: tokens.user, isAuthenticated: true, isLoading: false });
    } else {
      const user = await auth.getMe();
      set({ user, isAuthenticated: true, isLoading: false });
    }
  },

  logout: () => {
    apiClient.clearTokens();
    set({ user: null, isAuthenticated: false, isLoading: false });
  },

  fetchUser: async () => {
    const token = apiClient.getToken();
    if (!token) {
      if (DEMO_AUTO_LOGIN) {
        try {
          await get().login(DEMO_EMAIL, DEMO_PASSWORD);
          return;
        } catch {
          apiClient.clearTokens();
        }
      }

      set({ user: null, isAuthenticated: false, isLoading: false });
      return;
    }

    try {
      const user = await auth.getMe();
      set({ user, isAuthenticated: true, isLoading: false });
    } catch {
      apiClient.clearTokens();
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },

  setUser: (user) => {
    set({ user, isAuthenticated: !!user });
  },
}));
