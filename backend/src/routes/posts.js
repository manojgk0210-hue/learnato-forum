import { Router } from 'express';
import { z } from 'zod';
import Post from '../models/Post.js';

const router = Router();

const postSchema = z.object({
  title: z.string().min(3),
  content: z.string().min(3),
  author: z.string().optional()
});

const replySchema = z.object({
  content: z.string().min(1),
  author: z.string().optional()
});

router.post('/', async (req, res, next) => {
  try {
    const data = postSchema.parse(req.body);
    const post = await Post.create(data);
    req.io.emit('post:created', post);
    res.status(201).json(post);
  } catch (err) { next(err); }
});

router.get('/', async (req, res, next) => {
  try {
    const { sort = 'date', q } = req.query;
    const filter = q ? { $or: [
      { title: { $regex: q, $options: 'i' }},
      { content: { $regex: q, $options: 'i' }}
    ]} : {};
    const cursor = Post.find(filter);
    if (sort === 'votes') cursor.sort({ votes: -1, createdAt: -1 });
    else cursor.sort({ createdAt: -1 });
    const posts = await cursor.exec();
    res.json(posts);
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: 'Not found' });
    res.json(post);
  } catch (err) { next(err); }
});

router.post('/:id/reply', async (req, res, next) => {
  try {
    const data = replySchema.parse(req.body);
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: 'Not found' });
    post.replies.push(data);
    await post.save();
    const reply = post.replies[post.replies.length - 1];
    req.io.emit('reply:created', { postId: post._id, reply });
    res.status(201).json(post);
  } catch (err) { next(err); }
});

router.post('/:id/upvote', async (req, res, next) => {
  try {
    const post = await Post.findByIdAndUpdate(
      req.params.id,
      { $inc: { votes: 1 } },
      { new: true }
    );
    if (!post) return res.status(404).json({ message: 'Not found' });
    req.io.emit('post:upvoted', post);
    res.json(post);
  } catch (err) { next(err); }
});

router.post('/:id/answer', async (req, res, next) => {
  try {
    const post = await Post.findByIdAndUpdate(
      req.params.id,
      { $set: { answered: true } },
      { new: true }
    );
    if (!post) return res.status(404).json({ message: 'Not found' });
    req.io.emit('post:answered', post);
    res.json(post);
  } catch (err) { next(err); }
});

export default router;
