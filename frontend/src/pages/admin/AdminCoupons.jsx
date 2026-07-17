import { useEffect, useState } from 'react';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import ImageUploadField from '../../components/admin/ImageUploadField';

const EMPTY = {
  code: '',
  type: 'percent',
  value: '',
  minOrder: '',
  expiresAt: '',
  featured: false,
  promoImage: '',
  promoHeadline: '',
  promoSubtext: '',
};

export default function AdminCoupons() {
  const { token } = useAuth();
  const [coupons, setCoupons] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [message, setMessage] = useState(null);
  const [busy, setBusy] = useState(false);

  function load() {
    api.admin.getCoupons(token).then((d) => setCoupons(d.coupons)).catch(() => {});
  }
  useEffect(load, [token]);

  async function add(e) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      await api.admin.createCoupon(token, {
        code: form.code,
        type: form.type,
        value: Number(form.value),
        minOrder: Number(form.minOrder) || 0,
        expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
        featured: form.featured,
        promoImage: form.promoImage,
        promoHeadline: form.promoHeadline,
        promoSubtext: form.promoSubtext,
      });
      setForm(EMPTY);
      setMessage({ type: 'success', text: 'Coupon created.' });
      load();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(c) {
    try {
      await api.admin.updateCoupon(token, c.id, { active: !c.active });
      load();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  }

  async function toggleFeatured(c) {
    try {
      await api.admin.updateCoupon(token, c.id, { featured: !c.featured });
      load();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  }

  async function del(c) {
    if (!window.confirm(`Delete coupon "${c.code}"?`)) return;
    try {
      await api.admin.deleteCoupon(token, c.id);
      load();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  }

  return (
    <>
      <div className="admin-head">
        <h1>Coupons</h1>
      </div>

      {message && <div className={`alert alert-${message.type}`}>{message.text}</div>}

      <form className="admin-card" onSubmit={add}>
        <h3>New coupon</h3>
        <div className="form-grid">
          <div className="field">
            <label>Code</label>
            <input
              required
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
              placeholder="e.g. WELCOME10"
            />
          </div>
          <div className="field">
            <label>Type</label>
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              <option value="percent">Percentage off</option>
              <option value="flat">Flat amount off</option>
            </select>
          </div>
          <div className="field">
            <label>{form.type === 'percent' ? 'Discount %' : 'Discount ₹'}</label>
            <input
              required
              type="number"
              min="1"
              value={form.value}
              onChange={(e) => setForm({ ...form, value: e.target.value })}
            />
          </div>
          <div className="field">
            <label>Minimum order ₹ (optional)</label>
            <input
              type="number"
              min="0"
              value={form.minOrder}
              onChange={(e) => setForm({ ...form, minOrder: e.target.value })}
            />
          </div>
          <div className="field">
            <label>Expires on (optional)</label>
            <input type="date" value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} />
          </div>
          <div className="field">
            <label>Advertise on site</label>
            <label className="flex gap-1" style={{ alignItems: 'center', fontWeight: 400 }}>
              <input
                type="checkbox"
                checked={form.featured}
                onChange={(e) => setForm({ ...form, featured: e.target.checked })}
              />
              Show in homepage promo popup
            </label>
          </div>
        </div>

        {form.featured && (
          <div className="form-grid" style={{ marginTop: 4 }}>
            <ImageUploadField
              value={form.promoImage}
              onChange={(url) => setForm({ ...form, promoImage: url })}
              label="Popup image (optional)"
            />
            <div className="field">
              <label>Popup headline (optional)</label>
              <input
                value={form.promoHeadline}
                onChange={(e) => setForm({ ...form, promoHeadline: e.target.value })}
                placeholder="e.g. Today Only!"
              />
            </div>
            <div className="field">
              <label>Popup sub-text (optional)</label>
              <input
                value={form.promoSubtext}
                onChange={(e) => setForm({ ...form, promoSubtext: e.target.value })}
                placeholder="e.g. Don't miss out — this deal ends soon!"
              />
            </div>
          </div>
        )}

        <button className="btn btn-gold btn-sm" disabled={busy}>{busy ? 'Saving…' : '+ Add coupon'}</button>
      </form>

      <p className="muted" style={{ fontSize: '0.85rem' }}>
        Only one featured coupon is shown at a time — mark the one you want advertised in the
        homepage popup. If several are marked, the first active one found is used.
      </p>

      <div className="admin-card">
        <table className="admin-table">
          <thead>
            <tr><th>Code</th><th>Discount</th><th>Min order</th><th>Expires</th><th>Status</th><th>Featured</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {coupons.length === 0 && (
              <tr><td colSpan={7} className="muted">No coupons yet.</td></tr>
            )}
            {coupons.map((c) => (
              <tr key={c.id}>
                <td><code>{c.code}</code></td>
                <td>{c.type === 'percent' ? `${c.value}%` : `₹${c.value}`}</td>
                <td>{c.minOrder ? `₹${c.minOrder}` : '—'}</td>
                <td>{c.expiresAt ? new Date(c.expiresAt).toLocaleDateString('en-IN') : 'Never'}</td>
                <td>
                  <span className={`pill status-${c.active ? 'placed' : 'cancelled'}`}>
                    {c.active ? 'Active' : 'Disabled'}
                  </span>
                </td>
                <td>
                  {c.featured ? <span className="pill status-placed">Featured</span> : <span className="muted">—</span>}
                </td>
                <td>
                  <button className="link-btn" onClick={() => toggleActive(c)}>
                    {c.active ? 'disable' : 'enable'}
                  </button>{' '}
                  <button className="link-btn" onClick={() => toggleFeatured(c)}>
                    {c.featured ? 'unfeature' : 'feature'}
                  </button>{' '}
                  <button className="link-btn danger" onClick={() => del(c)}>delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
