const axios = require('axios');

async function test() {
  try {
    const res = await axios.post('https://securechatapp-backend.onrender.com/auth/login', {
      email: 'honest25101999@gmail.com',
      password: 'password123' // I don't know the user's password, so I will likely get 401
    });
    console.log('SUCCESS:', res.data);
  } catch (err) {
    console.error('ERROR STATUS:', err.response?.status);
    console.error('ERROR DATA:', err.response?.data);
    console.error('ERROR MSG:', err.message);
  }
}
test();
