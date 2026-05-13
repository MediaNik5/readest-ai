import {getSofusionBaseUrl} from "@/services/sofusion/api.ts";

const REQUEST_TIMEOUT = 30_000;

// const getBaseUrl = (): string => {
//   const url = process.env['NEXT_PUBLIC_SOFUSION_API_URL'];
//   if (!url) {
//     return 'https://sofusion.online';
//   }
//   return url.replace(/\/+$/, '');
// };

export interface AuthResponse {
  token: string;
  refreshToken: string;
  type: string;
  userId: number;
  username: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  token?: string;
}

const STORAGE_KEY = 'sofusion_auth_token';
const REFRESH_TOKEN_KEY = 'sofusion_refresh_token';

export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(STORAGE_KEY);
}

export function setAuthToken(token: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, token);
}

export function clearAuthToken(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
}

export function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setRefreshToken(token: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(REFRESH_TOKEN_KEY, token);
}

export function clearRefreshToken(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export function clearAllTokens(): void {
  clearAuthToken();
  clearRefreshToken();
  localStorage.removeItem('sofusionUserId');
}

export function isAuthenticated(): boolean {
  return getAuthToken() !== null;
}

export async function login(request: LoginRequest): Promise<AuthResponse> {
  const baseUrl = getSofusionBaseUrl();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  let response: Response;
  try {
    response = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('Login request timed out');
    }
    throw err;
  }

  if (!response.ok) {
    let errorMessage: string;
    try {
      const json = await response.json();
      errorMessage = json.message ?? response.statusText;
    } catch {
      errorMessage = response.statusText;
    }
    throw new Error(errorMessage);
  }

  const result: AuthResponse = await response.json();

  if (result.token) {
    setAuthToken(result.token);
  }
  if (result.refreshToken) {
    setRefreshToken(result.refreshToken);
  }

  return result;
}

export async function register(request: RegisterRequest): Promise<AuthResponse> {
  const baseUrl = getSofusionBaseUrl();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  let response: Response;
  try {
    response = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('Registration request timed out');
    }
    throw err;
  }

  if (!response.ok) {
    let errorMessage: string;
    try {
      const json = await response.json();
      errorMessage = json.message ?? response.statusText;
    } catch {
      errorMessage = response.statusText;
    }
    throw new Error(errorMessage);
  }

  const result: AuthResponse = await response.json();

  if (result.token) {
    setAuthToken(result.token);
  }
  if (result.refreshToken) {
    setRefreshToken(result.refreshToken);
  }

  return result;
}

export async function logout(): Promise<void> {
  const baseUrl = getSofusionBaseUrl();
  const refreshToken = getRefreshToken();

  if (refreshToken) {
    try {
      await fetch(`${baseUrl}/api/auth/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
    } catch {
      // Ignore logout errors, just clear tokens
    }
  }

  clearAllTokens();
}

export async function refreshToken(): Promise<AuthResponse> {
  const baseUrl = getSofusionBaseUrl();
  const currentRefreshToken = getRefreshToken();

  if (!currentRefreshToken) {
    throw new Error('Session expired: no refresh token');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  let response: Response;
  try {
    response = await fetch(`${baseUrl}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: currentRefreshToken }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('Refresh token request timed out');
    }
    throw err;
  }

  if (!response.ok) {
    // Refresh failed, clear tokens
    clearAllTokens();
    let errorMessage: string;
    try {
      const json = await response.json();
      errorMessage = json.message ?? response.statusText;
    } catch {
      errorMessage = response.statusText;
    }
    throw new Error(`Session expired: ${errorMessage}`);
  }

  const result: AuthResponse = await response.json();

  if (result.token) {
    setAuthToken(result.token);
  }
  if (result.refreshToken) {
    setRefreshToken(result.refreshToken);
  }

  return result;
}

export async function checkAuth(): Promise<boolean> {
  const baseUrl = getSofusionBaseUrl();
  const token = getAuthToken();

  if (!token) {
    return false;
  }

  try {
    const response = await fetch(`${baseUrl}/api/auth/check`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.ok;
  } catch {
    return false;
  }
}
