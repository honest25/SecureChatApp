import { Router } from 'express';
import { getNotifications, markAsRead, markAllAsRead } from '../controllers/notificationController';
import { requireAuth } from '../middlewares/authMiddleware';

const router = Router();

router.use(requireAuth);

router.get('/', getNotifications);
router.post('/mark-all-read', markAllAsRead);
router.patch('/:notificationId/read', markAsRead);

export default router;
