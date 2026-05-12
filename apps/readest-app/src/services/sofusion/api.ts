import { refreshToken as doRefreshToken } from '@/services/sofusion/auth';

const REQUEST_TIMEOUT = 60_000; // 60 seconds

let refreshPromise: Promise<unknown> | null = null;

export const getSofusionBaseUrl = (): string => {
  const url = process.env['NEXT_PUBLIC_SOFUSION_API_URL'];
  console.log('[Sofusion] NEXT_PUBLIC_SOFUSION_API_URL:', url);
  if (!url) {
    return 'https://sofusion.online';
    // throw new Error('NEXT_PUBLIC_SOFUSION_API_URL is not configured');
  }
  return url.replace(/\/+$/, '');
};

const getAuthHeaders = (): Record<string, string> => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('sofusion_auth_token') : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const fetchWithAuth = async (
  input: RequestInfo | URL,
  init?: RequestInit & { skipRefresh?: boolean },
): Promise<Response> => {
  // Omit skipRefresh when passing to fetch as it's not a valid fetch option
  const { skipRefresh: _skipRefresh, ...fetchInit } = init || {};

  let response = await fetch(input, {
    ...fetchInit,
    headers: { ...getAuthHeaders(), ...fetchInit?.headers },
  });

  // Handle 401/403 by trying to refresh the token
  if ((response.status === 401 || response.status === 403) && !init?.skipRefresh) {
    // Prevent multiple concurrent refresh attempts
    if (!refreshPromise) {
      refreshPromise = doRefreshToken().finally(() => {
        refreshPromise = null;
      });
    }

    try {
      await refreshPromise;
      // Retry the original request with new token
      const { skipRefresh: _skipRefresh2, ...retryInit } = init || {};
      response = await fetch(input, {
        ...retryInit,
        headers: { ...getAuthHeaders(), ...retryInit?.headers },
      });
    } catch {
      // Refresh failed, tokens are already cleared by doRefreshToken
      // The calling code should handle this by redirecting to login
      throw new Error('Session expired. Please log in again.');
    }
  }

  return response;
};

export interface BookUploadResponse {
  id: number;
  title: string;
  author: string | null;
  filename: string;
  totalChunks: number;
  totalChapters: number;
  createdAt: string;
  message: string | null;
}

export interface AskRequest {
  userId: number;
  question: string;
  expandDetails?: boolean;
  cfi?: string;
  selectedText?: string;
}

export interface AskResponse {
  answer: string;
  sources?: Array<{ chunkIndex: number; text: string }>;
  message: string | null;
}

export interface Series {
  id: number;
  name: string;
  description: string | null;
  books?: Array<{
    id: number;
    title: string;
    author: string | null;
    seriesOrder: number;
  }>;
}

export interface CreateSeriesRequest {
  name: string;
  description?: string;
}

export interface CreateSeriesResponse {
  id: number;
  name: string;
  description: string | null;
  message: string;
}

export interface UpdateBookSeriesRequest {
  seriesId: number;
  seriesOrder: number;
}

export async function uploadBook(
  file: File | Blob,
  fileName: string,
  userId: number,
  seriesId?: number | null,
  seriesOrder?: number | null,
): Promise<BookUploadResponse> {
  const baseUrl = getSofusionBaseUrl();
  const formData = new FormData();
  formData.append('file', file, fileName);
  formData.append('userId', String(userId));
  if (seriesId !== undefined && seriesId !== null) {
    formData.append('seriesId', String(seriesId));
  }
  if (seriesOrder !== undefined && seriesOrder !== null) {
    formData.append('seriesOrder', String(seriesOrder));
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  let response: Response;
  try {
    response = await fetchWithAuth(`${baseUrl}/api/books/upload`, {
      method: 'POST',
      headers: {},
      body: formData,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('Upload request timed out after 60 seconds');
    }
    if (err instanceof Error && err.message.includes('Session expired')) {
      throw err;
    }
    const message = err instanceof TypeError ? err.message : String(err);
    throw new Error(
      `Cannot reach server at ${baseUrl}. ` +
        `Make sure the backend is running and CORS is enabled. ` +
        `(${message})`,
    );
  }

  if (!response.ok) {
    let errorMessage: string;
    try {
      const json = await response.json();
      errorMessage = json.message ?? response.statusText;
    } catch {
      errorMessage = response.statusText;
    }
    throw new Error(`Upload failed (${response.status}): ${errorMessage}`);
  }

  return response.json();
}

export async function askQuestion(bookId: number, request: AskRequest): Promise<AskResponse> {
  const baseUrl = getSofusionBaseUrl();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  let response: Response;
  try {
    response = await fetchWithAuth(`${baseUrl}/api/books/${bookId}/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('Request timed out after 60 seconds');
    }
    if (err instanceof Error && err.message.includes('Session expired')) {
      throw err;
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
    throw new Error(`Ask failed (${response.status}): ${errorMessage}`);
  }

  return response.json();
}

export async function listSeries(): Promise<Series[]> {
  const baseUrl = getSofusionBaseUrl();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  let response: Response;
  try {
    response = await fetchWithAuth(`${baseUrl}/api/series`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('Request timed out after 60 seconds');
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
    throw new Error(`List series failed (${response.status}): ${errorMessage}`);
  }

  return response.json();
}

export async function createSeries(request: CreateSeriesRequest): Promise<CreateSeriesResponse> {
  const baseUrl = getSofusionBaseUrl();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  let response: Response;
  try {
    response = await fetchWithAuth(`${baseUrl}/api/series`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('Request timed out after 60 seconds');
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
    throw new Error(`Create series failed (${response.status}): ${errorMessage}`);
  }

  return response.json();
}

export async function updateBookSeries(
  bookId: number,
  request: UpdateBookSeriesRequest,
): Promise<{ message: string }> {
  const baseUrl = getSofusionBaseUrl();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  let response: Response;
  try {
    response = await fetchWithAuth(`${baseUrl}/api/books/${bookId}/series`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('Request timed out after 60 seconds');
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
    throw new Error(`Update book series failed (${response.status}): ${errorMessage}`);
  }

  return response.json();
}
