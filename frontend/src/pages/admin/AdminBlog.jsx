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

  const [banner, setBanner] = useState({ bannerImage: '', bannerTitle: '', bannerSubtitle: '' });
  const [bannerSaving, setBannerSaving] = useState(false);
  const [bannerMessage, setBannerMessage] = useState(null);

  const [comments, setComments] = useState([]);

  function load() {
    api.admin.getBlogPosts(token).then((d) => setPosts(d.posts)).catch(() => {});
    api.admin
      .getBlogSettings(token)
      .then((d) =>
        setBanner({
          bannerImage: d.settings.bannerImage || '',
          bannerTitle: d.settings.bannerTitle || '',
          bannerSubtitle: d.settings.bannerSubtitle || '',
        })
      )
      .catch(() => {});
  }
  useEffect(load, [token]);

  async function saveBanner() {
    setBannerSaving(true);
    setBannerMessage(null);
    try {
      await api.admin.updateBlogSettings(token, banner);
      setBannerMessage({ type: 'success', text: 'Banner updated.' });
    } catch (err) {
      setBannerMessage({ type: 'error', text: err.message });
    } finally {
      setBannerSaving(false);
    }
  }

  function startNew() {
    setForm(EMPTY);
    setEditing('new');
    setMessage(null);
  }

  function startEdit(p) {
    setForm(p);
    setEditing(p.id);
    setMessage(null);
    setComments([]);
    api.getBlogComments(p.id).then((d) => setComments(d.comments)).catch(() => {});
  }

  async function delComment(id) {
    if (!window.confirm('Delete this comment? This cannot be undone.')) return;
    try {
      await api.admin.deleteBlogComment(token, id);
      setComments((cs) => cs.filter((c) => c.id !== id));
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
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

      <div className="admin-card">
        <h3>Blog page banner</h3>
        <p className="muted" style={{ marginBottom: 14 }}>
          Controls the banner at the top of the public /blog page. Leave title/subtitle empty to use the
          default translated text (shown correctly in Hindi/Tamil/Telugu/Kannada too); filling them in
          overrides that with your own words in English only, on every language.
        </p>
        {bannerMessage && <div className={`alert alert-${bannerMessage.type}`}>{bannerMessage.text}</div>}
        <ImageUploadField
          value={banner.bannerImage}
          onChange={(url) => setBanner((b) => ({ ...b, bannerImage: url }))}
          label="Banner background"
        />
        <div className="form-grid">
          <div className="field">
            <label htmlFor="banner-title-override">Title override (optional)</label>
            <input
              id="banner-title-override"
              value={banner.bannerTitle}
              onChange={(e) => setBanner((b) => ({ ...b, bannerTitle: e.target.value }))}
              placeholder='Default: "From the Ghani"'
            />
          </div>
          <div className="field">
            <label htmlFor="banner-subtitle-override">Subtitle override (optional)</label>
            <input
              id="banner-subtitle-override"
              value={banner.bannerSubtitle}
              onChange={(e) => setBanner((b) => ({ ...b, bannerSubtitle: e.target.value }))}
              placeholder="Default: Notes on traditional pressing…"
            />
          </div>
        </div>
        <button type="button" className="btn btn-gold btn-sm" disabled={bannerSaving} onClick={saveBanner}>
          {bannerSaving ? 'Saving…' : 'Save banner'}
        </button>
      </div>

      {editing && (
        <form className="admin-card" onSubmit={save}>
          <h3>{editing === 'new' ? 'New post' : `Edit: ${form.title}`}</h3>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="post-title">Title</label>
              <input id="post-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
            </div>
            <div className="field">
              <label htmlFor="post-category">Category tag (optional, e.g. "Wellness", "Buying Guide")</label>
              <input id="post-category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
            </div>
          </div>

          <ImageUploadField value={form.image} onChange={(url) => setForm({ ...form, image: url })} label="Cover image" />

          <div className="field">
            <label htmlFor="post-excerpt">Excerpt (short summary shown on the blog listing card)</label>
            <input id="post-excerpt" value={form.excerpt} onChange={(e) => setForm({ ...form, excerpt: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="post-content">Content (leave a blank line between paragraphs)</label>
            <textarea
              id="post-content"
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

      {editing && editing !== 'new' && (
        <div className="admin-card">
          <h3>Comments {comments.length > 0 && `(${comments.length})`}</h3>
          {comments.length === 0 ? (
            <p className="muted">No comments on this post yet.</p>
          ) : (
            comments.map((c) => (
              <div key={c.id} className="admin-comment-row">
                <div>
                  <b>{c.userName}</b> <span className="muted">{new Date(c.createdAt).toLocaleDateString()}</span>
                  <p style={{ margin: '4px 0 0' }}>{c.text}</p>
                </div>
                <button className="link-btn danger" onClick={() => delComment(c.id)}>delete</button>
              </div>
            ))
          )}
        </div>
      )}

      <div className="admin-card">
        <table className="admin-table">
          <thead>
            <tr><th /><th>Title</th><th>Category</th><th>Status</th><th>♡ Likes</th><th>💬 Comments</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {posts.map((p) => (
              <tr key={p.id}>
                <td><img className="thumb" src={getProductImage(p.image)} alt="" /></td>
                <td><b>{p.title}</b></td>
                <td>{p.category || '—'}</td>
                <td>{p.published ? 'Published' : 'Draft'}</td>
                <td>{p.likes || 0}</td>
                <td>{p.commentsCount || 0}</td>
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
