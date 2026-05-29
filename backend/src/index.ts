import express, { Express } from 'express';
import { createServer } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import path from 'path';
import { env } from './config/env';
import { setupSocket } from './sockets/socket';
import { errorHandler } from './middlewares/errorHandler';
import { startCronJobs } from './services/cronService';
import { startPresenceCleanupWorker } from './workers/presenceWorker';
// Routes
import authRoutes from './routes/authRoutes';
import userRoutes from './routes/userRoutes';
import chatRoutes from './routes/chatRoutes';
import locationRoutes from './routes/locationRoutes';
import notificationRoutes from './routes/notificationRoutes';

const app: Express = express();
const httpServer = createServer(app);

// Initialize WebSockets
setupSocket(httpServer);

// Start Background Workers
startPresenceCleanupWorker();

// Security Middlewares
app.set('trust proxy', 1);
app.use(helmet());
app.use(cors({
  origin: function (origin, callback) {
    const allowedOrigins = [env.FRONTEND_URL, 'http://localhost:3000', 'http://192.168.1.35:3000', 'http://127.0.0.1:3000'];
    if (!origin || allowedOrigins.includes(origin) || origin.endsWith('vercel.app')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true, // Allow cookies
}));
app.use(express.json());
app.use(cookieParser());

// Request Logging Middleware
app.use((req, res, next) => {
  console.log(`[API Request] ${req.method} ${req.url} from ${req.headers.origin || 'unknown origin'}`);
  next();
});

// Routes
app.use('/uploads', express.static(path.join(__dirname, '../public/uploads')));
app.use('/auth', authRoutes);
app.use('/user', userRoutes);
app.use('/chat', chatRoutes);
app.use('/location', locationRoutes);
app.use('/notifications', notificationRoutes);

// Health check route
app.get('/', (req, res) => {
  res.send('SecureChatApp Backend is running!');
});

// Global Error Handler
app.use(errorHandler);

const PORT = env.PORT ? parseInt(env.PORT.toString(), 10) : 5000;

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`[Server] Server is running on port ${PORT}`);
  
  // Start Cron Jobs for auto-deletion
  startCronJobs();
});
