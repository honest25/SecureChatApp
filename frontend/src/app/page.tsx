"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';

export default function Home() {
  const router = useRouter();
  const { isAuthenticated, checkAuth } = useAuthStore();

  useEffect(() => {
    checkAuth().then(() => {
      if (useAuthStore.getState().isAuthenticated) {
        router.push('/chat');
      } else {
        router.push('/login');
      }
    });
  }, [router, checkAuth]);

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
    </div>
  );
}
