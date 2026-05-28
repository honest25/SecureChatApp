"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import Sidebar from '@/components/chat/Sidebar';
import ChatArea from '@/components/chat/ChatArea';
import { useSocket } from '@/hooks/useSocket';

export default function ChatLayout() {
  const router = useRouter();
  const { isAuthenticated, checkAuth } = useAuthStore();
  const [loading, setLoading] = useState(true);

  // Initialize socket connection
  useSocket();

  useEffect(() => {
    checkAuth().then(() => {
      if (!useAuthStore.getState().isAuthenticated) {
        router.push('/login');
      } else {
        setLoading(false);
      }
    });
  }, [router, checkAuth]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="h-screen w-full bg-gray-950 flex overflow-hidden font-sans">
      <div className="flex-1 flex max-w-[1600px] mx-auto bg-gray-900 shadow-2xl overflow-hidden w-full h-full">
        <Sidebar />
        <ChatArea />
      </div>
    </div>
  );
}
