# Sofusion AI Integration - Complete Summary

## Overview

Sofusion is an AI-Powered Spoiler-Free Reading Assistant integrated into the Readest fork. It allows users to:
- Upload EPUB books to the backend for AI processing
- Ask questions about books based only on content they've already read (anti-spoiler)
- Manage book series
- Authenticate with refresh tokens for persistent sessions

---

## Architecture

### Components

| File | Purpose |
|------|---------|
| `src/components/SofusionAuthProvider.tsx` | Auth provider wrapper that initializes auth on app mount |
| `src/components/SofusionLoginDialog.tsx` | Login/Register modal dialog |
| `src/components/SofusionUploadDialog.tsx` | Upload prompt when opening a new book |
| `src/components/SofusionSeriesSelector.tsx` | Series selection/creation UI |
| `src/hooks/useSofusionUpload.ts` | Upload state management hook |
| `src/store/sofusionAuthStore.ts` | Zustand auth state store |
| `src/services/sofusion/auth.ts` | Auth API (login, register, refresh, logout, check) |
| `src/services/sofusion/api.ts` | Main API client with auth wrapper |
| `src/app/reader/components/annotator/AskAIPopup.tsx` | AI Q&A popup for text selection |
| `src/utils/askAI.ts` | Suggested question generation utility |

### Data Flow

```
User Action → Frontend Component → API Service → Backend
     ↓              ↓                    ↓            ↓
  UI Update   State/Storage    Auth Header + Refresh   Response
```

---

## Features

### 1. Authentication

**Files:** `src/services/sofusion/auth.ts`, `src/store/sofusionAuthStore.ts`, `src/components/SofusionLoginDialog.tsx`

**Endpoints:**
- `POST /api/auth/login` - User login, returns `token` + `refreshToken`
- `POST /api/auth/register` - User registration, returns `token` + `refreshToken`
- `POST /api/auth/refresh` - Refresh access token using refresh token
- `POST /api/auth/logout` - Invalidate refresh token on server
- `POST /api/auth/check` - Validate if current token is active (200=valid, 401/403=invalid)

**Token Storage:**
- `localStorage.sofusion_auth_token` - JWT access token
- `localStorage.sofusion_refresh_token` - JWT refresh token

**Auto-Refresh Logic:**
- All API requests go through `fetchWithAuth()` wrapper
- On 401/403 response, automatically attempts token refresh
- Refresh attempts are deduplicated (prevents multiple concurrent refreshes)
- If refresh fails, tokens are cleared and user is shown login dialog

**Auth Store (Zustand):**
```typescript
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
```

### 2. Book Upload

**Files:** `src/hooks/useSofusionUpload.ts`, `src/components/SofusionUploadDialog.tsx`, `src/app/reader/components/ReaderContent.tsx`

**Flow:**
1. User opens a book in Readest
2. System checks if `sofusionBookId` exists in book config
3. If not, shows `SofusionUploadDialog` asking "Upload for AI Q&A?"
4. If user accepts, uploads EPUB to backend
5. Backend processes: parses EPUB, chunks text, generates embeddings, builds CFI map
6. Backend returns `bookId`, stored in book config

**Config Storage:**
```typescript
// src/types/book.ts - BookConfig
sofusionBookId?: string | null;         // null=not uploaded, 'skipped'=declined, number=uploaded
sofusionSeriesId?: number | null;
sofusionSeriesOrder?: number | null;
sofusionSeriesName?: string | null;
```

**Endpoint:**
- `POST /api/books/upload` - Multipart form with `file` + `userId` + optional `seriesId` + `seriesOrder`

### 3. AI Q&A (Text Selection)

**Files:** `src/app/reader/components/annotator/AskAIPopup.tsx`, `src/utils/askAI.ts`, `src/app/reader/components/annotator/Annotator.tsx`

**Flow:**
1. User selects text in reader
2. "Ask AI" button appears in annotation toolbar
3. Clicking opens `AskAIPopup` with:
   - 3-4 suggested questions (generated from text patterns)
   - Custom question input
   - Streaming AI response area
4. Questions sent to backend with CFI of selected text
5. Backend uses CFI to determine user's reading position
6. Vector search filters chunks by `sequential_index <= position` (anti-spoiler)
7. AI generates answer only from content user has read

**Endpoint:**
- `POST /api/books/{id}/ask`
- Body: `{ userId, question, cfi, selectedText, expandDetails }`
- Response: `{ answer, sources, message }`

**Suggested Questions:**
- Emotion detection: "Why is the character feeling X here?"
- Dialogue: "What motivates this character here?"
- References: "What event are they referring to?"
- Literary devices: "Explain the use of metaphor..."
- Generic fallbacks: "Explain this passage", "Summarize what is happening"

### 4. Series Management

**File:** `src/components/SofusionSeriesSelector.tsx`

**Endpoints:**
- `GET /api/series` - List all user's series
- `POST /api/series` - Create new series
- `PUT /api/books/{id}/series` - Update book's series assignment

**UI Components:**
- Series dropdown selector with "No Series (Standalone)" option
- "Create New Series" button expands form for name/description
- Book number input for series order (1, 2, 3...)

