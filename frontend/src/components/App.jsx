import React, { useEffect, useMemo, useState } from 'react';
import { io } from 'socket.io-client';
import Login from './Login';

/**
 * IMPORTANT FOR EC2 + DOCKER + NGINX
 * - Frontend talks ONLY to Nginx
 * - Nginx proxies:
 *    /api        -> backend:4000
 *    /socket.io -> backend:4000
 */
const socket = io('/', { path: '/socket.io' });

function PostCard({ post, onOpen, onUpvote, onAnswer, user }) {
  const [isVoting, setIsVoting] = useState(false);

  const handleUpvote = async () => {
    setIsVoting(true);
    try {
      await onUpvote(post);
    } finally {
      setIsVoting(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow border border-gray-200 p-5">
      <div className="flex justify-between gap-4">
        <div className="flex-1 cursor-pointer" onClick={() => onOpen(post)}>
          <div className="flex gap-2 text-xs text-gray-500">
            <span className={post.answered ? 'text-green-600' : 'text-yellow-600'}>
              {post.answered ? 'Answered' : 'Open'}
            </span>
            <span>By {post.author || 'Anonymous'}</span>
            <span>{new Date(post.createdAt).toLocaleString()}</span>
          </div>

          <h3 className="text-lg font-bold mt-2">{post.title}</h3>
          <p className="text-gray-600 mt-1 line-clamp-2">{post.content}</p>
        </div>

        <div className="flex flex-col items-center gap-2">
          <button
            onClick={handleUpvote}
            disabled={isVoting}
            className="w-10 h-10 bg-gray-200 rounded"
          >
            ▲
          </button>
          <span className="font-bold">{post.votes}</span>

          {user.role === 'instructor' && !post.answered && (
            <button
              onClick={() => onAnswer(post)}
              className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded"
            >
              Mark Answered
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [posts, setPosts] = useState([]);
  const [sort, setSort] = useState('date');
  const [q, setQ] = useState('');
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ title: '', content: '' });

  const [user, setUser] = useState({
    name: localStorage.getItem('user:name') || '',
    role: localStorage.getItem('user:role') || 'student',
  });

  useEffect(() => {
    localStorage.setItem('user:name', user.name);
    localStorage.setItem('user:role', user.role);
  }, [user]);

  /* ---------------- FETCH POSTS ---------------- */
  const fetchPosts = async () => {
    const res = await fetch(
      `/api/posts?sort=${sort}${q ? `&q=${encodeURIComponent(q)}` : ''}`
    );
    const data = await res.json();
    setPosts(data);
  };

  useEffect(() => {
    fetchPosts();
  }, [sort, q]);

  /* ---------------- SOCKET.IO ---------------- */
  useEffect(() => {
    socket.on('post:created', p => setPosts(prev => [p, ...prev]));
    socket.on('post:upvoted', p =>
      setPosts(prev => prev.map(x => (x._id === p._id ? p : x)))
    );
    socket.on('post:answered', p =>
      setPosts(prev => prev.map(x => (x._id === p._id ? p : x)))
    );
    socket.on('reply:created', ({ postId, reply }) => {
      setPosts(prev =>
        prev.map(x =>
          x._id === postId ? { ...x, replies: [...x.replies, reply] } : x
        )
      );
    });

    return () => socket.off();
  }, []);

  /* ---------------- ACTIONS ---------------- */
  const createPost = async e => {
    e.preventDefault();
    await fetch('/api/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, author: user.name || 'Anonymous' }),
    });
    setForm({ title: '', content: '' });
  };

  const upvote = async post => {
    await fetch(`/api/posts/${post._id}/upvote`, { method: 'POST' });
  };

  const markAnswered = async post => {
    await fetch(`/api/posts/${post._id}/answer`, {
      method: 'POST',
      headers: { 'x-role': user.role },
    });
  };

  const addReply = async (postId, content) => {
    await fetch(`/api/posts/${postId}/reply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, author: user.name }),
    });
  };

  const sorted = useMemo(() => posts, [posts]);

  if (!user.name) {
    return <Login onLogin={setUser} />;
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Learnato Forum</h1>

      <form onSubmit={createPost} className="mb-6 bg-white p-4 rounded shadow">
        <input
          value={form.title}
          onChange={e => setForm({ ...form, title: e.target.value })}
          placeholder="Title"
          className="w-full mb-2 p-2 border rounded"
          required
        />
        <textarea
          value={form.content}
          onChange={e => setForm({ ...form, content: e.target.value })}
          placeholder="Content"
          className="w-full mb-2 p-2 border rounded"
          required
        />
        <button className="bg-blue-600 text-white px-4 py-2 rounded">
          Post
        </button>
      </form>

      <div className="space-y-4">
        {sorted.map(p => (
          <PostCard
            key={p._id}
            post={p}
            onOpen={setModal}
            onUpvote={upvote}
            onAnswer={markAnswered}
            user={user}
          />
        ))}
      </div>

      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center">
          <div className="bg-white p-6 rounded max-w-xl w-full">
            <h2 className="text-xl font-bold mb-2">{modal.title}</h2>
            <p className="mb-4">{modal.content}</p>

            <div className="space-y-2">
              {modal.replies?.map((r, i) => (
                <div key={i} className="bg-gray-100 p-2 rounded">
                  <b>{r.author}</b>: {r.content}
                </div>
              ))}
            </div>

            <ReplyForm postId={modal._id} onAdd={addReply} />
            <button
              onClick={() => setModal(null)}
              className="mt-4 text-red-600"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ReplyForm({ postId, onAdd }) {
  const [text, setText] = useState('');

  const submit = async e => {
    e.preventDefault();
    await onAdd(postId, text);
    setText('');
  };

  return (
    <form onSubmit={submit} className="mt-4">
      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        className="w-full p-2 border rounded"
        placeholder="Reply..."
        required
      />
      <button className="mt-2 bg-green-600 text-white px-3 py-1 rounded">
        Reply
      </button>
    </form>
  );
}
