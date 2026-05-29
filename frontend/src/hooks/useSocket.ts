import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '../store/useAuthStore';
import { useChatStore } from '../store/useChatStore';

export const useSocket = () => {
  const socketRef = useRef<Socket | null>(null);
  const { isAuthenticated, user, accessToken } = useAuthStore();
  const { addMessage, updateTyping, updateUserStatus } = useChatStore();

  useEffect(() => {
    if (isAuthenticated && user && !socketRef.current) {
      let socketUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
      if (typeof window !== 'undefined') {
        const hostname = window.location.hostname;
        const isLocalNetworkIP = /^(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/.test(hostname);
        
        if (isLocalNetworkIP) {
          socketUrl = `http://${hostname}:5000`;
        } else if (hostname.includes('vercel.app')) {
          socketUrl = 'https://securechatapp-backend.onrender.com';
        }
      }

      socketRef.current = io(socketUrl, {
        withCredentials: true,
        auth: { token: accessToken }
      });

      const socket = socketRef.current;

      socket.on('connect', () => {
        console.log('Socket connected');
      });

      socket.on('receive_message', (message) => {
        addMessage(message.chat_id, message);
      });

      socket.on('typing', ({ chatId }) => {
        updateTyping(chatId, true);
      });

      socket.on('stop_typing', ({ chatId }) => {
        updateTyping(chatId, false);
      });

      socket.on('user_status', ({ userId, isOnline }) => {
        updateUserStatus(userId, isOnline);
      });

      return () => {
        socket.disconnect();
        socketRef.current = null;
      };
    }
  }, [isAuthenticated, user, addMessage, updateTyping, updateUserStatus]);

  const joinChat = (chatId: string) => {
    socketRef.current?.emit('join_chat', chatId);
  };

  const sendMessage = (chatId: string, content: string, type: 'TEXT' | 'IMAGE' | 'FILE' = 'TEXT', mediaUrl?: string, fileName?: string) => {
    socketRef.current?.emit('send_message', { chatId, content, type, mediaUrl, fileName });
  };

  const emitTyping = (chatId: string, receiverId: string) => {
    socketRef.current?.emit('typing', { chatId, receiverId });
  };

  const emitStopTyping = (chatId: string, receiverId: string) => {
    socketRef.current?.emit('stop_typing', { chatId, receiverId });
  };

  return { socket: socketRef.current, joinChat, sendMessage, emitTyping, emitStopTyping };
};
