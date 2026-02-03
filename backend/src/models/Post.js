import mongoose from 'mongoose';

/*
  This file exports ONE default model.
  - If USE_MOCK_DB=true → in-memory DB (no Mongo required)
  - Else → real MongoDB (mongoose)
*/

let PostModelImpl = null;

/* =========================================================
   MOCK DATABASE (USED WHEN MONGO IS DOWN)
========================================================= */
if (process.env.USE_MOCK_DB === 'true') {
  let posts = [];
  let idCounter = 1;

  const makeId = () => String(idCounter++);

  const applyFilter = (items, filter) => {
    if (!filter || Object.keys(filter).length === 0) return items;

    if (filter.$or) {
      const q =
        filter.$or
          .map(o => Object.values(o)[0]?.$regex)
          .find(Boolean) || '';
      const re = new RegExp(q, 'i');

      return items.filter(
        p => re.test(p.title) || re.test(p.content)
      );
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
      replies: [],
    };

    posts.push(doc);
    return doc;
  };

  const find = (filter = {}) => {
    return {
      _sort: null,

      sort(sortObj) {
        this._sort = sortObj;
        return this;
      },

      async exec() {
        let result = applyFilter([...posts], filter);

        if (this._sort) {
          const key = Object.keys(this._sort)[0];
          const dir = this._sort[key];
          result.sort((a, b) =>
            a[key] < b[key] ? dir : -dir
          );
        }

        return result;
      },
    };
  };

  const findById = async (id) =>
    posts.find(p => String(p._id) === String(id)) || null;

  const findByIdAndUpdate = async (id, update, opts = {}) => {
    const post = posts.find(p => String(p._id) === String(id));
    if (!post) return null;

    if (update.$inc) {
      for (const k in update.$inc) {
        post[k] = (post[k] || 0) + update.$inc[k];
      }
    }

    if (update.$set) {
      for (const k in update.$set) {
        post[k] = update.$set[k];
      }
    }

    return opts.new ? post : post;
  };

  PostModelImpl = {
    create,
    find,
    findById,
    findByIdAndUpdate,

    // debug helper
    __getAll() {
      return posts;
    },
  };
}

/* =========================================================
   REAL MONGODB MODEL (DEFAULT)
========================================================= */
const ReplySchema = new mongoose.Schema({
  content: { type: String, required: true },
  author: { type: String, default: 'Anonymous' },
  createdAt: { type: Date, default: Date.now },
});

const PostSchema = new mongoose.Schema({
  title: { type: String, required: true },
  content: { type: String, required: true },
  author: { type: String, default: 'Anonymous' },
  votes: { type: Number, default: 0 },
  answered: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  replies: [ReplySchema],
});

const RealModel = mongoose.model('Post', PostSchema);

/* =========================================================
   EXPORT (MOCK OR REAL)
========================================================= */
export default PostModelImpl || RealModel;
