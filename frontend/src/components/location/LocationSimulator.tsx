"use client";

import { useState } from 'react';
import { api } from '@/lib/axios';
import { Navigation } from 'lucide-react';

export default function LocationSimulator() {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const testRooms = [
    { id: '101', name: 'Common Room' },
    { id: '102', name: 'TV Room' },
    { id: '201', name: 'Library' },
    { id: '301', name: 'Gym' },
    { id: '3511', name: 'Anurag Room' },
  ];

  const handleSimulateEntry = async (roomNumber: string) => {
    setLoading(true);
    setStatus(null);
    try {
      // Step 1: We need the actual Room UUID from the database.
      // Since this is just a simulator, we'll try to find the room using the check-in API by just sending the room number
      // We will need a specific API or we can just send it. Let's create an ad-hoc request or assume the backend accepts room IDs.
      // Actually, since we seeded the DB, let's fetch the room list from the backend!
      // Wait, we don't have a GET /rooms API. We'll just hardcode a known "fake" BLE MAC address that maps to it.
      // OR we can just hit a generic test endpoint if we had one.
      
      // Let's use the explicit check-in API and modify our backend to accept `room_number` as fallback!
      // Wait, we can't easily change the backend instantly here.
      // Let's just emit a fake socket event to the UI? No, we want to test the full backend pipeline.
      
      const res = await api.post('/location/simulate', { room_number: roomNumber });
      if (res.data.success) {
        setStatus(`Entered ${roomNumber}`);
      } else {
        setStatus(`Failed: ${res.data.message}`);
      }
    } catch (error) {
      setStatus('Error checking in');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gray-800 rounded-xl p-4 shadow-lg border border-gray-700 mt-4">
      <div className="flex items-center gap-2 mb-4 pb-2 border-b border-gray-700">
        <Navigation className="text-purple-400 w-5 h-5" />
        <h2 className="text-sm font-semibold text-white">Debug: Location Simulator</h2>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-xs text-gray-400 mb-2">Simulate physically walking into a room to trigger Live Feed.</p>
        
        {testRooms.map((room) => (
          <button
            key={room.id}
            onClick={() => handleSimulateEntry(room.id)}
            disabled={loading}
            className="w-full text-left px-3 py-2 bg-gray-900 hover:bg-gray-700 rounded-lg text-sm text-gray-300 transition-colors disabled:opacity-50"
          >
            Enter {room.name} ({room.id})
          </button>
        ))}

        {status && (
          <div className="mt-2 text-xs text-center font-medium text-green-400">
            {status}
          </div>
        )}
      </div>
    </div>
  );
}
