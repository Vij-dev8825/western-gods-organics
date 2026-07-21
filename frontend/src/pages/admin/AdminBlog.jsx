import { useEffect, useState } from 'react';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { getProductImage } from '../../utils/productImages';
import ImageUploadField from '../../components/admin/ImageUploadField';

const EMPTY = {
  title: '',
  category: '',
  image: '',
  excerpt: '',
  content: '',
  published: true,
};

export default function AdminBlog() {
  const { token } = useAuth();
  const [posts, setPosts] = useState([]);
  const [editing, setEditing] = useState(null); // null | 'new' | post id
  const [form, setForm] = useState(EMPTY);
  const [message, setMessage] = useState(null);
  const [busy, setBusy] = useState(false);

  function load() {
    api.admin.getBlogPosts(token).then((d) => setPosts(d.posts)).catch(() => {});
  }
  useEffect(load, [token]);

  function startNew() {
    setForm(EMPTY);
    setEditing('new');
    setMessage(null);
  }

  function startEdit(p) {
    setForm(p);
    setEditing(p.id);
    setMessage(null);
  }

  function validate(f) {
    if (!f.title.trim()) return 'Title is required.';
    if (!f.content.trim()) return 'Post content is required.';
    return null;
  }

  async function save(e) {
    e.preventDefault();
    const error = validate(form);
    if (error) {
      setMessage({ type: 'error', text: error });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      if (editing === 'new') {
        await api.admin.createBlogPost(token, form);
        setMessage({ type: 'success', text: 'Post created.' });
      } else {
        await api.admin.updateBlogPost(token, editing, form);
        setMessage({ type: 'success', text: 'Post updated.' });
      }
      setEditing(null);
      load();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setBusy(false);
    }
  }

  async function del(p) {
    if (!window.confirm(`Delete "${p.title}"? This cannot be undone.`)) return;
    try {
      await api.admin.deleteBlogPost(token, p.id);
      load();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  }

  return (
    <>
      <div className="admin-head">
        <h1>Blog</h1>
        <button className="btn btn-gold btn-sm" onClick={startNew}>+ New post</button>
      </div>

      {message && <div className={`alert alert-${message.type}`}>{message.text}</div>}

      {editing && (
        <form className="admin-card" onSubmit={save}>
          <h3>{editing === 'new' ? 'New post' : `Edit: ${form.title}`}</h3>
          <div className="form-grid">
            <div className="field">
              <label>Title</label>
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
            </div>
            <div className="field">
              <label>Category tag (optional, e.g. "Wellness", "Buying Guide")</label>
              <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
            </div>
          </div>

          <ImageUploadField value={form.image} onChange={(url) => setForm({ ...form, image: url })} label="Cover image" />

          <div className="field">
            <label>Excerpt (short summary shown on the blog listing card)</label>
            <input value={form.excerpt} onChange={(e) => setForm({ ...form, excerpt: e.target.value })} />
          </div>
          <div className="field">
            <label>Content (leave a blank line between paragraphs)</label>
            <textarea
              rows={12}
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              required
            />
          </div>

          <label className="check-row">
            <input
              type="checkbox"
              checked={form.published}
              onChange={(e) => setForm({ ...form, published: e.target.checked })}
            />
            Published (visible on the public /blog page)
          </label>

          <div className="flex gap-2" style={{ marginTop: 16 }}>
            <button className="btn btn-gold btn-sm" disabled={busy}>{busy ? 'Saving…' : 'Save post'}</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(null)}>Cancel</button>
          </div>
        </form>
      )}

      <div className="admin-card">
        <table className="admin-table">
          <thead>
            <tr><th /><th>Title</th><th>Category</th><th>Status</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {posts.map((p) => (
              <tr key={p.id}>
                <td><img className="thumb" src={getProductImage(p.image)} alt="" /></td>
                <td><b>{p.title}</b></td>
                <td>{p.category || '—'}</td>
                <td>{p.published ? 'Published' : 'Draft'}</td>
                <td>
                  <button className="link-btn" onClick={() => startEdit(p)}>edit</button>{' '}
                  <button className="link-btn danger" onClick={() => del(p)}>delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
