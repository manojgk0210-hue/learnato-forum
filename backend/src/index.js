import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { createServer } from 'http';
import { Server } from 'socket.io';

dotenv.config();

/* =====================
   ENV CONFIG
===================== */
const PORT = process.env.PORT || 4000;
const ORIGIN = process.env.ORIGIN || '*';
const MONGO_URL =
  process.env.MONGO_URL || 'mongodb://mongo:27017/learnato_forum';

/* =====================
   APP SETUP
===================== */
const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: ORIGIN,
    methods: ['GET', 'POST'],
  },
});

/* =====================
   MIDDLEWARES
===================== */
app.use((req, res, next) => {
  req.io = io;
  next();
});

app.use(cors({ origin: ORIGIN }));
app.use(morgan('dev'));
app.use(express.json());

/* =====================
   HEALTH CHECK
===================== */
app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

/* =====================
   ERROR HANDLER
===================== */
app.use((err, req, res, next) => {
  console.error(err);
  res.status(400).json({
    error: err.message || 'Bad Request',
  });
});

/* =====================
   DATABASE + SERVER
===================== */
mongoose
  .connect(MONGO_URL)
  .then(async () => {
    console.log('✅ MongoDB connected');

    const { default: postsRouter } = await import('./routes/posts.js');
    app.use('/api/posts', postsRouter);

    httpServer.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 API listening on port ${PORT}`);
    });
  })
  .catch(async (err) => {
    console.error('❌ Mongo connection error:', err);
    console.log('⚠️ Starting server with in-memory mock DB');

    process.env.USE_MOCK_DB = 'true';

    const { default: postsRouter } = await import('./routes/posts.js');
    app.use('/api/posts', postsRouter);

    httpServer.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 API listening on port ${PORT} (mock DB)`);
    });
  });
