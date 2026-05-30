"use client";

import { useEffect, useState, useRef } from 'react';
import { useSocket } from '@/hooks/useSocket';
import { useAuthStore } from '@/store/useAuthStore';
import { Compass, Navigation, MapPin, Map as MapIcon, List as ListIcon } from 'lucide-react';
import dynamic from 'next/dynamic';

// Next.js dynamic import for Leaflet because it relies on window
const LiveMap = dynamic(() => import('./LiveMap'), {
  ssr: false,
  loading: () => <div className="w-full h-[300px] flex items-center justify-center bg-gray-900 rounded-lg animate-pulse text-gray-500">Loading Map...</div>
});

interface RadarUser {
  userId: string;
  userName: string;
  profile_pic_url: string | null;
  gender?: string | null;
  latitude?: number;
  longitude?: number;
  distanceMeters: number;
  roomId?: string | null;
  roomName?: string | null;
  roomNumber?: string | null;
  timestamp: Date;
}

export default function NearbyRadar() {
  const [nearbyUsers, setNearbyUsers] = useState<Map<string, RadarUser>>(new Map());
  const [myLocation, setMyLocation] = useState<{ lat: number, lon: number, roomId: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasGPSLock, setHasGPSLock] = useState(false);
  const [viewMode, setViewMode] = useState<'LIST' | 'MAP'>('LIST');
  
  const user = useAuthStore(state => state.user);
  const { socket } = useSocket();

  const myLocationRef = useRef<{ lat: number, lon: number, roomId: string | null } | null>(null);

  // Keep ref in sync
  useEffect(() => {
    myLocationRef.current = myLocation;
  }, [myLocation]);

  // Watch own location
  useEffect(() => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      return;
    }

    const emitLocation = (coords: { lat: number, lon: number }) => {
      if (socket && user?.hostel_name) {
        socket.emit('update_gps_location', { ...coords, hostelName: user.hostel_name });
      }
    };

    // Fast initial lock
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = { lat: position.coords.latitude, lon: position.coords.longitude };
        setHasGPSLock(true);
        setMyLocation(prev => ({ ...coords, roomId: prev?.roomId || null }));
        emitLocation(coords);
      },
      (err) => console.warn('Initial GPS lock failed:', err),
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 10000 }
    );

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const coords = { lat: position.coords.latitude, lon: position.coords.longitude };
        setHasGPSLock(true);
        setMyLocation(prev => ({ ...coords, roomId: prev?.roomId || null }));
        emitLocation(coords);
      },
      (err) => {
        setError(`GPS Error: ${err.message}`);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );

    // Fallback heartbeat to keep presence fresh even if stationary
    const heartbeat = setInterval(() => {
      if (myLocationRef.current) {
        emitLocation({ lat: myLocationRef.current.lat, lon: myLocationRef.current.lon });
      }
    }, 10000);

    return () => {
      navigator.geolocation.clearWatch(watchId);
      clearInterval(heartbeat);
    };
  }, [socket, user]);

  // Listen for secure distance updates
  useEffect(() => {
    if (!user || !socket) return;

    socket.emit('join_location_feed', user.hostel_name || 'Hostel 3');

    const handleSelfUpdate = (data: { roomId: string | null }) => {
      setHasGPSLock(true);
      setMyLocation(prev => prev ? { ...prev, roomId: data.roomId } : null);
    };

    const handleBulkSync = (users: RadarUser[]) => {
      // Overwrite entirely to remove stale users
      setNearbyUsers(() => {
        const newMap = new Map<string, RadarUser>();
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
        
        {/* View Toggle */}
        <div className="flex bg-gray-900 rounded-lg p-1 border border-gray-700">
          <button 
            onClick={() => setViewMode('LIST')}
            className={`p-1.5 rounded-md transition-colors ${viewMode === 'LIST' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
          >
            <ListIcon className="w-4 h-4" />
          </button>
          <button 
            onClick={() => setViewMode('MAP')}
            className={`p-1.5 rounded-md transition-colors ${viewMode === 'MAP' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
          >
            <MapIcon className="w-4 h-4" />
          </button>
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
        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
          {viewMode === 'MAP' && myLocation ? (
             <div className="h-full min-h-[350px]">
               <LiveMap myLat={myLocation.lat} myLon={myLocation.lon} nearbyUsers={sortedNearby} />
             </div>
          ) : (
            <div className="space-y-3">
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
      )}
    </div>
  );
}
