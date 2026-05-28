import express, { Express } from 'express';
import { createServer } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { env } from './config/env';
import { setupSocket } from './sockets/socket';
import { errorHandler } from './middlewares/errorHandler';
import { startCronJobs } from './services/cronService';

// Routes
import authRoutes from './routes/authRoutes';
import userRoutes from './routes/userRoutes';
import chatRoutes from './routes/chatRoutes';
import locationRoutes from './routes/locationRoutes';

const app: Express = express();
const httpServer = createServer(app);

// Initialize WebSockets
setupSocket(httpServer);

// Security Middlewares
app.set('trust proxy', 1);
app.use(helmet());
app.use(cors({
  origin: env.FRONTEND_URL,
  credentials: true, // Allow cookies
}));
app.use(express.json());
app.use(cookieParser());

// Routes
app.use('/uploads', express.static('public/uploads'));
app.use('/auth', authRoutes);
app.use('/user', userRoutes);
app.use('/chat', chatRoutes);
app.use('/location', locationRoutes);

// Health check route
app.get('/', (req, res) => {
  res.send('SecureChatApp Backend is running!');
});

// Global Error Handler
app.use(errorHandler);

const PORT = env.PORT || 5000;

httpServer.listen(PORT, () => {
  console.log(`[Server] Server is running on port ${PORT}`);
  
  // Start Cron Jobs for auto-deletion
  startCronJobs();
});
