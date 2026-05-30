"use client";

import { useEffect, useState, useRef } from 'react';
import { useChatStore } from '@/store/useChatStore';
import { useAuthStore } from '@/store/useAuthStore';
import { api, getBaseUrl } from '@/lib/axios';
import { Send, Image as ImageIcon, Paperclip, Smile } from 'lucide-react';
import { format } from 'date-fns';
import { useSocket } from '@/hooks/useSocket';
import UserProfileModal from '@/components/profile/UserProfileModal';

const COMMON_EMOJIS = ['😀', '😂', '🤣', '😊', '😍', '🙏', '👍', '👎', '❤️', '🔥', '🎉', '👏', '😭', '🥺', '🤔', '😎', '🙌', '✨'];

export default function ChatArea() {
  const { activeChatId, chats, messages, setMessages, typingStatus } = useChatStore();
  const { user } = useAuthStore();
  const { sendMessage, joinChat, emitTyping, emitStopTyping } = useSocket();
  const [inputText, setInputText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const activeChat = chats.find(c => c.id === activeChatId);
  const chatMessages = activeChatId ? messages[activeChatId] || [] : [];
  const isTyping = activeChatId ? typingStatus[activeChatId] : false;

  useEffect(() => {
    if (activeChatId) {
      joinChat(activeChatId);
      // Fetch history if not already loaded
      if (!messages[activeChatId]) {
        api.get(`/chat/${activeChatId}/history`).then((res) => {
          if (res.data.success) {
            setMessages(activeChatId, res.data.messages);
          }
        });
      }
    }
  }, [activeChatId]);

  useEffect(() => {
    // Scroll to bottom
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, isTyping]);

  const handleTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);
    
    if (activeChatId && activeChat) {
      emitTyping(activeChatId, activeChat.otherUser.id);
      
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      
      typingTimeoutRef.current = setTimeout(() => {
        emitStopTyping(activeChatId, activeChat.otherUser.id);
      }, 2000);
    }
  };

  const onEmojiClick = (emoji: string) => {
    setInputText((prev) => prev + emoji);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() && !file) return;
    if (!activeChatId) return;

    let mediaUrl = undefined;
    let type: 'TEXT' | 'IMAGE' | 'FILE' = 'TEXT';
    let fileName = undefined;

    if (file) {
      const formData = new FormData();
      formData.append('media', file);
      try {
        const res = await api.post('/chat/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        mediaUrl = res.data.url;
        type = file.type.startsWith('image/') ? 'IMAGE' : 'FILE';
        fileName = file.name;
      } catch (err) {
        console.error('File upload failed', err);
        return;
      }
    }

    sendMessage(activeChatId, inputText, type, mediaUrl, fileName);
    setInputText('');
    setFile(null);
    setShowEmojiPicker(false);
    if (activeChat) emitStopTyping(activeChatId, activeChat.otherUser.id);
  };

  const [viewProfileUserId, setViewProfileUserId] = useState<string | null>(null);

  if (!activeChat) {
    return (
      <div className="flex-1 bg-gray-900 flex flex-col items-center justify-center text-gray-500">
        <div className="w-24 h-24 mb-6 opacity-20">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </div>
        <h2 className="text-2xl font-light text-white mb-2">SecureChat Web</h2>
        <p>Select a conversation or search for a friend to start chatting.</p>
        <p className="mt-4 text-xs text-gray-600">Messages are end-to-end secured and auto-deleted after 7 hours.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-gray-900 relative h-full">
      {/* Profile Modal */}
      {viewProfileUserId && (
        <UserProfileModal 
          userId={viewProfileUserId} 
          onClose={() => setViewProfileUserId(null)} 
        />
      )}

      {/* Header */}
      <div className="h-16 px-6 bg-gray-800 border-b border-gray-700 flex items-center justify-between z-10 shadow-sm hover:bg-gray-750 transition-colors cursor-pointer" onClick={() => setViewProfileUserId(activeChat.otherUser.id)}>
        <div className="flex items-center w-full">
          <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold mr-4 shadow-md">
            {activeChat.otherUser.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1">
            <h2 className="text-white font-medium flex items-center gap-2">
              {activeChat.otherUser.name}
              <span className="text-[10px] bg-gray-700 text-gray-300 px-2 py-0.5 rounded-full border border-gray-600">View Profile</span>
            </h2>
            <p className="text-xs text-gray-400">
              {activeChat.otherUser.is_online ? 'Online' : 'Offline'}
            </p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4 relative" onClick={() => setShowEmojiPicker(false)}>
        <div className="text-center text-xs text-gray-500 my-4 bg-gray-800/50 py-2 rounded-lg mx-auto w-fit px-4 border border-gray-700">
          Messages in this chat will auto-delete after 7 hours for security.
        </div>

        {chatMessages.map((msg) => {
          const isMine = msg.sender_id === user?.id;
          
          const getMediaUrl = (url: string) => {
            if (url.startsWith('http://localhost:5000')) {
              return url.replace('http://localhost:5000', getBaseUrl());
            }
            if (url.startsWith('http')) return url;
            return `${getBaseUrl()}${url}`;
          };

          return (
            <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[70%] rounded-2xl px-4 py-2 ${isMine ? 'bg-blue-600 text-white rounded-br-sm' : 'bg-gray-800 text-gray-100 border border-gray-700 rounded-bl-sm'}`}>
                {msg.media_url && (
                  <div className="mb-2">
                    {msg.type === 'IMAGE' ? (
                      <a href={`${getBaseUrl()}/download?url=${encodeURIComponent(msg.media_url)}&name=${encodeURIComponent(msg.file_name || 'image')}`} title="Click to download image">
                        <img src={getMediaUrl(msg.media_url)} alt="Attachment" className="rounded-lg max-h-64 object-contain hover:opacity-80 transition cursor-pointer" />
                      </a>
                    ) : msg.media_url.match(/\.(mp3|wav|ogg|m4a)$/i) ? (
                      <div className="flex flex-col gap-1">
                        <span className="text-xs text-blue-200 truncate max-w-[200px]">{msg.file_name || 'Audio file'}</span>
                        <audio controls src={getMediaUrl(msg.media_url)} className="max-w-full h-10 custom-audio" />
                      </div>
                    ) : msg.media_url.match(/\.(mp4|webm|mov)$/i) ? (
                      <div className="flex flex-col gap-1">
                        <span className="text-xs text-blue-200 truncate max-w-[200px]">{msg.file_name || 'Video file'}</span>
                        <video controls src={getMediaUrl(msg.media_url)} className="max-w-full max-h-64 rounded-lg" />
                      </div>
                    ) : (
                      <a href={`${getBaseUrl()}/download?url=${encodeURIComponent(msg.media_url)}&name=${encodeURIComponent(msg.file_name || 'document')}`} className="flex items-center text-blue-200 underline break-all" title="Click to download document">
                        <Paperclip className="w-4 h-4 mr-1 flex-shrink-0" /> {msg.file_name || 'View File'}
                      </a>
                    )}
                  </div>
                )}
                {msg.content && <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{msg.content}</p>}
                <div className={`text-[10px] mt-1 text-right ${isMine ? 'text-blue-200' : 'text-gray-500'}`}>
                  {format(new Date(msg.created_at), 'HH:mm')}
                </div>
              </div>
            </div>
          );
        })}
        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-gray-800 text-gray-400 rounded-2xl rounded-bl-sm px-4 py-2 flex items-center space-x-1">
              <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></div>
              <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-gray-800 border-t border-gray-700 relative">
        {showEmojiPicker && (
          <div className="absolute bottom-full left-4 mb-2 z-50 bg-gray-800 border border-gray-700 p-2 rounded-lg shadow-lg flex flex-wrap gap-2 w-64">
            {COMMON_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                className="text-xl p-1 hover:bg-gray-700 rounded transition"
                onClick={() => onEmojiClick(emoji)}
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
        
        {file && (
          <div className="mb-2 p-2 bg-gray-700 rounded-lg text-sm text-gray-300 flex items-center justify-between w-fit">
            <span className="truncate max-w-xs">{file.name}</span>
            <button onClick={() => setFile(null)} className="ml-4 text-red-400 hover:text-red-300">✕</button>
          </div>
        )}
        
        <form onSubmit={handleSend} className="flex items-end space-x-2">
          <div className="flex-1 bg-gray-700 rounded-2xl flex items-center border border-gray-600 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 transition-all overflow-visible">
            <button
              type="button"
              className="p-3 text-gray-400 hover:text-white transition"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              title="Add Emoji"
            >
              <Smile className="w-5 h-5" />
            </button>
            <label className="p-3 pl-0 text-gray-400 hover:text-white cursor-pointer transition" title="Attach file, image, or document">
              <Paperclip className="w-5 h-5" />
              <input type="file" className="hidden" accept="*/*" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            </label>
            <input
              type="text"
              value={inputText}
              onChange={handleTyping}
              onFocus={() => setShowEmojiPicker(false)}
              placeholder="Type a message..."
              className="flex-1 bg-transparent text-white focus:outline-none py-3 pr-4 placeholder-gray-500"
            />
          </div>
          <button
            type="submit"
            disabled={!inputText.trim() && !file}
            className="p-3 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
          >
            <Send className="w-5 h-5 ml-1" />
          </button>
        </form>
      </div>
    </div>
  );
}
