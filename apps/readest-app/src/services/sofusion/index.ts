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

export {
  login,
  register,
  logout,
  refreshToken,
  checkAuth,
  getAuthToken,
  setAuthToken,
  clearAuthToken,
  getRefreshToken,
  setRefreshToken,
  clearRefreshToken,
  clearAllTokens,
  isAuthenticated,
} from './auth';
export type { AuthResponse, LoginRequest, RegisterRequest } from './auth';
