import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
  timeout: 20000, // 20s — fail fast instead of hanging forever
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Login/register forms get their 401s back as errors to display, not a logout
const AUTH_FORM_PATHS = ['/auth/login', '/auth/register', '/auth/forgot-password', '/auth/reset-password'];

// Set by App: logs out through the router and shows a notice on the login page
let unauthorizedHandler = null;
export function setUnauthorizedHandler(handler) {
  unauthorizedHandler = handler;
}

// A 401 on any other request means the session is gone (expired, revoked, or banned)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const url = error.config?.url || '';
    const isAuthForm = AUTH_FORM_PATHS.some(p => url.startsWith(p));
    if (error.response?.status === 401 && !isAuthForm && localStorage.getItem('token')) {
      if (unauthorizedHandler) {
        unauthorizedHandler();
      } else {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export function getApiError(err, fallback = 'Something went wrong') {
  return err?.response?.data?.error || fallback;
}

export default api;
