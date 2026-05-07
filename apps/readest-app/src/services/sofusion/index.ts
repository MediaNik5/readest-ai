export { uploadBook, askQuestion, listSeries, createSeries, updateBookSeries } from './api';
export type {
  BookUploadResponse,
  AskRequest,
  AskResponse,
  Series,
  CreateSeriesRequest,
  CreateSeriesResponse,
  UpdateBookSeriesRequest,
} from './api';

export { login, register, logout, getAuthToken, setAuthToken, clearAuthToken, isAuthenticated } from './auth';
export type { AuthResponse, LoginRequest, RegisterRequest } from './auth';
