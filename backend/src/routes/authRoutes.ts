import { Router } from 'express';
import { register, login, logout, logoutAll, refreshToken, verifyEmail, forgotPassword, resetPassword } from '../controllers/authController';
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
router.post('/verify-email', authLimiter, verifyEmail);
router.post('/login', authLimiter, login);
router.post('/refresh-token', refreshToken);
router.post('/logout', logout);
router.post('/logout-all', requireAuth, logoutAll);

router.post('/forgot-password', authLimiter, forgotPassword);
router.post('/reset-password', authLimiter, resetPassword);

export default router;
