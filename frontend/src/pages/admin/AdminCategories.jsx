import { Fragment, useEffect, useRef, useState } from 'react';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { getProductImage } from '../../utils/productImages';
import ImageUploadField from '../../components/admin/ImageUploadField';

export default function AdminCategories() {
  const { token } = useAuth();
  const [categories, setCategories] = useState([]);
  const [label, setLabel] = useState('');
  const [image, setImage] = useState('');
  const [description, setDescription] = useState('');
  const [message, setMessage] = useState(null);
  const [rowUploading, setRowUploading] = useState(null); // category id currently uploading
  const [openDescId, setOpenDescId] = useState(null); // category id whose description editor is open
  const [descDraft, setDescDraft] = useState('');
  const [savingDesc, setSavingDesc] = useState(false);
  const rowFileInputs = useRef({});

  function load() {
    api.admin.getCategories(token).then((d) => setCategories(d.categories)).catch(() => {});
  }
  useEffect(load, [token]);

  async function add(e) {
    e.preventDefault();
    setMessage(null);
    try {
      await api.admin.createCategory(token, { label, image, description });
      setLabel('');
      setImage('');
      setDescription('');
      setMessage({ type: 'success', text: 'Category added.' });
      load();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  }

  async function rename(c) {
    const next = window.prompt('Category label:', c.label);
    if (!next || next === c.label) return;
    try {
      await api.admin.updateCategory(token, c.id, { label: next });
      load();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  }

  function toggleDescEditor(c) {
    if (openDescId === c.id) {
      setOpenDescId(null);
      return;
    }
    setOpenDescId(c.id);
    setDescDraft(c.description || '');
  }

  async function saveDescription(c) {
    setSavingDesc(true);
    try {
      await api.admin.updateCategory(token, c.id, { description: descDraft });
      setMessage({ type: 'success', text: `Description saved for "${c.label}".` });
      setOpenDescId(null);
      load();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSavingDesc(false);
    }
  }

  async function changeRowImage(c, file) {
    setRowUploading(c.id);
    setMessage(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const uploaded = await api.admin.uploadImage(token, fd);
      await api.admin.updateCategory(token, c.id, { image: uploaded.url });
      load();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setRowUploading(null);
    }
  }

  // Sellers can propose a category while listing a product; it's created
  // immediately but hidden from the shop's category nav until approved here.
  async function approve(c) {
    try {
      await api.admin.updateCategory(token, c.id, { pending: false });
      setMessage({ type: 'success', text: `"${c.label}" is now live in the category menu.` });
      load();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  }

  async function del(c) {
    if (!window.confirm(`Delete category "${c.label}"?`)) return;
    try {
      await api.admin.deleteCategory(token, c.id);
      load();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  }

  return (
    <>
      <div className="admin-head">
        <h1>Categories</h1>
      </div>

      {message && <div className={`alert alert-${message.type}`}>{message.text}</div>}

      <form className="admin-card" onSubmit={add}>
        <div className="form-inline" style={{ marginBottom: 12 }}>
          <div className="field" style={{ flex: 1 }}>
            <label htmlFor="new-category-label">New category label</label>
            <input id="new-category-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Mustard Oil" required />
          </div>
          <ImageUploadField value={image} onChange={setImage} label="Tile image" />
        </div>
        <div className="field">
          <label htmlFor="new-category-description">Category page description (optional, but worth writing)</label>
          <textarea
            id="new-category-description"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="A couple of sentences shown on this category's own page — what it is, how it's used, what makes it different. This is what gives the page a real chance of ranking for its own search term, instead of being a bare product grid."
          />
        </div>
        <button className="btn btn-gold btn-sm">+ Add category</button>
      </form>

      <div className="admin-card">
        <table className="admin-table">
          <thead>
            <tr><th /><th>Label</th><th>Slug</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {categories.map((c) => (
              <Fragment key={c.id}>
                <tr>
                  <td><img className="thumb" src={getProductImage(c.image)} alt="" /></td>
                  <td>
                    <b>{c.label}</b>
                    {c.pending && (
                      <>
                        <br />
                        <span className="pill warn">Proposed by {c.proposedByName || 'a seller'}</span>
                      </>
                    )}
                  </td>
                  <td><code>{c.id}</code></td>
                  <td>
                    {c.pending && (
                      <>
                        <button className="link-btn" onClick={() => approve(c)}><b>approve</b></button>{' '}
                      </>
                    )}
                    <button className="link-btn" onClick={() => rename(c)}>rename</button>{' '}
                    <button
                      className="link-btn"
                      disabled={rowUploading === c.id}
                      onClick={() => rowFileInputs.current[c.id]?.click()}
                    >
                      {rowUploading === c.id ? 'uploading…' : 'change image'}
                    </button>{' '}
                    <button className="link-btn" onClick={() => toggleDescEditor(c)}>
                      {c.description ? 'edit description' : 'add description'}
                    </button>{' '}
                    <button className="link-btn danger" onClick={() => del(c)}>delete</button>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      ref={(el) => (rowFileInputs.current[c.id] = el)}
                      onChange={(e) => {
                        const file = e.target.files[0];
                        e.target.value = '';
                        if (file) changeRowImage(c, file);
                      }}
                      hidden
                    />
                  </td>
                </tr>
                {openDescId === c.id && (
                  <tr>
                    <td colSpan={4} style={{ background: 'rgba(31,61,43,0.03)' }}>
                      <div className="field" style={{ margin: '8px 0' }}>
                        <label htmlFor={`category-description-${c.id}`}>Description shown on /shop?category={c.id}</label>
                        <textarea
                          id={`category-description-${c.id}`}
                          rows={3}
                          value={descDraft}
                          onChange={(e) => setDescDraft(e.target.value)}
                          autoFocus
                        />
                      </div>
                      <button className="btn btn-gold btn-sm" disabled={savingDesc} onClick={() => saveDescription(c)}>
                        {savingDesc ? 'Saving…' : 'Save description'}
                      </button>{' '}
                      <button className="btn btn-ghost btn-sm" onClick={() => setOpenDescId(null)}>Cancel</button>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
