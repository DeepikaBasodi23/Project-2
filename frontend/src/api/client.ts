import axios from 'axios';

const normalizeBaseUrl = (value: string) => {
  const trimmed = value.trim().replace(/\/+$/, '');
  return trimmed.endsWith('/api/v1') ? trimmed : `${trimmed}/api/v1`;
};

const api = axios.create({
  baseURL: normalizeBaseUrl(import.meta.env.VITE_API_BASE_URL || '/api/v1'),
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    let message = 'An unexpected error occurred';

    if (error.response) {
      // Server responded with an error status
      const status = error.response.status;
      const data   = error.response.data;
      message = data?.message || data?.error || `Server error (${status})`;
    } else if (error.request) {
      // Request was made but no response received (CORS, server down, timeout)
      message = 'Cannot reach the server. Please check your connection or try again later.';
    } else {
      message = error.message || message;
    }

    return Promise.reject(new Error(message));
  }
);

export default api;
