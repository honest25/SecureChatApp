"use client";

import { useEffect, useState } from 'react';
import { api } from '@/lib/axios';
import { X, User as UserIcon, MapPin, Home, Info, GraduationCap, Briefcase } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface UserProfileModalProps {
  userId: string;
  onClose: () => void;
}

interface UserProfile {
  id: string;
  name: string;
  gender: string | null;
  room_number: string | null;
  hostel_name: string | null;
  profession: string | null;
  college_name: string | null;
  college_location: string | null;
  company_name: string | null;
  company_location: string | null;
  profile_pic_url: string | null;
  is_online: boolean;
  last_seen: string | null;
}

export default function UserProfileModal({ userId, onClose }: UserProfileModalProps) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await api.get(`/user/profile/${userId}`);
        if (res.data.success) {
          setProfile(res.data.user);
        }
      } catch (err) {
        console.error('Failed to fetch user profile', err);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [userId]);

  return (
    <div className="fixed inset-0 z-[600] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-gray-800 rounded-xl shadow-2xl w-full max-w-sm border border-gray-700 overflow-hidden relative">
        <button 
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-400 hover:text-white bg-gray-900/50 hover:bg-gray-700 rounded-full p-1 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {loading ? (
          <div className="p-8 flex justify-center">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : profile ? (
          <div className="flex flex-col">
            <div className="bg-gray-900 p-6 flex flex-col items-center justify-center border-b border-gray-700 relative">
              <div className="relative">
                {profile.profile_pic_url ? (
                  <img src={profile.profile_pic_url} alt={profile.name} className="w-24 h-24 rounded-full object-cover border-4 border-gray-800 shadow-lg" />
                ) : (
                  <div className="w-24 h-24 bg-gradient-to-br from-blue-600 to-blue-800 rounded-full flex items-center justify-center text-white shadow-lg border-4 border-gray-800">
                    <UserIcon className="w-10 h-10" />
                  </div>
                )}
                {profile.is_online && (
                  <div className="absolute bottom-1 right-1 w-5 h-5 bg-green-500 border-4 border-gray-900 rounded-full"></div>
                )}
              </div>
              <h3 className="mt-4 text-xl font-bold text-white flex items-center gap-2">
                {profile.name}
                {profile.gender === 'MALE' && <span className="text-blue-400 text-sm" title="Male">♂</span>}
                {profile.gender === 'FEMALE' && <span className="text-pink-400 text-sm" title="Female">♀</span>}
              </h3>
              <p className="text-sm text-gray-400 mt-1">
                {profile.is_online ? 'Online now' : profile.last_seen ? `Last seen ${formatDistanceToNow(new Date(profile.last_seen), { addSuffix: true })}` : 'Offline'}
              </p>
            </div>

            <div className="p-5 space-y-4">
              
              {/* Profession Section */}
              {profile.profession === 'STUDENT' && (
                <div className="flex items-center gap-3 bg-blue-900/30 p-3 rounded-lg border border-blue-700/50">
                  <GraduationCap className="w-5 h-5 text-blue-400" />
                  <div>
                    <p className="text-xs text-blue-300/70 uppercase font-semibold">Student</p>
                    <p className="text-sm text-blue-100">
                      Studies at {profile.college_name || 'College'}
                      {profile.college_location ? ` in ${profile.college_location}` : ''}
                    </p>
                  </div>
                </div>
              )}
              
              {profile.profession === 'PROFESSIONAL' && (
                <div className="flex items-center gap-3 bg-emerald-900/30 p-3 rounded-lg border border-emerald-700/50">
                  <Briefcase className="w-5 h-5 text-emerald-400" />
                  <div>
                    <p className="text-xs text-emerald-300/70 uppercase font-semibold">Professional</p>
                    <p className="text-sm text-emerald-100">
                      Works at {profile.company_name || 'Company'} 
                      {profile.company_location ? ` in ${profile.company_location}` : ''}
                    </p>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3 bg-gray-700/30 p-3 rounded-lg border border-gray-700/50">
                <Home className="w-5 h-5 text-purple-400" />
                <div>
                  <p className="text-xs text-gray-400 uppercase font-semibold">Hostel Name</p>
                  <p className="text-sm text-white">{profile.hostel_name || 'Not specified'}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 bg-gray-700/30 p-3 rounded-lg border border-gray-700/50">
                <MapPin className="w-5 h-5 text-blue-400" />
                <div>
                  <p className="text-xs text-gray-400 uppercase font-semibold">Room Number</p>
                  <p className="text-sm text-white">{profile.room_number || 'Not specified'}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 bg-gray-700/30 p-3 rounded-lg border border-gray-700/50">
                <Info className="w-5 h-5 text-pink-400" />
                <div>
                  <p className="text-xs text-gray-400 uppercase font-semibold">Gender</p>
                  <p className="text-sm text-white capitalize">{profile.gender?.toLowerCase() || 'Not specified'}</p>
                </div>
              </div>
            </div>
            
            <div className="p-4 bg-gray-900 border-t border-gray-700">
              <button 
                onClick={onClose}
                className="w-full py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors text-sm font-medium border border-gray-600"
              >
                Close Profile
              </button>
            </div>
          </div>
        ) : (
          <div className="p-8 text-center text-gray-400">
            User profile not found.
          </div>
        )}
      </div>
    </div>
  );
}
