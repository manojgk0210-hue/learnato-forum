import mongoose from 'mongoose';

// Export a single default value at module top-level. If `USE_MOCK_DB` is set
// to 'true' we'll use an in-memory implementation; otherwise use mongoose.
let PostModelImpl = null;

if (process.env.USE_MOCK_DB === 'true') {
  let posts = [];
  let idCounter = 1;

  const makeId = () => String(idCounter++);

  const applyFilter = (items, filter) => {
    if (!filter || Object.keys(filter).length === 0) return items;
    if (filter.$or) {
      const q = filter.$or.map(o => Object.values(o)[0].$regex)[0] || '';
      const re = new RegExp(q, 'i');
      return items.filter(it => re.test(it.title) || re.test(it.content));
    }
    return items;
  };

  const create = async (data) => {
    const doc = {
      _id: makeId(),
      title: data.title,
      content: data.content,
      author: data.author || 'Anonymous',
      votes: data.votes || 0,
      answered: data.answered || false,
      createdAt: new Date(),
      replies: []
    };
    posts.push(doc);
    return doc;
  };

  const find = (filter = {}) => {
    const chain = {
      sort(sortObj) {
        this._sort = sortObj; return this;
      },
      async exec() {
        let res = applyFilter(posts.slice(), filter);
        if (this._sort) {
          const key = Object.keys(this._sort)[0];
          const dir = this._sort[key];
          res.sort((a,b)=> (a[key] < b[key] ? dir : -dir));
        }
        return res;
      }
    };
    return chain;
  };

  const findById = async (id) => posts.find(p => String(p._id) === String(id)) || null;

  const findByIdAndUpdate = async (id, update, opts = {}) => {
    const p = posts.find(p => String(p._id) === String(id));
    if (!p) return null;
    if (update.$inc) {
      for (const k of Object.keys(update.$inc)) p[k] = (p[k] || 0) + update.$inc[k];
    }
    if (update.$set) {
      for (const k of Object.keys(update.$set)) p[k] = update.$set[k];
    }
    if (opts.new) return p;
    return p;
  };

  PostModelImpl = {
    create,
    find,
    findById,
    findByIdAndUpdate,
    __getAll() { return posts; },
  };
}

// Default: real mongoose model
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

const RealModel = mongoose.model('Post', PostSchema);

export default (PostModelImpl || RealModel);
