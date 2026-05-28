"use client";

import { useEffect, useState } from 'react';
import { api } from '@/lib/axios';
import { Users } from 'lucide-react';

interface ActiveUser {
  id: string;
  name: string;
  profile_pic_url: string | null;
}

export default function RoomOccupancy({ roomId, roomName }: { roomId: string, roomName: string }) {
  const [users, setUsers] = useState<ActiveUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await api.get(`/location/rooms/${roomId}/active-users`);
        if (res.data.success) {
          setUsers(res.data.users);
        }
      } catch (err) {
        console.error('Failed to fetch room occupancy');
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
    
    // Poll every 30 seconds as fallback, though socket events are primary
    const interval = setInterval(fetchUsers, 30000);
    return () => clearInterval(interval);
  }, [roomId]);

  return (
    <div className="bg-gray-800 rounded-xl p-4 shadow-lg border border-gray-700">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Users className="text-blue-400 w-5 h-5" />
          <h2 className="text-lg font-semibold text-white">{roomName}</h2>
        </div>
        <span className="bg-blue-600/20 text-blue-400 text-xs px-2 py-1 rounded-full font-medium">
          {users.length} Active
        </span>
      </div>

      {loading ? (
        <div className="h-20 flex items-center justify-center">
          <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : users.length === 0 ? (
        <div className="text-center text-sm text-gray-500 py-4">Room is empty</div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {users.map(u => (
            <div key={u.id} className="relative group cursor-pointer">
              {u.profile_pic_url ? (
                <img src={u.profile_pic_url} alt={u.name} className="w-8 h-8 rounded-full ring-2 ring-gray-700" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold text-white ring-2 ring-gray-700">
                  {u.name.charAt(0).toUpperCase()}
                </div>
              )}
              {/* Tooltip */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 whitespace-nowrap transition-opacity pointer-events-none z-10">
                {u.name}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
