import { Request, Response, NextFunction, Router } from 'express';
import { prisma } from '../config/db';
import { requireAuth } from '../middlewares/authMiddleware';
import { z } from 'zod';

const updateProfileSchema = z.object({
  name: z.string().min(2).optional(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional(),
  room_number: z.string().min(1).optional(),
  hostel_name: z.string().min(1).optional(),
  mobile: z.string().optional(),
});

export const getProfile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: {
        id: true, email: true, name: true, gender: true,
        room_number: true, hostel_name: true, mobile: true,
        profile_pic_url: true, is_online: true, last_seen: true, created_at: true
      }
    });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, user });
  } catch (error) {
    next(error);
  }
};

export const updateProfile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = updateProfileSchema.parse(req.body);
    const user = await prisma.user.update({
      where: { id: req.user!.userId },
      data,
      select: { id: true, name: true, room_number: true, hostel_name: true }
    });
    res.json({ success: true, user });
  } catch (error) {
    next(error);
  }
};

export const searchUsers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { query } = req.query;
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ success: false, message: 'Search query required' });
    }

    const users = await prisma.user.findMany({
      where: {
        OR: [
          { name: { contains: query } },
          { email: { contains: query } }
        ],
        id: { not: req.user!.userId } // Don't search self
      },
      select: { id: true, name: true, profile_pic_url: true, is_online: true, hostel_name: true },
      take: 20
    });
    res.json({ success: true, users });
  } catch (error) {
    next(error);
  }
};

const router = Router();
router.use(requireAuth);
router.get('/profile', getProfile);
router.put('/update', updateProfile);
router.get('/search', searchUsers);

export default router;