---

## API Client Implementation

### Auth Wrapper (`fetchWithAuth`)

```typescript
// src/services/sofusion/api.ts

const fetchWithAuth = async (
  input: RequestInfo | URL,
  init?: RequestInit & { skipRefresh?: boolean },
): Promise<Response> => {
  // Initial request with Bearer token
  let response = await fetch(input, {
    ...init,
    headers: { ...getAuthHeaders(), ...init?.headers },
  });

  // Handle 401/403 by trying to refresh
  if ((response.status === 401 || response.status === 403) && !init?.skipRefresh) {
    // Deduplicate concurrent refresh attempts
    if (!refreshPromise) {
      refreshPromise = doRefreshToken().finally(() => { refreshPromise = null; });
    }

    try {
      await refreshPromise;
      // Retry with new token
      response = await fetch(input, {
        ...init,
        headers: { ...getAuthHeaders(), ...init?.headers },
      });
    } catch {
      throw new Error('Session expired. Please log in again.');
    }
  }

  return response;
};
```

### Session Expiration Handling

When session expires (refresh fails):
1. Tokens are cleared from localStorage
2. Auth store is reset via `clearSession()`
3. Login dialog is automatically shown
4. User can re-authenticate and retry

---

## Integration Points

### App Initialization

```typescript
// src/components/Providers.tsx
<AuthProvider>
  <SofusionAuthProvider>  {/* Initializes auth on mount */}
    <IconContext.Provider>
      ...
    </IconContext.Provider>
  </SofusionAuthProvider>
</AuthProvider>
```

### Reader Integration

**Ask AI Button:**
- Added to `AnnotationToolType` union (`'ask-ai'`)
- Button rendered in `AnnotationTools.tsx`
- Handler in `Annotator.tsx` shows `AskAIPopup`

**Book Upload:**
- Triggered in `ReaderContent.tsx` after book loads
- Monitors `bookDataStore` changes
- Shows dialog once per book (unless skipped)

### AIAssistant Integration

```typescript
// src/app/reader/components/notebook/AIAssistant.tsx
const seriesContext = config?.sofusionSeriesId && config.sofusionSeriesName
  ? {
      seriesId: config.sofusionSeriesId,
      seriesName: config.sofusionSeriesName,
      seriesOrder: config.sofusionSeriesOrder || 1,
    }
  : null;
```

Series context passed to AI chat for better contextual responses.

---

## Environment Variables

```bash
# .env.local
NEXT_PUBLIC_SOFUSION_API_URL=https://sofusion.online  # or http://localhost:8080
```

---

## CFI (EPUB Canonical Fragment Identifier) Handling

**Purpose:** Maps user's reading position to chunk index for anti-spoiler filtering.

**Normalization:**
```typescript
export const normalizeCfi = (cfi: string): string => {
  // 1. Remove epubcfi() wrapper
  const clean = cfi.replace(/^epubcfi\(|\)$/g, '');

  // 2. Split by commas
  const parts = clean.split(',');

  // 3. Build path
  let fullPath = parts.length > 1 ? parts[0]! + parts[1]! : (parts[0] ?? '');

  // 4. Cleanup
  return fullPath
    .replace(/:.*$/, '')      // Remove character offset
    .replace(/\/\d*[13579]$/, ''); // Remove trailing odd numbers
};
```

**Backend Mapping:**
- Backend stores `cfiProgressArray`: `{ "cfi_string": sequentialIndex }`
- Frontend sends normalized CFI to backend
- Backend resolves CFI to `sequentialIndex`
- Vector search filters: `WHERE sequential_index <= resolved_index`

---

## Error Handling

| Error Type | Handling |
|------------|----------|
| 401/403 on API call | Auto-refresh token, retry once |
| Refresh failure | Clear tokens, show login dialog |
| Upload timeout (60s) | Show error, allow retry |
| Network unreachable | Show error with server URL |
| Book not uploaded | Show "Upload first" message in Ask AI |
| Session expired | Clear session, show login dialog |

---

## Key Types

```typescript
// Auth
interface AuthResponse {
  token: string;
  refreshToken: string;
  type: string;
  userId: number;
  username: string;
}

// API
interface BookUploadResponse {
  id: number;
  title: string;
  author: string | null;
  filename: string;
  totalChunks: number;
  totalChapters: number;
  createdAt: string;
  message: string | null;
}

interface AskRequest {
  userId: number;
  question: string;
  expandDetails?: boolean;
  cfi?: string;
  selectedText?: string;
}

interface AskResponse {
  answer: string;
  sources?: Array<{ chunkIndex: number; text: string }>;
  message: string | null;
}

interface Series {
  id: number;
  name: string;
  description: string | null;
  books?: Array<{ id: number; title: string; author: string | null; seriesOrder: number }>;
}
```

---

## Dependencies

- `zustand` - State management (auth store)
- `lucide-react` - Icons (Sparkles, Lock, etc.)
- `react` - UI framework
- `@assistant-ui/react` - AI chat thread UI (used in AIAssistant)
