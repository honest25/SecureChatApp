import { Request, Response, NextFunction, Router } from 'express';
import { prisma } from '../config/db';
import { requireAuth } from '../middlewares/authMiddleware';
import { upload } from '../middlewares/uploadMiddleware';
import { z } from 'zod';

export const getChats = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const chats = await prisma.chat.findMany({
      where: { OR: [{ user1_id: userId }, { user2_id: userId }] },
      include: {
        user1: { select: { id: true, name: true, profile_pic_url: true, is_online: true, hostel_name: true, live_presence: { include: { room: true } } } },
        user2: { select: { id: true, name: true, profile_pic_url: true, is_online: true, hostel_name: true, live_presence: { include: { room: true } } } },
        messages: {
          orderBy: { created_at: 'desc' },
          take: 1, // Get last message
        }
      }
    });

    // Format response
    const formattedChats = chats.map(chat => {
      const otherUser = chat.user1_id === userId ? chat.user2 : chat.user1;
      return {
        id: chat.id,
        otherUser,
        lastMessage: chat.messages[0] || null,
        updated_at: chat.updated_at
      };
    });

    res.json({ success: true, chats: formattedChats });
  } catch (error) {
    next(error);
  }
};

export const getChatHistory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { chatId } = req.params;
    const messages = await prisma.message.findMany({
      where: { chat_id: chatId },
      orderBy: { created_at: 'asc' }
    });
    res.json({ success: true, messages });
  } catch (error) {
    next(error);
  }
};

export const createOrGetChat = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { otherUserId } = req.body;
    const userId = req.user!.userId;

    if (userId === otherUserId) {
      return res.status(400).json({ success: false, message: 'Cannot chat with yourself' });
    }

    let chat = await prisma.chat.findFirst({
      where: {
        OR: [
          { user1_id: userId, user2_id: otherUserId },
          { user1_id: otherUserId, user2_id: userId },
        ]
      }
    });

    if (!chat) {
      chat = await prisma.chat.create({
        data: { user1_id: userId, user2_id: otherUserId }
      });
    }

    res.json({ success: true, chat });
  } catch (error) {
    next(error);
  }
};

export const uploadMedia = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file provided' });
    }
    
    // Return the relative path. The frontend will prepend the correct backend URL based on its environment.
    const fileUrl = `/uploads/${req.file.filename}`;
    
    res.json({ success: true, url: fileUrl });
  } catch (error) {
    next(error);
  }
};

const router = Router();
router.use(requireAuth);
router.get('/', getChats);
router.post('/start', createOrGetChat);
router.get('/:chatId/history', getChatHistory);
router.post('/upload', upload.single('media'), uploadMedia);

export default router;
