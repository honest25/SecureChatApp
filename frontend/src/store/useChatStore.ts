import { create } from 'zustand';

interface Message {
  id: string;
  chat_id: string;
  sender_id: string;
  content: string;
  type: 'TEXT' | 'IMAGE' | 'FILE';
  media_url?: string;
  is_read: boolean;
  created_at: string;
}

interface Chat {
  id: string;
  otherUser: {
    id: string;
    name: string;
    profile_pic_url?: string;
    is_online: boolean;
  };
  lastMessage?: Message;
  updated_at: string;
}

interface ChatState {
  chats: Chat[];
  activeChatId: string | null;
  messages: Record<string, Message[]>; // chatId -> messages
  typingStatus: Record<string, boolean>; // chatId -> isTyping
  setChats: (chats: Chat[]) => void;
  setActiveChat: (chatId: string | null) => void;
  setMessages: (chatId: string, messages: Message[]) => void;
  addMessage: (chatId: string, message: Message) => void;
  updateTyping: (chatId: string, isTyping: boolean) => void;
  updateUserStatus: (userId: string, isOnline: boolean) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  chats: [],
  activeChatId: null,
  messages: {},
  typingStatus: {},

  setChats: (chats) => set({ chats }),
  
  setActiveChat: (chatId) => set({ activeChatId: chatId }),
  
  setMessages: (chatId, newMessages) => set((state) => ({
    messages: { ...state.messages, [chatId]: newMessages }
  })),
  
  addMessage: (chatId, message) => set((state) => {
    const chatMessages = state.messages[chatId] || [];
    // Only add if it doesn't exist
    if (chatMessages.find(m => m.id === message.id)) return state;
    
    return {
      messages: { ...state.messages, [chatId]: [...chatMessages, message] }
    };
  }),

  updateTyping: (chatId, isTyping) => set((state) => ({
    typingStatus: { ...state.typingStatus, [chatId]: isTyping }
  })),

  updateUserStatus: (userId, isOnline) => set((state) => ({
    chats: state.chats.map(chat => 
      chat.otherUser.id === userId 
        ? { ...chat, otherUser: { ...chat.otherUser, is_online: isOnline } }
        : chat
    )
  })),
}));
