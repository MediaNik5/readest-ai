const REQUEST_TIMEOUT = 60_000; // 60 seconds

const getBaseUrl = (): string => {
  const url = process.env['NEXT_PUBLIC_SOFUSION_API_URL'];
  console.log('[Sofusion] NEXT_PUBLIC_SOFUSION_API_URL:', url);
  if (!url) {
    return 'https://sofusion.online';
    // throw new Error('NEXT_PUBLIC_SOFUSION_API_URL is not configured');
  }
  return url.replace(/\/+$/, '');
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
  const baseUrl = getBaseUrl();
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
    response = await fetch(`${baseUrl}/api/books/upload`, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('Upload request timed out after 60 seconds');
    }
    const message = err instanceof TypeError ? err.message : String(err);
    throw new Error(
      `Cannot reach server at ${baseUrl}. ` +
        `Make sure the backend is running and CORS is enabled. ` +
        `(${message})`,
    );
  }

  if (!response.ok) {
    let body: string;
    try {
      body = await response.text();
    } catch {
      body = response.statusText;
    }
    throw new Error(`Upload failed (${response.status}): ${body}`);
  }

  return response.json();
}

export async function askQuestion(bookId: number, request: AskRequest): Promise<AskResponse> {
  const baseUrl = getBaseUrl();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  let response: Response;
  try {
    response = await fetch(`${baseUrl}/api/books/${bookId}/ask`, {
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
    const body = await response.text();
    throw new Error(`Ask failed (${response.status}): ${body}`);
  }

  return response.json();
}

export async function listSeries(): Promise<Series[]> {
  const baseUrl = getBaseUrl();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  let response: Response;
  try {
    response = await fetch(`${baseUrl}/api/series`, {
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
    const body = await response.text();
    throw new Error(`List series failed (${response.status}): ${body}`);
  }

  return response.json();
}

export async function createSeries(request: CreateSeriesRequest): Promise<CreateSeriesResponse> {
  const baseUrl = getBaseUrl();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  let response: Response;
  try {
    response = await fetch(`${baseUrl}/api/series`, {
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
    const body = await response.text();
    throw new Error(`Create series failed (${response.status}): ${body}`);
  }

  return response.json();
}

export async function updateBookSeries(
  bookId: number,
  request: UpdateBookSeriesRequest,
): Promise<{ message: string }> {
  const baseUrl = getBaseUrl();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  let response: Response;
  try {
    response = await fetch(`${baseUrl}/api/books/${bookId}/series`, {
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
    const body = await response.text();
    throw new Error(`Update book series failed (${response.status}): ${body}`);
  }

  return response.json();
}
