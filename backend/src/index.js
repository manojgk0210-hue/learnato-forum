import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { createServer } from 'http';
import { Server } from 'socket.io';
import postsRouter from './routes/posts.js';

dotenv.config();

const PORT = process.env.PORT || 4000;
const ORIGIN = process.env.ORIGIN || 'http://localhost:5173';
const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017/learnato_forum';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: ORIGIN, methods: ['GET','POST'] }
});

app.use((req,res,next)=>{ req.io = io; next(); });
app.use(cors({ origin: ORIGIN }));
app.use(morgan('dev'));
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use('/api/posts', postsRouter);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(400).json({ error: err.message || 'Bad Request' });
});

mongoose.connect(MONGO_URL).then(()=>{
  console.log('MongoDB connected');
  httpServer.listen(PORT, () => {
    console.log(`API listening on port ${PORT}`);
  });
}).catch(err=>{
  console.error('Mongo connection error', err);
  process.exit(1);
});
