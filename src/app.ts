import express from 'express';
import http from 'http';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import authRoutes from './routes/auth.routes';
import roomRoutes from './routes/rooms.routes';
import gameRoutes from './routes/games.routes';
import roundRoutes from './routes/rounds.routes';
import animeRoutes from './routes/animes.routes';
import { authMiddleware } from './middleware/auth.middleware';
import { errorMiddleware } from './middleware/error.middleware';

const app = express();

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true,
  }),
);
app.use(express.json());
app.use(cookieParser());

// Public routes
app.use('/api/auth', authRoutes);

// Protected routes — authMiddleware applied at mount point so Socket.io (INF-03)
// can attach to httpServer without touching these guards
app.use('/api/rooms', authMiddleware, roomRoutes);
app.use('/api/games', authMiddleware, gameRoutes);
app.use('/api/rounds', authMiddleware, roundRoutes);
app.use('/api/animes', authMiddleware, animeRoutes);

// Centralized error handler (must be last middleware)
app.use(errorMiddleware);

// Export the raw http.Server so INF-03 can do: new Server(httpServer)
export const httpServer = http.createServer(app);
export default app;
