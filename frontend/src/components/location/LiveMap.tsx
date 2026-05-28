"use client";

import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polygon, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Compass, User, Users } from 'lucide-react';
import api from '@/utils/api';

// Create a custom icon for the current user
const myIcon = new L.DivIcon({
  className: 'custom-leaflet-icon',
  html: `<div style="background-color: #3b82f6; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 10px rgba(59, 130, 246, 0.8); animation: pulse 2s infinite;"></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8]
});

// Create custom icons for nearby users (Pink for Female, Blue for Male, Purple for Other)
const getOtherIcon = (gender?: string | null) => {
  let color = '#a855f7'; // Purple default
  if (gender === 'MALE') color = '#60a5fa'; // Blue
  if (gender === 'FEMALE') color = '#f472b6'; // Pink
  
  return new L.DivIcon({
    className: 'custom-leaflet-icon',
    html: `<div style="background-color: ${color}; width: 14px; height: 14px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 8px rgba(0,0,0,0.5);"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7]
  });
};

interface RoomPolygon {
  id: string;
  name: string | null;
  room_number: string;
  polygon_coordinates: [number, number][]; // [lat, lon] tuples
}

// Map Component to dynamically center
const MapCenterer = ({ center }: { center: [number, number] }) => {
  const map = useMap();
  useEffect(() => {
    map.flyTo(center, 19, { animate: true });
  }, [center, map]);
  return null;
};

interface LiveMapProps {
  myLat: number;
  myLon: number;
  nearbyUsers: any[];
}

export default function LiveMap({ myLat, myLon, nearbyUsers }: LiveMapProps) {
  const [rooms, setRooms] = useState<RoomPolygon[]>([]);
  const [activeRoomIds, setActiveRoomIds] = useState<Set<string>>(new Set());

  // Fetch Rooms to draw floorplan polygons
  useEffect(() => {
    const fetchRooms = async () => {
      try {
        const res = await api.get('/location/rooms');
        if (res.data.success && Array.isArray(res.data.rooms)) {
          // Verify format: some JSON might be [{lat, lon}] or [[lat, lon]]
          const parsedRooms = res.data.rooms.map((r: any) => {
            // Defensive parsing if coordinates are not strict [lat, lon] arrays
            let coords = r.polygon_coordinates;
            if (typeof coords === 'string') {
                try { coords = JSON.parse(coords); } catch (e) {}
            }
            return {
              ...r,
              polygon_coordinates: coords
            };
          }).filter((r: any) => Array.isArray(r.polygon_coordinates) && r.polygon_coordinates.length >= 3);
          
          setRooms(parsedRooms);
        }
      } catch (err) {
        console.error("Failed to fetch rooms for map", err);
      }
    };
    fetchRooms();
  }, []);

  // Determine active rooms based on nearby users
  useEffect(() => {
    const active = new Set<string>();
    nearbyUsers.forEach(u => {
      if (u.roomId) active.add(u.roomId);
    });
    setActiveRoomIds(active);
  }, [nearbyUsers]);

  const center: [number, number] = [myLat, myLon];

  return (
    <div className="w-full h-full min-h-[300px] rounded-lg overflow-hidden relative border border-gray-700 shadow-inner">
      <style>{`
        @keyframes pulse {
          0% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.7); }
          70% { box-shadow: 0 0 0 10px rgba(59, 130, 246, 0); }
          100% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0); }
        }
        .leaflet-container { background: #1a1a2e; }
        .dark-tiles { filter: invert(100%) hue-rotate(180deg) brightness(95%) contrast(90%); }
        .leaflet-popup-content-wrapper { background: #1f2937; color: white; border-radius: 8px; border: 1px solid #374151; }
        .leaflet-popup-tip { background: #1f2937; }
      `}</style>
      
      <MapContainer center={center} zoom={19} scrollWheelZoom={true} className="w-full h-full z-0">
        {/* Dark Mode OpenStreetMap Tiles */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/">OSM</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          className="dark-tiles"
        />

        <MapCenterer center={center} />

        {/* 1. Radar Circles (10m, 50m, 100m) */}
        <Circle center={center} radius={10} pathOptions={{ color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.1, weight: 1, dashArray: '4' }} />
        <Circle center={center} radius={50} pathOptions={{ color: '#8b5cf6', fillColor: '#8b5cf6', fillOpacity: 0.05, weight: 1, dashArray: '4' }} />
        <Circle center={center} radius={100} pathOptions={{ color: '#ec4899', fillColor: '#ec4899', fillOpacity: 0.02, weight: 1, dashArray: '4' }} />

        {/* 2. Room Floorplans (Polygons) */}
        {rooms.map((room) => {
          const isActive = activeRoomIds.has(room.id);
          return (
            <Polygon 
              key={room.id} 
              positions={room.polygon_coordinates} 
              pathOptions={{ 
                color: isActive ? '#4ade80' : '#4b5563', 
                fillColor: isActive ? '#4ade80' : '#1f2937', 
                fillOpacity: isActive ? 0.3 : 0.4,
                weight: isActive ? 2 : 1
              }} 
            >
              <Popup>
                <div className="font-semibold">{room.name || 'Room'} ({room.room_number})</div>
                <div className="text-xs text-gray-400 mt-1">{isActive ? 'Users are active here' : 'Empty'}</div>
              </Popup>
            </Polygon>
          );
        })}

        {/* 3. My Location Marker */}
        <Marker position={center} icon={myIcon} zIndexOffset={1000}>
          <Popup>
            <div className="text-center">
              <strong className="text-blue-400">You are here</strong>
            </div>
          </Popup>
        </Marker>

        {/* 4. Nearby Users Markers */}
        {nearbyUsers.map(user => {
          if (!user.latitude || !user.longitude) return null;
          
          return (
            <Marker 
              key={user.userId} 
              position={[user.latitude, user.longitude]} 
              icon={getOtherIcon(user.gender)}
            >
              <Popup>
                <div className="flex flex-col gap-1 min-w-[120px]">
                  <div className="font-bold flex items-center gap-1">
                    {user.userName}
                    {user.gender === 'MALE' && <span className="text-blue-400">♂</span>}
                    {user.gender === 'FEMALE' && <span className="text-pink-400">♀</span>}
                  </div>
                  <div className="text-xs text-gray-300">
                    Distance: <strong className="text-white">{user.distanceMeters}m</strong>
                  </div>
                  {user.roomName && (
                    <div className="text-xs text-green-400 mt-1 bg-green-900/30 p-1 rounded">
                      In {user.roomName} ({user.roomNumber})
                    </div>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
      
      {/* HUD Overlays */}
      <div className="absolute top-2 left-2 z-[400] pointer-events-none">
        <div className="bg-gray-900/80 backdrop-blur text-xs px-2 py-1 rounded border border-gray-700 text-gray-300 flex items-center gap-1">
          <Compass className="w-3 h-3 text-blue-400" />
          Radar Active
        </div>
      </div>
      <div className="absolute bottom-2 right-2 z-[400] pointer-events-none flex gap-2">
         <div className="bg-gray-900/80 backdrop-blur text-[10px] px-2 py-1 rounded border border-gray-700 text-gray-400 flex items-center gap-1">
           <div className="w-2 h-2 rounded-full bg-[#4ade80]"></div>
           Active Room
         </div>
      </div>
    </div>
  );
}
