import axios from 'axios';
import { useAuthStore } from '../store/useAuthStore';

const getBaseUrl = () => {
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    
    // Check if it's a local IP address (e.g., 192.168.x.x, 10.x.x.x, 172.x.x.x)
    const isLocalNetworkIP = /^(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/.test(hostname);
    if (isLocalNetworkIP) {
      return `http://${hostname}:5000`;
    }

    // Check if it's a production Vercel deployment
    if (hostname.includes('vercel.app')) {
      return 'https://securechatapp-backend.onrender.com';
    }
  }
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
};

export const api = axios.create({
  baseURL: getBaseUrl(),
  withCredentials: true, // Important for sending HttpOnly cookies
});

// Request interceptor to attach Bearer token fallback
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
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
