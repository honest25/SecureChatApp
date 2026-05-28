const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function resetPassword() {
  try {
    const email = 'honest25101999@gmail.com';
    const newPassword = 'password123';
    const password_hash = await bcrypt.hash(newPassword, 12);

    const user = await prisma.user.update({
      where: { email },
      data: {
        password_hash,
        is_verified: true,
      }
    });

    console.log('Successfully reset password for', user.email);
    console.log('New password is:', newPassword);
  } catch (error) {
    console.error('Failed to reset:', error);
  } finally {
    await prisma.$disconnect();
  }
}

resetPassword();
