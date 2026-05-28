const axios = require('axios');
const { Client } = require('pg');

async function test() {
  const email = `test_${Date.now()}@test.com`;
  const password = 'password123';
  
  try {
    // Register
    console.log('Registering...', email);
    await axios.post('https://securechatapp-backend.onrender.com/auth/register', {
      name: 'Test Bot',
      email,
      password,
      gender: 'MALE',
      hostel_name: 'H3',
      room_number: '123'
    });

    // Set verified manually via pg
    console.log('Connecting to DB to verify...');
    const client = new Client({
      connectionString: process.env.DATABASE_URL || 'postgresql://securechatuser:R98EOOO4eatrtx0WQi4wurgF0m3Wfe6G@dpg-d8c2fe0jo6nc73efm6og-a.oregon-postgres.render.com/securechat_gwq9',
      ssl: { rejectUnauthorized: false }
    });
    await client.connect();
    await client.query('UPDATE "User" SET is_verified = true WHERE email = $1', [email]);
    await client.end();
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

  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}
test();
