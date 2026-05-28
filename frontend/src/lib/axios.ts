import axios from 'axios';

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000',
  withCredentials: true, // Important for sending HttpOnly cookies
});

// Response Interceptor for handling 401 and Token Refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If 401 Unauthorized, and we haven't retried yet
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      // Don't retry if it's the login or refresh route failing
      if (originalRequest.url === '/auth/login' || originalRequest.url === '/auth/refresh-token') {
        return Promise.reject(error);
      }

      try {
        // Attempt to refresh token
        await api.post('/auth/refresh-token');
        // If successful, cookies are automatically updated. Retry the original request.
        return api(originalRequest);
      } catch (refreshError) {
        // Refresh token failed or expired. Force logout.
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);
