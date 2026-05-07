import { create } from 'zustand';
import type { AuthResponse, LoginRequest, RegisterRequest } from '@/services/sofusion/auth';

interface SofusionAuthState {
  isAuthenticated: boolean;
  token: string | null;
  user: { userId: number; username: string } | null;
  login: (request: LoginRequest) => Promise<void>;
  register: (request: RegisterRequest) => Promise<void>;
  logout: () => void;
  initAuth: () => void;
}

export const useSofusionAuthStore = create<SofusionAuthState>((set) => ({
  isAuthenticated: false,
  token: null,
  user: null,

  initAuth: () => {
    if (typeof window === 'undefined') return;
    const token = localStorage.getItem('sofusion_auth_token');
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]!));
        set({
          isAuthenticated: true,
          token,
          user: {
            userId: payload.userId,
            username: payload.sub || payload.username || 'User',
          },
        });
      } catch {
        localStorage.removeItem('sofusion_auth_token');
      }
    }
  },

  login: async (request: LoginRequest) => {
    const { login } = await import('@/services/sofusion/auth');
    const response: AuthResponse = await login(request);
    set({
      isAuthenticated: true,
      token: response.token,
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
      token: response.token,
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
      user: null,
    });
  },
}));
