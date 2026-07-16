import { useEffect, useState } from 'react';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { getProductImage } from '../../utils/productImages';
import ImageUploadField from '../../components/admin/ImageUploadField';

const EMPTY = {
  name: '',
  category: '',
  shortDescription: '',
  description: '',
  image: '',
  extraImages: [],
  sizes: [{ label: '500 ml', price: '', mrp: '', stock: '' }],
  tags: '',
};

function toForm(p) {
  return {
    ...p,
    extraImages: (p.images || []).filter((img) => img && img !== p.image),
    tags: (p.tags || []).join(', '),
  };
}

function fromForm(f) {
  const { extraImages, ...rest } = f;
  return {
    ...rest,
    images: [f.image, ...extraImages].filter(Boolean),
    sizes: f.sizes.map((s) => ({
      label: s.label,
      price: Number(s.price),
      mrp: Number(s.mrp || s.price),
      stock: Number(s.stock || 0),
    })),
    tags: f.tags.split(',').map((t) => t.trim()).filter(Boolean),
  };
}

export default function AdminProducts() {
  const { token } = useAuth();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [editing, setEditing] = useState(null); // null | 'new' | product id
  const [form, setForm] = useState(EMPTY);
  const [notifyCustomers, setNotifyCustomers] = useState(true);
  const [message, setMessage] = useState(null);
  const [busy, setBusy] = useState(false);

  function load() {
    api.getProducts().then((d) => setProducts(d.products)).catch(() => {});
    api.admin.getCategories(token).then((d) => setCategories(d.categories)).catch(() => {});
  }
  useEffect(load, [token]);

  function startNew() {
    setForm({ ...EMPTY, category: categories[0]?.id || '' });
    setEditing('new');
    setMessage(null);
  }

  function startEdit(p) {
    setForm(toForm(p));
    setEditing(p.id);
    setMessage(null);
  }

  function setSize(i, key, value) {
    setForm((f) => {
      const sizes = f.sizes.map((s, idx) => (idx === i ? { ...s, [key]: value } : s));
      return { ...f, sizes };
    });
  }

  function validate(f) {
    if (!f.sizes.length) return 'Add at least one size.';
    for (const s of f.sizes) {
      if (!s.label.trim()) return 'Every size needs a label.';
      if (!s.price || Number(s.price) <= 0) return `"${s.label}" needs a price greater than ₹0.`;
      if (s.mrp && Number(s.mrp) < Number(s.price)) return `"${s.label}"'s MRP can't be less than its price.`;
      if (s.stock && Number(s.stock) < 0) return `"${s.label}"'s stock can't be negative.`;
    }
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
      const payload = fromForm(form);
      if (editing === 'new') {
        await api.admin.createProduct(token, payload);
        setMessage({ type: 'success', text: 'Product created.' });
      } else {
        const res = await api.admin.updateProduct(token, editing, { ...payload, notifyCustomers });
        setMessage({
          type: 'success',
          text: res.notified
            ? `Product updated. Price-drop announced to ${res.notified.audience} customers (${res.notified.email} emails).`
            : 'Product updated.',
        });
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
    if (!window.confirm(`Delete "${p.name}"? This cannot be undone.`)) return;
    try {
      await api.admin.deleteProduct(token, p.id);
      load();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  }

  return (
    <>
      <div className="admin-head">
        <h1>Products</h1>
        <button className="btn btn-gold btn-sm" onClick={startNew}>+ Add product</button>
      </div>

      {message && <div className={`alert alert-${message.type}`}>{message.text}</div>}

      {editing && (
        <form className="admin-card" onSubmit={save}>
          <h3>{editing === 'new' ? 'New product' : `Edit: ${form.name}`}</h3>
          <div className="form-grid">
            <div className="field">
              <label>Name</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div className="field">
              <label>Category</label>
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} required>
                <option value="">Select…</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Tags (comma-separated)</label>
              <input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} />
            </div>
          </div>

          <ImageUploadField value={form.image} onChange={(url) => setForm({ ...form, image: url })} />

          <label style={{ fontWeight: 600, fontSize: '0.85rem', display: 'block', marginTop: 4 }}>
            Additional photos (gallery)
          </label>
          {form.extraImages.map((url, i) => (
            <div key={i} className="flex gap-1" style={{ alignItems: 'flex-end', marginBottom: 10 }}>
              <div style={{ flex: 1 }}>
                <ImageUploadField
                  value={url}
                  onChange={(next) =>
                    setForm((f) => ({
                      ...f,
                      extraImages: f.extraImages.map((u, idx) => (idx === i ? next : u)),
                    }))
                  }
                />
              </div>
              <button
                type="button"
                className="link-btn danger"
                style={{ marginBottom: 14 }}
                onClick={() => setForm((f) => ({ ...f, extraImages: f.extraImages.filter((_, idx) => idx !== i) }))}
              >
                remove
              </button>
            </div>
          ))}
          <button
            type="button"
            className="link-btn"
            onClick={() => setForm((f) => ({ ...f, extraImages: [...f.extraImages, ''] }))}
          >
            + add another photo
          </button>

          <div className="field" style={{ marginTop: 16 }}>
            <label>Short description</label>
            <input value={form.shortDescription} onChange={(e) => setForm({ ...form, shortDescription: e.target.value })} />
          </div>
          <div className="field">
            <label>Full description</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>

          <label style={{ fontWeight: 600, fontSize: '0.85rem' }}>Sizes, rates & stock</label>
          <table className="admin-table sizes-editor">
            <thead>
              <tr><th>Size label</th><th>Price ₹</th><th>MRP ₹</th><th>Stock</th><th /></tr>
            </thead>
            <tbody>
              {form.sizes.map((s, i) => (
                <tr key={i}>
                  <td><input value={s.label} onChange={(e) => setSize(i, 'label', e.target.value)} required /></td>
                  <td><input type="number" min="0" value={s.price} onChange={(e) => setSize(i, 'price', e.target.value)} required /></td>
                  <td><input type="number" min="0" value={s.mrp} onChange={(e) => setSize(i, 'mrp', e.target.value)} /></td>
                  <td><input type="number" min="0" value={s.stock} onChange={(e) => setSize(i, 'stock', e.target.value)} /></td>
                  <td>
                    {form.sizes.length > 1 && (
                      <button type="button" className="link-btn danger" onClick={() => setForm((f) => ({ ...f, sizes: f.sizes.filter((_, idx) => idx !== i) }))}>
                        remove
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button
            type="button"
            className="link-btn"
            onClick={() => setForm((f) => ({ ...f, sizes: [...f.sizes, { label: '', price: '', mrp: '', stock: '' }] }))}
          >
            + add size
          </button>

          {editing !== 'new' && (
            <label className="check-row">
              <input type="checkbox" checked={notifyCustomers} onChange={(e) => setNotifyCustomers(e.target.checked)} />
              Announce price drops to all customers (in-app + email)
            </label>
          )}

          <div className="flex gap-2" style={{ marginTop: 16 }}>
            <button className="btn btn-gold btn-sm" disabled={busy}>{busy ? 'Saving…' : 'Save product'}</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(null)}>Cancel</button>
          </div>
        </form>
      )}

      <div className="admin-card">
        <table className="admin-table">
          <thead>
            <tr><th /><th>Product</th><th>Category</th><th>Sizes · price · stock</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id}>
                <td><img className="thumb" src={getProductImage(p.image)} alt="" /></td>
                <td><b>{p.name}</b></td>
                <td>{p.category}</td>
                <td>
                  {p.sizes.map((s) => (
                    <span className="pill" key={s.label}>
                      {s.label} · ₹{s.price} · {s.stock} left
                    </span>
                  ))}
                </td>
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
