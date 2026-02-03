import { Router } from 'express';
import { z } from 'zod';
import Post from '../models/Post.js';

const router = Router();

/* =====================
   VALIDATION SCHEMAS
===================== */
const postSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters'),
  content: z.string().min(3, 'Content must be at least 3 characters'),
  author: z.string().optional().default('Anonymous'),
});

const replySchema = z.object({
  content: z.string().min(1, 'Reply cannot be empty'),
  author: z.string().optional().default('Anonymous'),
});

/* =====================
   CREATE POST
===================== */
router.post('/', async (req, res, next) => {
  try {
    const data = postSchema.parse(req.body);
    const post = await Post.create(data);

    req.io.emit('post:created', post);
    res.status(201).json(post);
  } catch (err) {
    next(err);
  }
});

/* =====================
   GET ALL POSTS
===================== */
router.get('/', async (req, res, next) => {
  try {
    const { sort = 'date', q } = req.query;

    const filter = q
      ? {
          $or: [
            { title: { $regex: q, $options: 'i' } },
            { content: { $regex: q, $options: 'i' } },
          ],
        }
      : {};

    const cursor = Post.find(filter);

    if (sort === 'votes') {
      cursor.sort({ votes: -1, createdAt: -1 });
    } else {
      cursor.sort({ createdAt: -1 });
    }

    const posts = await cursor.exec();
    res.json(posts);
  } catch (err) {
    next(err);
  }
});

/* =====================
   SIMILAR POSTS (SEARCH)
===================== */
router.get('/similar', async (req, res, next) => {
  try {
    const { q, limit = 5 } = req.query;
    if (!q) return res.json([]);

    const filter = {
      $or: [
        { title: { $regex: q, $options: 'i' } },
        { content: { $regex: q, $options: 'i' } },
      ],
    };

    const posts = await Post.find(filter)
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .exec();

    res.json(posts);
  } catch (err) {
    next(err);
  }
});

/* =====================
   GET POST BY ID
===================== */
router.get('/:id', async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ message: 'Not found' });
    }
    res.json(post);
  } catch (err) {
    next(err);
  }
});

/* =====================
   POST SUMMARY
===================== */
router.get('/:id/summary', async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ message: 'Not found' });
    }

    const summary =
      post.content.substring(0, 150) +
      (post.content.length > 150 ? '...' : '') +
      ` [${post.replies?.length || 0} reply(ies)]`;

    res.json({ summary });
  } catch (err) {
    next(err);
  }
});

/* =====================
   ADD REPLY
===================== */
router.post('/:id/reply', async (req, res, next) => {
  try {
    const data = replySchema.parse(req.body);
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    const reply = {
      content: data.content,
      author: data.author,
      createdAt: new Date(),
    };

    post.replies.push(reply);

    // Mongo DB
    if (typeof post.save === 'function') {
      await post.save();
      const createdReply = post.replies.at(-1);

      req.io.emit('reply:created', {
        postId: post._id,
        reply: createdReply,
      });

      return res.status(201).json(post);
    }

    // Mock DB fallback
    const updated = await Post.findByIdAndUpdate(
      req.params.id,
      { $set: { replies: post.replies } },
      { new: true }
    );

    req.io.emit('reply:created', {
      postId: updated._id,
      reply: updated.replies.at(-1),
    });

    res.status(201).json(updated);
  } catch (err) {
    next(err);
  }
});

/* =====================
   UPVOTE
===================== */
router.post('/:id/upvote', async (req, res, next) => {
  try {
    const post = await Post.findByIdAndUpdate(
      req.params.id,
      { $inc: { votes: 1 } },
      { new: true }
    );

    if (!post) {
      return res.status(404).json({ message: 'Not found' });
    }

    req.io.emit('post:upvoted', post);
    res.json(post);
  } catch (err) {
    next(err);
  }
});

/* =====================
   MARK AS ANSWERED
===================== */
router.post('/:id/answer', async (req, res, next) => {
  try {
    const post = await Post.findByIdAndUpdate(
      req.params.id,
      { $set: { answered: true } },
      { new: true }
    );

    if (!post) {
      return res.status(404).json({ message: 'Not found' });
    }

    req.io.emit('post:answered', post);
    res.json(post);
  } catch (err) {
    next(err);
  }
});

export default router;
