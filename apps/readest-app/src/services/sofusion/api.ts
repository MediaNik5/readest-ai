const getBaseUrl = (): string => {
  let url = process.env.NEXT_PUBLIC_SOFUSION_API_URL;
  console.log('[Sofusion] NEXT_PUBLIC_SOFUSION_API_URL:', url);
  if (!url) {
    url = 'http://localhost:8080';
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

export async function uploadBook(
  file: File | Blob,
  fileName: string,
  userId: number,
): Promise<BookUploadResponse> {
  const baseUrl = getBaseUrl();
  const formData = new FormData();
  formData.append('file', file, fileName);
  formData.append('userId', String(userId));

  let response: Response;
  try {
    response = await fetch(`${baseUrl}/api/books/upload`, {
      method: 'POST',
      body: formData,
    });
  } catch (err) {
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

  const response = await fetch(`${baseUrl}/api/books/${bookId}/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Ask failed (${response.status}): ${body}`);
  }

  return response.json();
}
