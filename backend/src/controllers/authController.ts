import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { prisma } from '../config/db';
import { registerSchema, loginSchema } from '../utils/validators';
import { generateTokens, verifyRefreshToken } from '../utils/jwt';
import { sendVerificationEmail, sendWelcomeEmail } from '../services/emailService';
import { env } from '../config/env';

const setCookies = (res: Response, accessToken: string, refreshToken: string) => {
  res.cookie('access_token', accessToken, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: env.NODE_ENV === 'production' ? 'none' : 'strict',
    maxAge: 15 * 60 * 1000, // 15 mins
  });

  res.cookie('refresh_token', refreshToken, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: env.NODE_ENV === 'production' ? 'none' : 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
};

export const register = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = registerSchema.parse(req.body);

    const existingUser = await prisma.user.findUnique({ where: { email: data.email } });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Email already in use' });
    }

    const { password, ...userData } = data;
    const password_hash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        ...userData,
        password_hash,
        is_verified: false,
      },
    });

    const token = crypto.randomBytes(32).toString('hex');
    await prisma.verificationToken.create({
      data: {
        user_id: user.id,
        token,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
      }
    });

    await sendVerificationEmail(user.email, token, password);

    // Notify other hostel members about new joining
    try {
      const hostelMates = await prisma.user.findMany({
        where: { hostel_name: user.hostel_name, id: { not: user.id } },
        select: { id: true }
      });

      if (hostelMates.length > 0) {
        // Bulk insert notifications
        await prisma.notification.createMany({
          data: hostelMates.map(mate => ({
            user_id: mate.id,
            title: 'New Member Joined!',
            body: `${user.name} just joined ${user.hostel_name}. Say hi!`
          }))
        });

        // Broadcast realtime event
        const { getIo } = require('../sockets/socket');
        const io = getIo();
        if (io) {
          io.to(`feed:${user.hostel_name}`).emit('new_user_joined', {
            userId: user.id,
            userName: user.name,
            hostelName: user.hostel_name,
            timestamp: new Date()
          });
        }
      }
    } catch (notifErr) {
      console.error('Failed to send joining notifications:', notifErr);
    }

    return res.status(201).json({ success: true, message: 'Registration successful! Please check your email to verify your account.' });

  } catch (error) {
    next(error);
  }
};

export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { email: data.email } });
    if (!user || !(await bcrypt.compare(data.password, user.password_hash))) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    if (!user.is_verified) {
      return res.status(403).json({ success: false, message: 'Please verify your email first' });
    }

    const { accessToken, refreshToken } = generateTokens(user.id);

    // Save session for Device/Session Tracking
    await prisma.session.create({
      data: {
        user_id: user.id,
        refresh_token: refreshToken,
        device_info: data.device_info || req.headers['user-agent'],
        ip_address: req.ip,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      }
    });

    setCookies(res, accessToken, refreshToken);

    return res.json({
      success: true,
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        profile_pic_url: user.profile_pic_url,
        hostel_name: user.hostel_name,
        room_number: user.room_number
      }
    });
  } catch (error) {
    next(error);
  }
};

export const logout = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const refreshToken = req.cookies.refresh_token;
    if (refreshToken) {
      await prisma.session.deleteMany({ where: { refresh_token: refreshToken } });
    }

    res.clearCookie('access_token');
    res.clearCookie('refresh_token');

    return res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    next(error);
  }
};

export const logoutAll = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    if (userId) {
      await prisma.session.deleteMany({ where: { user_id: userId } });
    }

    res.clearCookie('access_token');
    res.clearCookie('refresh_token');

    return res.json({ success: true, message: 'Logged out from all devices' });
  } catch (error) {
    next(error);
  }
};

export const refreshToken = async (req: Request, res: Response) => {
  try {
    const token =
      req.cookies?.refresh_token || req.body?.refreshToken;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "No refresh token",
      });
    }

    const payload = verifyRefreshToken(token) as {
      userId: string;
    };

    const session = await prisma.session.findUnique({
      where: { refresh_token: token }
    });

    if (!session) {
      return res.status(401).json({ success: false, message: "Session expired or invalid" });
    }

    const {
      accessToken,
      refreshToken: newRefreshToken,
    } = generateTokens(payload.userId);

    await prisma.session.update({
      where: { id: session.id },
      data: { refresh_token: newRefreshToken, expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) }
    });

    setCookies(res, accessToken, newRefreshToken);

    return res.status(200).json({
      success: true,
      accessToken,
      refreshToken: newRefreshToken,
    });
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Invalid refresh token",
    });
  }
};

export const verifyEmail = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ success: false, message: 'Verification token is required' });
    }

    const verificationRecord = await prisma.verificationToken.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!verificationRecord) {
      return res.status(400).json({ success: false, message: 'Invalid or expired verification token' });
    }

    if (verificationRecord.expires_at < new Date()) {
      await prisma.verificationToken.delete({ where: { id: verificationRecord.id } });
      return res.status(400).json({ success: false, message: 'Verification token has expired. Please register again.' });
    }

    // Verify user and send welcome email
    await prisma.user.update({
      where: { id: verificationRecord.user_id },
      data: { is_verified: true },
    });

    await prisma.verificationToken.delete({ where: { id: verificationRecord.id } });
    await sendWelcomeEmail(verificationRecord.user.email, verificationRecord.user.name);

    return res.json({ success: true, message: 'Email verified successfully! You can now sign in.' });
  } catch (error) {
    next(error);
  }
};

export const forgotPassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'Email is required' });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      // Return success even if user not found to prevent email enumeration
      return res.json({ success: true, message: 'If an account exists, a password reset link has been sent.' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    
    // Delete existing reset tokens
    await prisma.passwordReset.deleteMany({ where: { user_id: user.id } });

    await prisma.passwordReset.create({
      data: {
        user_id: user.id,
        token,
        expires_at: new Date(Date.now() + 60 * 60 * 1000) // 1 hour
      }
    });

    // In a real app, send this via email. For now, log it.
    console.log(`\n\n[PASSWORD RESET] Link: ${env.FRONTEND_URL}/reset-password?token=${token}\n\n`);

    return res.json({ success: true, message: 'If an account exists, a password reset link has been sent. Check console for token.' });
  } catch (error) {
    next(error);
  }
};

export const resetPassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      return res.status(400).json({ success: false, message: 'Token and new password are required' });
    }

    const resetRecord = await prisma.passwordReset.findUnique({
      where: { token },
      include: { user: true }
    });

    if (!resetRecord || resetRecord.expires_at < new Date()) {
      return res.status(400).json({ success: false, message: 'Invalid or expired password reset token' });
    }

    const password_hash = await bcrypt.hash(newPassword, 12);

    await prisma.user.update({
      where: { id: resetRecord.user_id },
      data: { password_hash }
    });

    await prisma.passwordReset.delete({ where: { id: resetRecord.id } });
    
    // Invalidate all existing sessions
    await prisma.session.deleteMany({ where: { user_id: resetRecord.user_id } });

    return res.json({ success: true, message: 'Password has been reset successfully. Please log in.' });
  } catch (error) {
    next(error);
  }
};
