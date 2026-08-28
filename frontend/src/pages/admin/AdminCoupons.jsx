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
  promoLink: '',
  promoCta: '',
};

export default function AdminCoupons() {
  const { token } = useAuth();
  const [coupons, setCoupons] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState(null); // the coupon being edited, or null to create
  const [message, setMessage] = useState(null);
  const [busy, setBusy] = useState(false);

  function load() {
    api.admin.getCoupons(token).then((d) => setCoupons(d.coupons)).catch(() => {});
  }
  useEffect(load, [token]);

  const isExpired = (c) => !!c.expiresAt && new Date(c.expiresAt) < new Date();

  /* Which featured coupon the site will actually put in the popup. Same rule as
     GET /api/coupons/featured — first one that is featured, enabled and not
     past its date. Worked out here so the table can say so, rather than leaving
     an admin to guess which of several "Featured" pills is the live one. */
  const liveFeaturedId = coupons.find((c) => c.featured && c.active && !isExpired(c))?.id || null;

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    const payload = {
      code: form.code,
      type: form.type,
      value: Number(form.value),
      minOrder: Number(form.minOrder) || 0,
      expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
      featured: form.featured,
      promoImage: form.promoImage,
      promoHeadline: form.promoHeadline,
      promoSubtext: form.promoSubtext,
      promoLink: form.promoLink,
      promoCta: form.promoCta,
    };
    try {
      if (editing) {
        await api.admin.updateCoupon(token, editing.id, payload);
        setMessage({ type: 'success', text: `${form.code} updated.` });
      } else {
        await api.admin.createCoupon(token, payload);
        setMessage({ type: 'success', text: 'Coupon created.' });
      }
      cancelEdit();
      load();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setBusy(false);
    }
  }

  /** Loads a coupon into the form. The date input wants YYYY-MM-DD, so the
   *  stored ISO timestamp is cut at the T rather than run back through a Date
   *  — going via local time can land the picker on the previous day. */
  function startEdit(c) {
    setEditing(c);
    setForm({
      code: c.code || '',
      type: c.type || 'percent',
      value: c.value ?? '',
      minOrder: c.minOrder ?? '',
      expiresAt: c.expiresAt ? String(c.expiresAt).slice(0, 10) : '',
      featured: !!c.featured,
      promoImage: c.promoImage || '',
      promoHeadline: c.promoHeadline || '',
      promoSubtext: c.promoSubtext || '',
      promoLink: c.promoLink || '',
      promoCta: c.promoCta || '',
    });
    setMessage(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function cancelEdit() {
    setEditing(null);
    setForm(EMPTY);
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

      <form className="admin-card" onSubmit={save}>
        <h3>{editing ? `Editing ${editing.code}` : 'New coupon'}</h3>
        {editing && (
          <p className="muted" style={{ fontSize: '0.85rem', marginTop: -6 }}>
            Changing the code stops the old one working — anyone already holding it,
            and any festival handing it out, will need the new one.
          </p>
        )}
        <div className="form-grid">
          <div className="field">
            <label htmlFor="coupon-code">Code</label>
            <input
              id="coupon-code"
              required
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
              placeholder="e.g. WELCOME10"
            />
          </div>
          <div className="field">
            <label htmlFor="coupon-type">Type</label>
            <select id="coupon-type" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              <option value="percent">Percentage off</option>
              <option value="flat">Flat amount off</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="coupon-discount-value">{form.type === 'percent' ? 'Discount %' : 'Discount ₹'}</label>
            <input
              id="coupon-discount-value"
              required
              type="number"
              min="1"
              value={form.value}
              onChange={(e) => setForm({ ...form, value: e.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor="coupon-min-order">Minimum order ₹ (optional)</label>
            <input
              id="coupon-min-order"
              type="number"
              min="0"
              value={form.minOrder}
              onChange={(e) => setForm({ ...form, minOrder: e.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor="coupon-expires-at">Expires on (optional)</label>
            <input id="coupon-expires-at" type="date" value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} />
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
            {form.expiresAt && (
              <p className="muted" style={{ fontSize: '0.8rem', gridColumn: '1 / -1', margin: 0 }}>
                Since this one's featured, the "Expires on" date above now shows as a live
                countdown in the popup and its reminder tab — not just a cutoff nobody sees
                coming.
              </p>
            )}
            <ImageUploadField
              value={form.promoImage}
              onChange={(url) => setForm({ ...form, promoImage: url })}
              label="Popup image (optional)"
              allowClear
            />
            <div className="field">
              <label htmlFor="coupon-promo-headline">Popup headline (optional)</label>
              <input
                id="coupon-promo-headline"
                value={form.promoHeadline}
                onChange={(e) => setForm({ ...form, promoHeadline: e.target.value })}
                placeholder="e.g. Today Only!"
              />
            </div>
            <div className="field">
              <label htmlFor="coupon-promo-subtext">Popup sub-text (optional)</label>
              <input
                id="coupon-promo-subtext"
                value={form.promoSubtext}
                onChange={(e) => setForm({ ...form, promoSubtext: e.target.value })}
                placeholder="e.g. Don't miss out — this deal ends soon!"
              />
            </div>
            <div className="field">
              <label htmlFor="coupon-promo-link">Button goes to (optional)</label>
              <input
                id="coupon-promo-link"
                value={form.promoLink}
                onChange={(e) => setForm({ ...form, promoLink: e.target.value })}
                placeholder="e.g. /onam"
              />
              <p className="muted" style={{ fontSize: '0.8rem', marginTop: 4 }}>
                A page on this site — <b>/onam</b> for the pookalam, or /shop, /gifting.
                Pasting the full address works too. <b>Leave this blank and no button
                appears</b>, however you fill in the label below.
              </p>
            </div>
            <div className="field">
              <label htmlFor="coupon-promo-cta">Button says (optional)</label>
              <input
                id="coupon-promo-cta"
                value={form.promoCta}
                onChange={(e) => setForm({ ...form, promoCta: e.target.value })}
                placeholder="e.g. Lay a pookalam"
                maxLength={40}
              />
            </div>
          </div>
        )}

        <div className="flex gap-1" style={{ alignItems: 'center' }}>
          <button className="btn btn-gold btn-sm" disabled={busy}>
            {busy ? 'Saving…' : editing ? 'Save changes' : '+ Add coupon'}
          </button>
          {editing && (
            <button type="button" className="btn btn-outline btn-sm" onClick={cancelEdit} disabled={busy}>
              Cancel
            </button>
          )}
        </div>
      </form>

      <p className="muted" style={{ fontSize: '0.85rem' }}>
        Only one featured coupon appears in the homepage popup. If several are marked, the
        site uses the first one that is still enabled and in date — that one shows as
        <b> Showing now</b> below, and any other featured coupon shows as <b>Not shown</b>.
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
                  <span className={`pill status-${!c.active || isExpired(c) ? 'cancelled' : 'placed'}`}>
                    {!c.active ? 'Disabled' : isExpired(c) ? 'Expired' : 'Active'}
                  </span>
                </td>
                <td>
                  {!c.featured ? (
                    <span className="muted">—</span>
                  ) : c.id === liveFeaturedId ? (
                    <span className="pill status-placed">Showing now</span>
                  ) : (
                    <span className="pill status-cancelled" title="Marked featured, but not the one on the site">
                      Not shown
                    </span>
                  )}
                </td>
                <td>
                  <button className="link-btn" onClick={() => startEdit(c)}>edit</button>{' '}
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
