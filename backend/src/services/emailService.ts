import { Resend } from 'resend';
import { env } from '../config/env';

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

export const sendVerificationEmail = async (email: string, token: string) => {
  const verificationLink = `${env.FRONTEND_URL}/verify-email?token=${token}`;

  if (env.DEV_BYPASS_EMAIL_VERIFICATION) {
    console.log(`[DEV BYPASS] Email verification link for ${email}: ${verificationLink}`);
    return;
  }

  if (!resend) {
    throw new Error('Resend API key is not configured');
  }

  await resend.emails.send({
    from: 'ChatApp <noreply@yourdomain.com>', // MUST BE verified in Resend
    to: email,
    subject: 'Verify your email address',
    html: `<p>Please click the link below to verify your email address:</p><p><a href="${verificationLink}">Verify Email</a></p>`,
  });
};

export const sendWelcomeEmail = async (email: string, name: string) => {
  if (env.DEV_BYPASS_EMAIL_VERIFICATION) {
    console.log(`[DEV BYPASS] Welcome email would be sent to ${email}`);
    return;
  }

  if (!resend) return;

  await resend.emails.send({
    from: 'ChatApp <noreply@yourdomain.com>',
    to: email,
    subject: 'Welcome to Secure Chat App!',
    html: `<p>Hi ${name}, welcome to our secure private chat application!</p>`,
  });
};
