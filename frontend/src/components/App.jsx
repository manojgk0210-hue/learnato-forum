import React, { useEffect, useMemo, useState } from 'react';
import { io } from 'socket.io-client';
import Login from './Login';

// Cloud-ready: connect to backend container or environment variable
const API_URL = import.meta.env.VITE_API_URL || 'http://api:4000';
const socket = io(API_URL, { path: '/socket.io' });

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
    <div className="bg-white rounded-2xl shadow hover:shadow-lg transition border border-gray-200 p-5 cursor-pointer hover:border-blue-300">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1" onClick={() => onOpen(post)}>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs px-2 py-1 rounded-full font-semibold ${
              post.answered ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
            }`}>
              {post.answered ? 'Answered' : 'Open'}
            </span>
            <span className="text-xs text-gray-600">By {post.author || 'Anonymous'}</span>
            <span className="text-xs text-gray-400">{new Date(post.createdAt).toLocaleString()}</span>
          </div>
          <h3 className="text-lg font-bold text-gray-900 mt-2">{post.title}</h3>
          <p className="text-gray-600 mt-2 line-clamp-2">{post.content}</p>
        </div>
        
        <div className="flex flex-col items-center gap-2">
          <button
            onClick={handleUpvote}
            disabled={isVoting}
            className="flex items-center justify-center w-10 h-10 rounded-lg bg-gray-200 hover:bg-gray-300 transition disabled:opacity-50"
            title="Upvote this post"
          >
            <span className="text-lg font-bold" style={{ color: '#000000' }}>▲</span>
          </button>
          <span className="text-sm font-bold text-gray-700">{post.votes}</span>
          
          {user.role === 'instructor' && !post.answered && (
            <button
              onClick={() => onAnswer(post)}
              className="mt-2 text-xs px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-300 hover:bg-emerald-100 transition font-semibold"
            >
              Mark Answered
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-4 mt-4 text-sm text-gray-500 border-t border-gray-100 pt-3">
        <button onClick={() => onOpen(post)} className="text-blue-600 hover:underline font-semibold">
          View Discussion ({post.replies?.length || 0} replies)
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const [posts, setPosts] = useState([]);
  const [sort, setSort] = useState('date');
  const [q, setQ] = useState('');
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ title: '', content: '', author: '' });

  const [user, setUser] = useState(() => ({
    name: localStorage.getItem('user:name') || '',
    role: localStorage.getItem('user:role') || 'student',
  }));

  useEffect(() => {
    localStorage.setItem('user:name', user.name || '');
    localStorage.setItem('user:role', user.role || 'student');
  }, [user]);

  const [suggestions, setSuggestions] = useState([]);
  const [summary, setSummary] = useState('');
  const [isSummarizing, setIsSummarizing] = useState(false);

  // Fetch posts from backend
  const fetchPosts = async () => {
    const url = `${API_URL}/posts?sort=${sort}${q ? `&q=${encodeURIComponent(q)}` : ''}`;
    const res = await fetch(url);
    const data = await res.json();
    setPosts(data);
  };
  useEffect(() => { fetchPosts(); }, [sort, q]);

  // Socket.IO live updates
  useEffect(() => {
    socket.on('post:created', p => setPosts(prev => [p, ...prev]));
    socket.on('post:upvoted', p => setPosts(prev => prev.map(x => x._id === p._id ? p : x)));
    socket.on('post:answered', p => setPosts(prev => prev.map(x => x._id === p._id ? p : x)));
    socket.on('reply:created', ({ postId, reply }) => {
      setPosts(prev => prev.map(x => x._id === postId ? { ...x, replies: [...x.replies, reply] } : x));
      setModal(m => m && m._id === postId ? { ...m, replies: [...m.replies, reply] } : m);
    });
    return () => { socket.off(); };
  }, []);

  // Actions
  const createPost = async (e) => {
    e.preventDefault();
    const res = await fetch(`${API_URL}/posts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, author: form.author || user.name || 'Anonymous' }),
    });
    if (res.ok) setForm({ title: '', content: '', author: '' });
  };

  const upvote = async (post) => {
    await fetch(`${API_URL}/posts/${post._id}/upvote`, { method: 'POST' });
  };

  const markAnswered = async (post) => {
    await fetch(`${API_URL}/posts/${post._id}/answer`, {
      method: 'POST',
      headers: { 'x-role': user.role },
    });
  };

  const addReply = async (postId, content, author) => {
    await fetch(`${API_URL}/posts/${postId}/reply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, author }),
    });
  };

  // Similar questions (debounced)
  useEffect(() => {
    const t = setTimeout(async () => {
      const s = (form.title || '').trim();
      if (s.length < 3) { setSuggestions([]); return; }
      try {
        const r = await fetch(`${API_URL}/posts/similar?q=${encodeURIComponent(s)}&limit=5`);
        const data = await r.json();
        setSuggestions(data);
      } catch { }
    }, 300);
    return () => clearTimeout(t);
  }, [form.title]);

  // Summary
  const fetchSummary = async (id) => {
    try {
      setIsSummarizing(true);
      setSummary('Summarizing…');
      const r = await fetch(`${API_URL}/posts/${id}/summary`);
      const data = await r.json();
      setSummary(data.summary || '(no summary)');
    } finally {
      setIsSummarizing(false);
    }
  };
  useEffect(() => { setSummary(''); }, [modal?._id]);

  const sorted = useMemo(() => posts, [posts]);

  if (!user.name) {
    return <Login onLogin={(loginData) => setUser({ name: loginData.name, role: loginData.role })} />;
  }

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8">
      {/* HEADER */}
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8 bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-2xl border border-blue-100">
        <div className="flex-1">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900">Learnato Discussion Forum</h1>
          <p className="text-gray-600 mt-1">Empower learning through conversation.</p>
        </div>

        {/* Search & Filters */}
        <div className="flex gap-3 items-center flex-wrap">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search posts..."
            className="px-3 py-2 border border-gray-300 rounded-xl bg-white w-56 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-xl bg-white hover:border-gray-400"
          >
            <option value="date">Newest</option>
            <option value="votes">Top Votes</option>
          </select>

          <select
            value={user.role}
            onChange={(e) => setUser(u => ({ ...u, role: e.target.value }))}
            className="px-3 py-2 border border-gray-300 rounded-xl bg-white hover:border-gray-400"
          >
            <option value="student">Student</option>
            <option value="instructor">Instructor</option>
            <option value="admin">Admin</option>
          </select>

          {user.name && <div className="h-8 w-px bg-gray-300"></div>}

          {user.name ? (
            <>
              <div className="text-sm font-medium text-gray-700 whitespace-nowrap">{user.name}</div>
              <button
                onClick={() => setUser({ name: '', role: 'student' })}
                className="px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 font-medium whitespace-nowrap"
              >
                Logout
              </button>
            </>
          ) : null}
        </div>
      </header>

      {/* MAIN */}
      <section className="grid md:grid-cols-3 gap-6">
        {/* New Post Form */}
        <form onSubmit={createPost} className="md:col-span-1 bg-white rounded-2xl shadow-lg p-6 border border-gray-200 h-fit">
          <h2 className="font-bold text-lg mb-4 text-gray-900">New Discussion</h2>
          <div className="space-y-3">
            <input
              required
              value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
              placeholder="Question title..."
              maxLength="100"
              className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="text-xs text-gray-500 mt-1">{form.title.length}/100</div>

            {suggestions.length > 0 && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm">
                <div className="font-semibold mb-2 text-amber-900">💡 Similar questions found</div>
                <ul className="space-y-1">
                  {suggestions.map(s => (
                    <li key={s._id}>
                      <button
                        type="button"
                        className="text-blue-600 underline hover:no-underline text-left truncate w-full"
                        onClick={() => setModal(s)}
                        title={s.title}
                      >
                        {s.title}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <textarea
              required
              value={form.content}
              onChange={e => setForm({ ...form, content: e.target.value })}
              placeholder="Describe your question in detail..."
              maxLength="2000"
              className="w-full px-3 py-2 border border-gray-300 rounded-xl h-32 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
            <div className="text-xs text-gray-500 mt-1">{form.content.length}/2000</div>

            <button
              type="submit"
              className="w-full px-4 py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition"
            >
              Post Question
            </button>
          </div>
        </form>

        {/* Posts List */}
        <div className="md:col-span-2 space-y-4">
          {sorted.length === 0 ? (
            <div className="bg-white rounded-2xl shadow p-8 text-center border border-gray-200">
              <div className="text-gray-400 mb-2 text-4xl">-</div>
              <p className="text-gray-600">No posts yet. Start a discussion!</p>
            </div>
          ) : (
            sorted.map(p => (
              <PostCard key={p._id} post={p} onOpen={setModal} onUpvote={upvote} onAnswer={markAnswered} user={user} />
            ))
          )}
        </div>
      </section>

      {modal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-50" onClick={() => setModal(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="text-sm text-gray-500">
                  by {modal.author || 'Anonymous'} • {new Date(modal.createdAt).toLocaleString()}
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mt-1">{modal.title}</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setModal(null)}
                  className="px-3 py-1 border border-gray-300 rounded-xl hover:bg-gray-50"
                >
                  ✕ Close
                </button>
              </div>
            </div>

            <p className="text-gray-700 whitespace-pre-wrap mb-4 leading-relaxed">{modal.content}</p>

            {summary && (
              <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-xl text-sm">
                <div className="font-semibold mb-2 text-blue-900">Summary</div>
                <div className="text-blue-900">{summary}</div>
              </div>
            )}

            <div className="mb-4">
              <h4 className="font-bold text-lg mb-3 text-gray-900">Replies ({modal.replies?.length || 0})</h4>
              <div className="space-y-3 max-h-60 overflow-auto pr-2">
                {modal.replies?.map((r, idx) => (
                  <div key={idx} className="p-3 bg-gray-50 rounded-xl border border-gray-200">
                    <div className="text-sm text-gray-600 mb-1">
                      <span className="font-semibold">{r.author || 'Anonymous'}</span> • {new Date(r.createdAt).toLocaleString()}
                    </div>
                    <div className="text-gray-700">{r.content}</div>
                  </div>
                ))}
                {!modal.replies?.length && <div className="text-sm text-gray-500 italic">No replies yet. Be the first!</div>}
              </div>
            </div>

            <ReplyForm postId={modal._id} onAdd={addReply} user={user} />
          </div>
        </div>
      )}
    </div>
  );
}

function ReplyForm({ postId, onAdd, user }) {
  const [text, setText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    try {
      setIsSubmitting(true);
      await onAdd(postId, text, user?.name || 'Anonymous');
      setText('');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-4 pt-4 border-t border-gray-200">
      <label className="block text-sm font-semibold text-gray-700 mb-2">Add Your Reply</label>
      <div className="flex flex-col gap-2">
        <textarea
          required
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Share your thoughts or answer..."
          maxLength="1000"
          className="px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          rows="3"
          disabled={isSubmitting}
        />
        <div className="flex justify-between items-center">
          <div className="text-xs text-gray-500">{text.length}/1000</div>
          <button
            type="submit"
            disabled={!text.trim() || isSubmitting}
            className="px-4 py-2 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {isSubmitting ? 'Posting...' : 'Post Reply'}
          </button>
        </div>
      </div>
    </form>
  );
}
