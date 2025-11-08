import mongoose from 'mongoose';

const ReplySchema = new mongoose.Schema({
  content: { type: String, required: true },
  author: { type: String, default: 'Anonymous' },
  createdAt: { type: Date, default: Date.now }
});

const PostSchema = new mongoose.Schema({
  title: { type: String, required: true },
  content: { type: String, required: true },
  author: { type: String, default: 'Anonymous' },
  votes: { type: Number, default: 0 },
  answered: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  replies: [ReplySchema]
});

export default mongoose.model('Post', PostSchema);
