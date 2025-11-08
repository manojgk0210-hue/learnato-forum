import React, { useEffect, useMemo, useState } from 'react';
import { io } from 'socket.io-client';

const socket = io('/', { path: '/socket.io' });

function PostCard({ post, onOpen, onUpvote, onAnswer, user }) {
  return (
    <div className="bg-white rounded-2xl shadow p-4 border border-gray-100">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100">
              {post.answered ? 'Answered' : 'Open'}
            </span>
            <span className="text-xs text-gray-500">by {post.author || 'Anonymous'}</span>
            <span className="text-xs text-gray-400">• {new Date(post.createdAt).toLocaleString()}</span>
          </div>
          <h3 className="text-lg font-semibold mt-1">{post.title}</h3>
          <p className="text-gray-600 mt-1 line-clamp-2">{post.content}</p>
          <div className="mt-3 flex items-center gap-3 text-sm text-gray-500">
            <button className="underline" onClick={() => onOpen(post)}>View</button>
            <span>Votes: {post.votes}</span>
            <span>Replies: {post.replies?.length || 0}</span>
          </div>
        </div>
        <div className="flex flex-col items-center">
          <button onClick={() => onUpvote(post)} className="px-3 py-1 rounded-xl border hover:bg-gray-50">▲</button>
          <span className="text-sm mt-1">{post.votes}</span>
          {user.role === 'instructor' && !post.answered && (
            <button
              onClick={() => onAnswer(post)}
              className="mt-2 text-xs px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200"
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
  // ---------- Data/UI state ----------
  const [posts, setPosts] = useState([]);
  const [sort, setSort] = useState('date');
  const [q, setQ] = useState('');
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ title: '', content: '', author: '' });

  // ---------- Mock auth (name + role) ----------
  const [user, setUser] = useState(() => ({
    name: localStorage.getItem('user:name') || '',
    role: localStorage.getItem('user:role') || 'student',
  }));
  useEffect(() => {
    localStorage.setItem('user:name', user.name || '');
    localStorage.setItem('user:role', user.role || 'student');
  }, [user]);

  // ---------- AI-lite states ----------
  const [suggestions, setSuggestions] = useState([]);
  const [summary, setSummary] = useState('');
  const [isSummarizing, setIsSummarizing] = useState(false);

  // ---------- Load posts ----------
  const fetchPosts = async () => {
    const url = `/api/posts?sort=${sort}${q ? `&q=${encodeURIComponent(q)}` : ''}`;
    const res = await fetch(url);
    const data = await res.json();
    setPosts(data);
  };
  useEffect(() => { fetchPosts(); }, [sort, q]);

  // ---------- Live updates ----------
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

  // ---------- Create / actions ----------
  const createPost = async (e) => {
    e.preventDefault();
    const res = await fetch('/api/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        author: form.author || user.name || 'Anonymous',
      })
    });
    if (res.ok) setForm({ title: '', content: '', author: '' });
  };

  const upvote = async (post) => {
    await fetch(`/api/posts/${post._id}/upvote`, { method: 'POST' });
  };

  const markAnswered = async (post) => {
    await fetch(`/api/posts/${post._id}/answer`, {
      method: 'POST',
      headers: { 'x-role': user.role },
    });
  };

  const addReply = async (postId, content, author) => {
    await fetch(`/api/posts/${postId}/reply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, author }),
    });
  };

  // ---------- Similar questions (debounced on Title) ----------
  useEffect(() => {
    const t = setTimeout(async () => {
      const s = (form.title || '').trim();
      if (s.length < 3) { setSuggestions([]); return; }
      try {
        const r = await fetch(`/api/posts/similar?q=${encodeURIComponent(s)}&limit=5`);
        const data = await r.json();
        setSuggestions(data);
      } catch { /* ignore */ }
    }, 300);
    return () => clearTimeout(t);
  }, [form.title]);

  // ---------- Summarize selected post ----------
  const fetchSummary = async (id) => {
    try {
      setIsSummarizing(true);
      setSummary('Summarizing…');
      const r = await fetch(`/api/posts/${id}/summary`);
      const data = await r.json();
      setSummary(data.summary || '(no summary)');
    } finally {
      setIsSummarizing(false);
    }
  };

  // Clear summary when opening different post
  useEffect(() => { setSummary(''); }, [modal?._id]);

  const sorted = useMemo(() => posts, [posts]);

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8">
      {/* HEADER */}
      <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Learnato Discussion Forum</h1>
          <p className="text-gray-600">Empower learning through conversation.</p>
        </div>

        {/* Login + Search */}
        <div className="flex gap-2 items-center flex-wrap justify-end">
          <input
            value={user.name}
            onChange={(e) => setUser(u => ({ ...u, name: e.target.value }))}
            placeholder="Your name"
            className="px-3 py-2 border rounded-xl bg-white w-40"
          />
          <select
            value={user.role}
            onChange={(e) => setUser(u => ({ ...u, role: e.target.value }))}
            className="px-3 py-2 border rounded-xl bg-white"
          >
            <option value="student">Student</option>
            <option value="instructor">Instructor</option>
          </select>

          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search posts..."
            className="px-3 py-2 border rounded-xl bg-white w-64"
          />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="px-3 py-2 border rounded-xl bg-white"
          >
            <option value="date">Newest</option>
            <option value="votes">Top</option>
          </select>
        </div>
      </header>

      {/* MAIN */}
      <section className="grid md:grid-cols-3 gap-6">
        {/* New Post Form */}
        <form onSubmit={createPost} className="md:col-span-1 bg-white rounded-2xl shadow p-4 border border-gray-100">
          <h2 className="font-semibold mb-3">New Post</h2>
          <input
            required
            value={form.title}
            onChange={e => setForm({ ...form, title: e.target.value })}
            placeholder="Title"
            className="w-full mb-2 px-3 py-2 border rounded-xl"
          />

          {/* Similar questions panel */}
          {suggestions.length > 0 && (
            <div className="mb-2 p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm">
              <div className="font-semibold mb-1">Similar questions</div>
              <ul className="space-y-1 list-disc pl-5">
                {suggestions.map(s => (
                  <li key={s._id} className="truncate">
                    <button
                      type="button"
                      className="underline hover:no-underline"
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
            placeholder="Content"
            className="w-full mb-2 px-3 py-2 border rounded-xl h-28"
          />
          <input
            value={form.author}
            onChange={e => setForm({ ...form, author: e.target.value })}
            placeholder="Your name (optional)"
            className="w-full mb-3 px-3 py-2 border rounded-xl"
          />
          <button className="w-full px-4 py-2 rounded-xl bg-black text-white">Post</button>
        </form>

        {/* Posts List */}
        <div className="md:col-span-2 space-y-4">
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
      </section>

      {/* MODAL */}
      {modal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4" onClick={() => setModal(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl p-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div>
                <div className="text-sm text-gray-500">
                  by {modal.author || 'Anonymous'} • {new Date(modal.createdAt).toLocaleString()}
                </div>
                <h3 className="text-xl font-semibold">{modal.title}</h3>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setModal(null)} className="px-3 py-1 border rounded-xl">Close</button>
                <button
                  onClick={() => fetchSummary(modal._id)}
                  className="px-3 py-1 border rounded-xl disabled:opacity-60"
                  disabled={isSummarizing}
                >
                  {isSummarizing ? 'Summarizing…' : 'Summarize'}
                </button>
              </div>
            </div>

            <p className="mt-2 text-gray-700 whitespace-pre-wrap">{modal.content}</p>

            {/* Summary block */}
            {summary && (
              <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm">
                <div className="font-semibold mb-1">Summary</div>
                <div className="text-amber-900">{summary}</div>
              </div>
            )}

            <div className="mt-4">
              <h4 className="font-semibold mb-2">Replies</h4>
              <div className="space-y-2 max-h-60 overflow-auto pr-2">
                {modal.replies?.map((r, idx) => (
                  <div key={idx} className="p-3 bg-gray-50 rounded-xl border">
                    <div className="text-sm text-gray-500 mb-1">
                      by {r.author || 'Anonymous'} • {new Date(r.createdAt).toLocaleString()}
                    </div>
                    <div>{r.content}</div>
                  </div>
                ))}
                {!modal.replies?.length && <div className="text-sm text-gray-500">No replies yet.</div>}
              </div>
            </div>

            <ReplyForm postId={modal._id} onAdd={addReply} />
          </div>
        </div>
      )}
    </div>
  );
}

function ReplyForm({ postId, onAdd }) {
  const [text, setText] = useState('');
  const [author, setAuthor] = useState('');
  return (
    <form
      onSubmit={async (e) => { e.preventDefault(); await onAdd(postId, text, author); setText(''); setAuthor(''); }}
      className="mt-4 flex flex-col md:flex-row gap-2"
    >
      <input
        value={author}
        onChange={e => setAuthor(e.target.value)}
        placeholder="Your name (optional)"
        className="px-3 py-2 border rounded-xl flex-1"
      />
      <input
        required
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="Write a reply..."
        className="px-3 py-2 border rounded-xl flex-[3]"
      />
      <button className="px-4 py-2 bg-black text-white rounded-xl">Reply</button>
    </form>
  );
}
