import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from '../lib/axios';

interface User {
  id: string;
  name: string;
  email: string;
  profile_pic_url?: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  login: (user: User) => void;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,

      login: (user) => set({ user, isAuthenticated: true }),

      logout: async () => {
        try {
          await api.post('/auth/logout');
        } catch (e) {
          console.error('Logout failed on server');
        } finally {
          set({ user: null, isAuthenticated: false });
        }
      },

      checkAuth: async () => {
        try {
          const res = await api.get('/user/profile');
          if (res.data.success) {
            set({ user: res.data.user, isAuthenticated: true });
          }
        } catch (error) {
          set({ user: null, isAuthenticated: false });
        }
      },
    }),
    {
      name: 'auth-storage',
    }
  )
);
