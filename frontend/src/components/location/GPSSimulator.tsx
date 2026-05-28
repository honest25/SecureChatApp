"use client";

import { useState } from 'react';
import { useSocket } from '@/hooks/useSocket';
import { useAuthStore } from '@/store/useAuthStore';
import { MapPin } from 'lucide-react';

export default function GPSSimulator() {
  const { socket } = useSocket();
  const user = useAuthStore(state => state.user);

  // Initial fake coords for simulator (safely inside Room 101)
  const [lat, setLat] = useState(28.70415);
  const [lon, setLon] = useState(77.10255);

  const simulateMove = (offsetLat: number, offsetLon: number, name: string) => {
    const newLat = lat + offsetLat;
    const newLon = lon + offsetLon;
    setLat(newLat);
    setLon(newLon);

    if (socket && user?.hostel_name) {
      socket.emit('update_gps_location', { lat: newLat, lon: newLon, hostelName: user.hostel_name });
    }
  };

  return (
    <div className="bg-gray-800 rounded-xl p-4 shadow-lg border border-gray-700 mt-4">
      <div className="flex items-center gap-2 mb-4 pb-2 border-b border-gray-700">
        <MapPin className="text-purple-400 w-5 h-5" />
        <h2 className="text-sm font-semibold text-white">Debug: GPS Tweaker</h2>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-xs text-gray-400 mb-2">Simulate a friend walking near you (broadcasts fake coords).</p>
        
        <button
          onClick={() => simulateMove(0.0001, 0, 'North')}
          className="w-full text-left px-3 py-2 bg-gray-900 hover:bg-gray-700 rounded-lg text-sm text-gray-300 transition-colors"
        >
          Move 10m North
        </button>
        <button
          onClick={() => simulateMove(-0.0001, 0, 'South')}
          className="w-full text-left px-3 py-2 bg-gray-900 hover:bg-gray-700 rounded-lg text-sm text-gray-300 transition-colors"
        >
          Move 10m South
        </button>
        <button
          onClick={() => simulateMove(0.0005, 0.0005, 'Away')}
          className="w-full text-left px-3 py-2 bg-gray-900 hover:bg-gray-700 rounded-lg text-sm text-gray-300 transition-colors"
        >
          Jump 50m Away
        </button>
      </div>
    </div>
  );
}
