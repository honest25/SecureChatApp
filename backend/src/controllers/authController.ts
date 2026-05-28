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
        is_verified: env.DEV_BYPASS_EMAIL_VERIFICATION, // Auto-verify in dev bypass mode
      },
    });

    if (!env.DEV_BYPASS_EMAIL_VERIFICATION) {
      const token = crypto.randomBytes(32).toString('hex');
      await prisma.verificationToken.create({
        data: {
          user_id: user.id,
          token,
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        }
      });
      await sendVerificationEmail(user.email, token);
      return res.status(201).json({ success: true, message: 'Registration successful. Please verify your email.' });
    }

    // If dev bypass is true, we send welcome email immediately and they can log in
    await sendWelcomeEmail(user.email, user.name);
    return res.status(201).json({ success: true, message: 'Registration successful (auto-verified).' });

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
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        profile_pic_url: user.profile_pic_url
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
