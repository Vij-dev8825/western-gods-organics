import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { getProductImage } from '../../utils/productImages';
import { useSeller } from './SellerLayout';

export default function SellerProfile() {
  const { token, user } = useAuth();
  const { showToast } = useToast();
  const { me, reloadMe } = useSeller();
  const [form, setForm] = useState({
    businessName: me.businessName || '',
    bio: me.bio || '',
    location: me.location || '',
    logo: me.logo || '',
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  async function handleLogoUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    setUploading(true);
    try {
      const res = await api.seller.uploadImage(token, fd);
      setForm((f) => ({ ...f, logo: res.url }));
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setUploading(false);
    }
  }

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.seller.updateProfile(token, form);
      showToast('Profile updated.');
      reloadMe();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="admin-head">
        <h1>Storefront Profile</h1>
        <Link to={`/sellers/${user?.id}`} className="btn btn-outline btn-sm">View my public page →</Link>
      </div>
      <p className="muted" style={{ marginTop: -10, marginBottom: 20 }}>
        This is what shoppers see on your seller page and next to your products.
      </p>

      <form className="admin-card" onSubmit={save}>
        <div className="form-grid">
          <div className="field">
            <label>Business name</label>
            <input
              value={form.businessName}
              onChange={(e) => setForm((f) => ({ ...f, businessName: e.target.value }))}
              required
            />
          </div>
          <div className="field">
            <label>Where you're based</label>
            <input
              value={form.location}
              onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
              placeholder="e.g. Coimbatore, Tamil Nadu"
            />
          </div>
        </div>

        <div className="field">
          <label>Your story</label>
          <textarea
            rows={4}
            value={form.bio}
            onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
            placeholder="Tell shoppers who you are and how you make what you sell."
          />
        </div>

        <div className="field">
          <label>Logo or photo</label>
          {form.logo && (
            <img
              src={getProductImage(form.logo)}
              alt=""
              style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: '50%', marginBottom: 8, display: 'block' }}
            />
          )}
          <input type="file" accept="image/*" onChange={handleLogoUpload} disabled={uploading} />
          {uploading && <span className="muted" style={{ fontSize: '0.8rem' }}>Uploading…</span>}
        </div>

        <button className="btn btn-gold btn-sm" disabled={saving}>{saving ? 'Saving…' : 'Save profile'}</button>
      </form>

      <div className="admin-card">
        <h3 style={{ marginTop: 0 }}>Your selling terms</h3>
        <p className="muted" style={{ marginBottom: 0 }}>
          Platform fee: <b>{me.platformFeeRate}%</b> — you keep {100 - me.platformFeeRate}% of each sale.
          {me.probationRemaining > 0
            ? ` Your next ${me.probationRemaining} listing(s) are reviewed before going live.`
            : ' Your listings go live instantly.'}
          {' '}These are set by the store team — message us if you'd like to discuss them.
        </p>
      </div>
    </>
  );
}
