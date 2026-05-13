import { create } from 'zustand';
import type { AuthResponse, LoginRequest, RegisterRequest } from '@/services/sofusion/auth';

interface SofusionAuthState {
  isAuthenticated: boolean;
  token: string | null;
  refreshToken: string | null;
  user: { userId: number; username: string } | null;
  login: (request: LoginRequest) => Promise<void>;
  register: (request: RegisterRequest) => Promise<void>;
  logout: () => void;
  initAuth: () => void;
  clearSession: () => void;
}

export const useSofusionAuthStore = create<SofusionAuthState>((set) => ({
  isAuthenticated: false,
  token: null,
  refreshToken: null,
  user: null,

  initAuth: () => {
    if (typeof window === 'undefined') return;
    const token = localStorage.getItem('sofusion_auth_token');
    const refreshToken = localStorage.getItem('sofusion_refresh_token');
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]!));
        set({
          isAuthenticated: true,
          token,
          refreshToken: refreshToken || null,
          user: {
            userId: payload.sub,
            username: payload.username || 'User',
          },
        });
      } catch {
        localStorage.removeItem('sofusion_auth_token');
        localStorage.removeItem('sofusion_refresh_token');
      }
    }
  },

  login: async (request: LoginRequest) => {
    const { login } = await import('@/services/sofusion/auth');
    const response: AuthResponse = await login(request);
    set({
      isAuthenticated: true,
      token: response.accessToken,
      refreshToken: response.refreshToken,
      user: {
        userId: response.userId,
        username: response.username,
      },
    });
  },

  register: async (request: RegisterRequest) => {
    const { register } = await import('@/services/sofusion/auth');
    const response: AuthResponse = await register(request);
    set({
      isAuthenticated: true,
      token: response.accessToken,
      refreshToken: response.refreshToken,
      user: {
        userId: response.userId,
        username: response.username,
      },
    });
  },

  logout: async () => {
    const { logout: doLogout } = await import('@/services/sofusion/auth');
    await doLogout();
    set({
      isAuthenticated: false,
      token: null,
      refreshToken: null,
      user: null,
    });
  },

  clearSession: () => {
    const { clearAllTokens } = require('@/services/sofusion/auth');
    clearAllTokens();
    set({
      isAuthenticated: false,
      token: null,
      refreshToken: null,
      user: null,
    });
  },
}));
