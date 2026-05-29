"use client";

import { useEffect, useState } from 'react';
import { useChatStore } from '@/store/useChatStore';
import { useAuthStore } from '@/store/useAuthStore';
import { api } from '@/lib/axios';
import { Search, LogOut, User as UserIcon } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useRouter } from 'next/navigation';

export default function Sidebar() {
  const { chats, setChats, setActiveChat, activeChatId } = useChatStore();
  const { user, logout } = useAuthStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ id: string; name: string; hostel_name: string }[]>([]);
  const router = useRouter();

  useEffect(() => {
    const fetchChats = async () => {
      try {
        const res = await api.get('/chat');
        if (res.data.success) {
          setChats(res.data.chats);
        }
      } catch (err) {
        console.error('Failed to fetch chats', err);
      }
    };
    fetchChats();
  }, [setChats]);

  const handleSearch = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    if (query.length > 2) {
      try {
        const res = await api.get(`/user/search?query=${query}`);
        if (res.data.success) setSearchResults(res.data.users);
      } catch (err) {
        console.error('Search failed', err);
      }
    } else {
      setSearchResults([]);
    }
  };

  const startChat = async (otherUserId: string) => {
    try {
      const res = await api.post('/chat/start', { otherUserId });
      if (res.data.success) {
        // Refresh chats list to include new chat
        const chatsRes = await api.get('/chat');
        setChats(chatsRes.data.chats);
        setActiveChat(res.data.chat.id);
        setSearchQuery('');
        setSearchResults([]);
      }
    } catch (err) {
      console.error('Start chat failed', err);
    }
  };

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  return (
    <div className="w-1/3 border-r border-gray-700 bg-gray-800 flex flex-col h-full">
      <div className="p-3 bg-gray-900 border-b border-gray-700">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-gray-500" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={handleSearch}
            className="block w-full pl-9 pr-3 py-2 bg-gray-700 border border-gray-600 rounded-full text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
            placeholder="Search friends or hostel mates..."
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {searchResults.length > 0 ? (
          <div className="p-2">
            <h4 className="text-xs font-semibold text-gray-500 uppercase px-2 mb-2">Search Results</h4>
            {searchResults.map((u) => (
              <div 
                key={u.id}
                onClick={() => startChat(u.id)}
                className="flex items-center p-3 hover:bg-gray-700 rounded-lg cursor-pointer transition-colors"
              >
                <div className="w-10 h-10 bg-gray-600 rounded-full flex items-center justify-center mr-3 text-white">
                  <UserIcon className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <h4 className="text-white text-sm font-medium">{u.name}</h4>
                  <p className="text-xs text-gray-400">{u.hostel_name}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div>
            {chats.map((chat) => (
              <div
                key={chat.id}
                onClick={() => setActiveChat(chat.id)}
                className={`flex items-center p-4 cursor-pointer transition-colors border-b border-gray-700/50 ${activeChatId === chat.id ? 'bg-gray-700' : 'hover:bg-gray-700/50'}`}
              >
                <div className="relative">
                  <div className="w-12 h-12 bg-blue-900 rounded-full flex items-center justify-center text-blue-200 font-bold text-lg mr-4">
                    {chat.otherUser.name.charAt(0).toUpperCase()}
                  </div>
                  {chat.otherUser.is_online && (
                    <div className="absolute bottom-0 right-4 w-3.5 h-3.5 bg-green-500 border-2 border-gray-800 rounded-full"></div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline mb-1">
                    <h4 className="text-white font-medium truncate">{chat.otherUser.name}</h4>
                    {chat.lastMessage && (
                      <span className="text-xs text-gray-500">
                        {formatDistanceToNow(new Date(chat.lastMessage.created_at), { addSuffix: true })}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-400 truncate">
                    {chat.lastMessage ? chat.lastMessage.content : 'Start a conversation'}
                  </p>
                </div>
              </div>
            ))}
            {chats.length === 0 && (
              <div className="text-center p-8 text-gray-500">
                <p>No chats yet.</p>
                <p className="text-sm mt-2">Search for friends to start chatting!</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
