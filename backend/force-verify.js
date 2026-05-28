const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function forceVerify() {
  try {
    const email = 'honest25101999@gmail.com';
    const user = await prisma.user.update({
      where: { email },
      data: { is_verified: true }
    });
    console.log('User status after update:');
    console.log('Email:', user.email);
    console.log('Verified:', user.is_verified);
    console.log('Hostel Name:', user.hostel_name);
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}
forceVerify();
