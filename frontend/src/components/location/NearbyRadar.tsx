"use client";

import { useEffect, useState } from 'react';
import { useSocket } from '@/hooks/useSocket';
import { useAuthStore } from '@/store/useAuthStore';
import { getDistanceInMeters } from '@/utils/distance';
import { Compass, Navigation } from 'lucide-react';

interface GPSLocationEvent {
  userId: string;
  userName: string;
  profile_pic_url: string | null;
  latitude: number;
  longitude: number;
  timestamp: Date;
}

interface NearbyUser extends GPSLocationEvent {
  distanceMeters: number;
}

export default function NearbyRadar() {
  const [nearbyUsers, setNearbyUsers] = useState<Map<string, NearbyUser>>(new Map());
  const [myLocation, setMyLocation] = useState<{ lat: number, lon: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  
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
        setMyLocation(coords);
        
        // Emit to server
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
  }, [socket, user]);

  // Listen for others' locations
  useEffect(() => {
    if (!user || !socket) return;

    socket.emit('join_location_feed', user.hostel_name || 'Hostel 3');

    const handleGPSUpdate = (event: GPSLocationEvent) => {
      // Ignore own updates
      if (event.userId === user.id) return;

      setNearbyUsers((prev) => {
        const newMap = new Map(prev);
        // Distance will be recalculated during render
        newMap.set(event.userId, { ...event, distanceMeters: 0 });
        return newMap;
      });
    };

    socket.on('user_gps_updated', handleGPSUpdate);

    return () => {
      socket.off('user_gps_updated', handleGPSUpdate);
      socket.emit('leave_location_feed', user.hostel_name || 'Hostel 3');
    };
  }, [user, socket]);

  // Calculate distances and sort
  const sortedNearby = Array.from(nearbyUsers.values())
    .map(u => ({
      ...u,
      distanceMeters: myLocation ? getDistanceInMeters(myLocation.lat, myLocation.lon, u.latitude, u.longitude) : 0
    }))
    .filter(u => myLocation ? u.distanceMeters <= 5000 : true) // Filter out people > 5km away just in case
    .sort((a, b) => a.distanceMeters - b.distanceMeters);

  return (
    <div className="bg-gray-800 rounded-xl p-4 flex flex-col h-full shadow-lg border border-gray-700">
      <div className="flex items-center gap-2 mb-4 pb-2 border-b border-gray-700">
        <Compass className="text-blue-400 w-5 h-5 animate-pulse" />
        <h2 className="text-sm font-semibold text-white">Nearby Radar</h2>
      </div>

      {error ? (
        <div className="text-xs text-red-400 bg-red-900/20 p-3 rounded-lg border border-red-800/50">
          {error}. Please allow Location Permissions.
        </div>
      ) : !myLocation ? (
        <div className="text-xs text-gray-400 animate-pulse text-center mt-10">
          Acquiring GPS satellite lock...
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
          {sortedNearby.length === 0 ? (
            <div className="text-xs text-gray-500 text-center mt-10">
              No one is nearby right now.
            </div>
          ) : (
            sortedNearby.map((person) => (
              <div key={person.userId} className="bg-gray-900 rounded-lg p-3 flex items-center justify-between shadow-sm border border-gray-700/50 hover:border-gray-600 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-xs shadow-inner">
                    {person.userName[0].toUpperCase()}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm text-gray-200 font-medium">{person.userName}</span>
                    <span className="text-xs text-blue-400 flex items-center gap-1">
                      <Navigation className="w-3 h-3" /> 
                      {person.distanceMeters < 10 ? 'Right next to you' : `${person.distanceMeters}m away`}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
