import { Resend } from 'resend';
import { env } from '../config/env';

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

export const sendVerificationEmail = async (email: string, token: string, password?: string) => {
  const verificationLink = `${env.FRONTEND_URL}/verify-email?token=${token}`;

  const htmlContent = `
    <p>Welcome to SecureChat!</p>
    <p>Your verification code is: <strong style="font-size: 24px;">${token}</strong></p>
    <p>You can also click the link below to verify your email address:</p>
    <p><a href="${verificationLink}">Verify Email</a></p>
    ${password ? `<p>For your records, your registered password is: <strong>${password}</strong></p>` : ''}
  `;

  if (env.DEV_BYPASS_EMAIL_VERIFICATION) {
    console.log(`\n\n[DEV BYPASS] Email verification link for ${email}: ${verificationLink}`);
    if (password) console.log(`[DEV BYPASS] User Password: ${password}\n\n`);
    return;
  }

  if (!resend) {
    throw new Error('Resend API key is not configured');
  }

  await resend.emails.send({
    from: 'ChatApp <onboarding@resend.dev>',
    to: email,
    subject: 'Verify your email address - SecureChat',
    html: htmlContent,
  });
};

export const sendWelcomeEmail = async (email: string, name: string) => {
  if (env.DEV_BYPASS_EMAIL_VERIFICATION) {
    console.log(`[DEV BYPASS] Welcome email would be sent to ${email}`);
    return;
  }

  if (!resend) return;

  await resend.emails.send({
    from: 'ChatApp <onboarding@resend.dev>',
    to: email,
    subject: 'Welcome to Secure Chat App!',
    html: `<p>Hi ${name}, welcome to our secure private chat application!</p>`,
  });
};
