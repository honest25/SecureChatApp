const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
  try {
    const email = 'bot_test_1234@gmail.com';
    const password = 'password123';
    
    // Register
    console.log('Registering...');
    try {
      await axios.post('https://securechatapp-backend.onrender.com/auth/register', {
        name: 'Test Bot',
        email,
        password,
        hostel_name: 'H3',
        room_number: '123'
      });
    } catch (e) {
      console.log('Registration failed, might exist already.');
    }

    // Set verified manually
    await prisma.user.updateMany({
      where: { email },
      data: { is_verified: true }
    });
    console.log('Verified manually in DB');

    // Login
    console.log('Logging in...');
    const res = await axios.post('https://securechatapp-backend.onrender.com/auth/login', {
      email,
      password
    }, {
      headers: {
        'Origin': 'https://secure-chat-app-sepia.vercel.app'
      }
    });

    console.log('Login Status:', res.status);
    console.log('Cookies Set by Server:', res.headers['set-cookie']);
    
    // Test auth check
    const cookies = res.headers['set-cookie'];
    if (cookies) {
      const authRes = await axios.get('https://securechatapp-backend.onrender.com/user/profile', {
        headers: {
          'Origin': 'https://secure-chat-app-sepia.vercel.app',
          'Cookie': cookies.map(c => c.split(';')[0]).join('; ')
        }
      });
      console.log('Profile Status:', authRes.status);
      console.log('Profile Data:', authRes.data);
    } else {
      console.log('NO COOKIES SET!');
    }

  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}
test();
