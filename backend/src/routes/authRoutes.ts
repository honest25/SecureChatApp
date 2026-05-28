import { Router } from 'express';
import { register, login, logout, logoutAll, refreshToken } from '../controllers/authController';
import { requireAuth } from '../middlewares/authMiddleware';
import rateLimit from 'express-rate-limit';

const router = Router();

// Rate limiting for auth routes to prevent brute-force attacks
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 requests per `window`
  message: 'Too many attempts, please try again after 15 minutes',
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.post('/refresh-token', refreshToken);
router.post('/logout', logout);
router.post('/logout-all', requireAuth, logoutAll);

// TODO: /forgot-password, /reset-password

export default router;
