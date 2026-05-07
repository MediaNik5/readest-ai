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

  return result;
}

export async function logout(): Promise<void> {
  clearAuthToken();
}
