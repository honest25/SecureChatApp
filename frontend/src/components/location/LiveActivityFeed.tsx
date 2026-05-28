"use client";

import { useEffect, useState } from 'react';
import { useSocket } from '@/hooks/useSocket';
import { useAuthStore } from '@/store/useAuthStore';
import { MapPin, Activity } from 'lucide-react';

interface LocationEvent {
  userId: string;
  userName: string;
  profile_pic_url: string | null;
  room: {
    id: string;
    room_number: string;
    floor: number;
    name: string | null;
  };
  action: 'ENTERED' | 'ENTERED_VIA_QR';
  timestamp: Date;
}

export default function LiveActivityFeed() {
  const [events, setEvents] = useState<LocationEvent[]>([]);
  const user = useAuthStore(state => state.user);
  const { socket } = useSocket();

  useEffect(() => {
    if (!user || !socket) return;

    // Join the hostel-specific location feed
    socket.emit('join_location_feed', user.hostel_name || 'Hostel 3');

    const handleUserMoved = (event: LocationEvent) => {
      setEvents((prev) => [event, ...prev].slice(0, 50)); // Keep last 50 events
    };

    socket.on('user_moved', handleUserMoved);

    return () => {
      socket.off('user_moved', handleUserMoved);
      socket.emit('leave_location_feed', user.hostel_name || 'Hostel 3');
    };
  }, [user, socket]);

  return (
    <div className="bg-gray-800 rounded-xl p-4 flex flex-col h-full shadow-lg border border-gray-700">
      <div className="flex items-center gap-2 mb-4 pb-2 border-b border-gray-700">
        <Activity className="text-green-400 w-5 h-5 animate-pulse" />
        <h2 className="text-lg font-semibold text-white">Live Campus Activity</h2>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
        {events.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            No recent movement detected.
          </div>
        ) : (
          events.map((event, idx) => (
            <div key={idx} className="flex gap-3 p-3 bg-gray-900/50 rounded-lg hover:bg-gray-700/50 transition-colors">
              <div className="w-10 h-10 rounded-full bg-gray-700 overflow-hidden flex-shrink-0">
                {event.profile_pic_url ? (
                  <img src={event.profile_pic_url} alt={event.userName} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-white bg-blue-600 font-medium">
                    {event.userName.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="flex flex-col justify-center">
                <span className="text-sm text-gray-300">
                  <strong className="text-white">{event.userName}</strong> entered
                </span>
                <span className="text-xs font-medium text-blue-400 flex items-center gap-1 mt-1">
                  <MapPin className="w-3 h-3" />
                  {event.room.name ? event.room.name : `Room ${event.room.room_number} (Floor ${event.room.floor})`}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
