import { useEffect, useRef, useState } from 'react';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { getProductImage } from '../../utils/productImages';
import ImageUploadField from '../../components/admin/ImageUploadField';

export default function AdminCategories() {
  const { token } = useAuth();
  const [categories, setCategories] = useState([]);
  const [label, setLabel] = useState('');
  const [image, setImage] = useState('');
  const [message, setMessage] = useState(null);
  const [rowUploading, setRowUploading] = useState(null); // category id currently uploading
  const rowFileInputs = useRef({});

  function load() {
    api.admin.getCategories(token).then((d) => setCategories(d.categories)).catch(() => {});
  }
  useEffect(load, [token]);

  async function add(e) {
    e.preventDefault();
    setMessage(null);
    try {
      await api.admin.createCategory(token, { label, image });
      setLabel('');
      setImage('');
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

      <form className="admin-card form-inline" onSubmit={add}>
        <div className="field" style={{ flex: 1 }}>
          <label>New category label</label>
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Mustard Oil" required />
        </div>
        <ImageUploadField value={image} onChange={setImage} label="Tile image" />
        <button className="btn btn-gold btn-sm">+ Add category</button>
      </form>

      <div className="admin-card">
        <table className="admin-table">
          <thead>
            <tr><th /><th>Label</th><th>Slug</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {categories.map((c) => (
              <tr key={c.id}>
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
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
