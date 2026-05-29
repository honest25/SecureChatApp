"use client";

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { useSocket } from '@/hooks/useSocket';
import { Bell, LogOut, Settings, User as UserIcon } from 'lucide-react';
import { api } from '@/lib/axios';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';

interface Notification {
  id: string;
  title: string;
  body: string;
  is_read: boolean;
  created_at: string;
}

export default function TopNavbar() {
  const { user, logout } = useAuthStore();
  const { socket } = useSocket();
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const res = await api.get('/notifications');
        if (res.data.success) {
          setNotifications(res.data.notifications);
        }
      } catch (err) {
        console.error('Failed to fetch notifications', err);
      }
    };
    if (user) {
      fetchNotifications();
    }
  }, [user]);

  useEffect(() => {
    if (!socket || !user) return;

    const handleNewUser = (data: { userName: string, hostelName: string }) => {
      const newNotif: Notification = {
        id: Math.random().toString(), // temporary id
        title: 'New Member Joined!',
        body: `${data.userName} just joined ${data.hostelName}. Say hi!`,
        is_read: false,
        created_at: new Date().toISOString()
      };
      setNotifications(prev => [newNotif, ...prev]);
    };

    socket.on('new_user_joined', handleNewUser);
    return () => {
      socket.off('new_user_joined', handleNewUser);
    };
  }, [socket, user]);

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  const markAllRead = async () => {
    try {
      await api.post('/notifications/mark-all-read');
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch (err) {
      console.error(err);
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div className="h-16 bg-gray-900 border-b border-gray-800 flex items-center justify-between px-6 shadow-md z-50">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 bg-gradient-to-tr from-blue-500 to-indigo-500 rounded-lg flex items-center justify-center text-white font-bold shadow-lg">
          S
        </div>
        <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-400">
          SecureChat
        </h1>
      </div>

      <div className="flex items-center gap-6">
        {/* Notifications Dropdown */}
        <div className="relative">
          <button 
            onClick={() => setShowDropdown(!showDropdown)}
            className="relative p-2 text-gray-400 hover:text-white transition-colors focus:outline-none"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-gray-900 animate-pulse"></span>
            )}
          </button>

          {showDropdown && (
            <div className="absolute right-0 mt-2 w-80 bg-gray-800 border border-gray-700 rounded-xl shadow-2xl overflow-hidden">
              <div className="p-3 border-b border-gray-700 flex justify-between items-center bg-gray-800/50">
                <h3 className="text-sm font-semibold text-white">Notifications</h3>
                {unreadCount > 0 && (
                  <button onClick={markAllRead} className="text-xs text-blue-400 hover:text-blue-300">
                    Mark all read
                  </button>
                )}
              </div>
              <div className="max-h-96 overflow-y-auto custom-scrollbar">
                {notifications.length === 0 ? (
                  <div className="p-4 text-center text-sm text-gray-500">No notifications yet</div>
                ) : (
                  notifications.map(notif => (
                    <div key={notif.id} className={`p-3 border-b border-gray-700/50 hover:bg-gray-750 transition-colors ${!notif.is_read ? 'bg-blue-900/10' : ''}`}>
                      <h4 className={`text-sm ${!notif.is_read ? 'text-white font-semibold' : 'text-gray-300'}`}>{notif.title}</h4>
                      <p className="text-xs text-gray-400 mt-1">{notif.body}</p>
                      <span className="text-[10px] text-gray-500 mt-2 block">
                        {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true })}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Profile Dropdown */}
        <div className="relative">
          <button 
            onClick={() => setShowProfileDropdown(!showProfileDropdown)}
            className="flex items-center gap-2 hover:bg-gray-800 p-1.5 rounded-lg transition-colors focus:outline-none"
          >
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
              {user?.name.charAt(0).toUpperCase()}
            </div>
          </button>

          {showProfileDropdown && (
            <div className="absolute right-0 mt-2 w-48 bg-gray-800 border border-gray-700 rounded-xl shadow-2xl overflow-hidden py-1">
              <div className="px-4 py-3 border-b border-gray-700 bg-gray-800/50">
                <p className="text-sm text-white font-medium truncate">{user?.name}</p>
                <p className="text-xs text-gray-400 truncate">{user?.hostel_name}</p>
              </div>
              
              <button 
                onClick={handleLogout} 
                className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-gray-700 flex items-center gap-2 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
