"use client";

import { useEffect, useState } from 'react';
import { useSocket } from '@/hooks/useSocket';
import { useAuthStore } from '@/store/useAuthStore';
import { Compass, Navigation, MapPin } from 'lucide-react';

interface RadarUser {
  userId: string;
  userName: string;
  profile_pic_url: string | null;
  gender?: string | null;
  distanceMeters: number;
  roomId?: string | null;
  roomName?: string | null;
  roomNumber?: string | null;
  timestamp: Date;
}

export default function NearbyRadar() {
  const [nearbyUsers, setNearbyUsers] = useState<Map<string, RadarUser>>(new Map());
  const [myLocation, setMyLocation] = useState<{ roomId: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasGPSLock, setHasGPSLock] = useState(false);
  
  const user = useAuthStore(state => state.user);
  const { socket } = useSocket();

  // Watch own location
  useEffect(() => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const coords = { lat: position.coords.latitude, lon: position.coords.longitude };
        setHasGPSLock(true);
        if (!myLocation) setMyLocation({ roomId: null });
        
        // Emit raw GPS securely to backend. Backend handles distances.
        if (socket && user?.hostel_name) {
          socket.emit('update_gps_location', { ...coords, hostelName: user.hostel_name });
        }
      },
      (err) => {
        setError(`GPS Error: ${err.message}`);
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [socket, user, myLocation]);

  // Listen for secure distance updates
  useEffect(() => {
    if (!user || !socket) return;

    socket.emit('join_location_feed', user.hostel_name || 'Hostel 3');

    const handleSelfUpdate = (data: { roomId: string | null }) => {
      setHasGPSLock(true);
      setMyLocation(prev => ({ roomId: data.roomId }));
    };

    const handleBulkSync = (users: RadarUser[]) => {
      setNearbyUsers((prev) => {
        const newMap = new Map(prev);
        users.forEach(u => newMap.set(u.userId, u));
        return newMap;
      });
    };

    const handleSingleUpdate = (u: RadarUser) => {
      setNearbyUsers((prev) => {
        const newMap = new Map(prev);
        newMap.set(u.userId, u);
        return newMap;
      });
    };

    socket.on('self_room_update', handleSelfUpdate);
    socket.on('radar_bulk_sync', handleBulkSync);
    socket.on('nearby_user_update', handleSingleUpdate);

    return () => {
      socket.off('self_room_update', handleSelfUpdate);
      socket.off('radar_bulk_sync', handleBulkSync);
      socket.off('nearby_user_update', handleSingleUpdate);
      socket.emit('leave_location_feed', user.hostel_name || 'Hostel 3');
    };
  }, [user, socket]);

  const sortedNearby = Array.from(nearbyUsers.values())
    .filter(u => u.distanceMeters <= 5000)
    .sort((a, b) => a.distanceMeters - b.distanceMeters);

  return (
    <div className="bg-gray-800 rounded-xl p-4 flex flex-col h-full shadow-lg border border-gray-700">
      <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <Compass className="text-blue-400 w-5 h-5 animate-pulse" />
          <h2 className="text-sm font-semibold text-white">Live Pin-Point Radar</h2>
        </div>
      </div>

      {error && !hasGPSLock && (
        <div className="text-xs text-yellow-400 bg-yellow-900/20 p-3 rounded-lg border border-yellow-800/50 mb-3">
          {error}. Using Debug Simulator.
        </div>
      )}

      {!hasGPSLock ? (
        <div className="text-xs text-gray-400 animate-pulse text-center mt-10">
          Acquiring Secure Satellite & Room lock...
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
          {sortedNearby.length === 0 ? (
            <div className="text-xs text-gray-500 text-center mt-10">
              No one is nearby right now.
            </div>
          ) : (
            sortedNearby.map((person) => {
              const isSameRoom = person.roomId && myLocation?.roomId === person.roomId;
              
              return (
                <div key={person.userId} className={`rounded-lg p-3 flex flex-col gap-2 shadow-sm border transition-colors ${isSameRoom ? 'bg-blue-900/20 border-blue-500/50' : 'bg-gray-900 border-gray-700/50 hover:border-gray-600'}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs shadow-inner ${isSameRoom ? 'bg-blue-500' : 'bg-gradient-to-tr from-purple-500 to-pink-500'}`}>
                        {person.userName[0].toUpperCase()}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm text-gray-200 font-medium">
                          {person.userName}
                          {person.gender === 'MALE' && <span className="ml-1 text-blue-300">♂</span>}
                          {person.gender === 'FEMALE' && <span className="ml-1 text-pink-300">♀</span>}
                        </span>
                        {person.roomName ? (
                           <span className="text-xs text-green-400 flex items-center gap-1">
                             <MapPin className="w-3 h-3" />
                             In {person.roomName} ({person.roomNumber})
                           </span>
                        ) : (
                           <span className="text-xs text-blue-400 flex items-center gap-1">
                             <Navigation className="w-3 h-3" /> 
                             {person.distanceMeters < 10 ? 'Right next to you' : `${person.distanceMeters}m away`}
                           </span>
                        )}
                      </div>
                    </div>
                  </div>
                  {isSameRoom && (
                    <div className="text-xs text-blue-300 bg-blue-900/40 p-1.5 rounded text-center font-medium">
                      In the same room as you!
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
