import { useState } from 'react';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { getProductImage } from '../../utils/productImages';
import { useSeller } from './SellerLayout';

const FIELDS = [
  'bio', 'location', 'website', 'instagram',
  'contactEmail', 'contactPhone', 'address', 'gstin', 'fssai',
  'upiId', 'bankAccountName', 'bankAccountNumber', 'bankIfsc',
];

export default function SellerProfile() {
  const { token, user } = useAuth();
  const { showToast } = useToast();
  const { me, reloadMe } = useSeller();
  const [form, setForm] = useState(() => {
    const init = { businessName: me.businessName || '', logo: me.logo || '' };
    FIELDS.forEach((f) => { init[f] = me[f] || ''; });
    return init;
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

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
      showToast('Profile saved.');
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
      </div>

      <form onSubmit={save}>
        <div className="admin-card">
          <h3 style={{ marginTop: 0 }}>Public storefront</h3>
          <p className="muted" style={{ fontSize: '0.83rem', marginTop: 0 }}>
            This is what shoppers see on your seller page and next to your products.
          </p>

          <div className="form-grid">
            <div className="field">
              <label>Business name</label>
              <input value={form.businessName} onChange={set('businessName')} required />
            </div>
            <div className="field">
              <label>Where you're based</label>
              <input value={form.location} onChange={set('location')} placeholder="e.g. Coimbatore, Tamil Nadu" />
            </div>
          </div>

          <div className="field">
            <label>Your story</label>
            <textarea
              rows={4}
              value={form.bio}
              onChange={set('bio')}
              placeholder="Tell shoppers who you are and how you make what you sell."
            />
          </div>

          <div className="form-grid">
            <div className="field">
              <label>Website (optional)</label>
              <input value={form.website} onChange={set('website')} placeholder="https://…" />
            </div>
            <div className="field">
              <label>Instagram (optional)</label>
              <input value={form.instagram} onChange={set('instagram')} placeholder="@yourhandle" />
            </div>
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
        </div>

        <div className="admin-card">
          <h3 style={{ marginTop: 0 }}>Business &amp; contact details</h3>
          <p className="muted" style={{ fontSize: '0.83rem', marginTop: 0 }}>
            Private — only you and the Western Gods Organics team can see this. Shoppers never do.
          </p>

          <div className="form-grid">
            <div className="field">
              <label>Contact email</label>
              <input type="email" value={form.contactEmail} onChange={set('contactEmail')} placeholder="you@example.com" />
            </div>
            <div className="field">
              <label>Contact phone</label>
              <input value={form.contactPhone} onChange={set('contactPhone')} placeholder={user?.phone} />
            </div>
          </div>

          <div className="field">
            <label>Business address</label>
            <textarea rows={3} value={form.address} onChange={set('address')} placeholder="Where you make or dispatch from." />
          </div>

          <div className="form-grid">
            <div className="field">
              <label>GSTIN (if registered)</label>
              <input value={form.gstin} onChange={set('gstin')} placeholder="22AAAAA0000A1Z5" />
            </div>
            <div className="field">
              <label>FSSAI licence (for edible products)</label>
              <input value={form.fssai} onChange={set('fssai')} placeholder="12345678901234" />
            </div>
          </div>
        </div>

        <div className="admin-card">
          <h3 style={{ marginTop: 0 }}>Where we send your payouts</h3>
          <p className="muted" style={{ fontSize: '0.83rem', marginTop: 0 }}>
            We pay your balance out by UPI or bank transfer. Fill in whichever you prefer — UPI alone is
            enough. Private to you and our team.
          </p>

          <div className="field">
            <label>UPI ID</label>
            <input value={form.upiId} onChange={set('upiId')} placeholder="yourname@upi" />
          </div>

          <div className="form-grid">
            <div className="field">
              <label>Bank account name</label>
              <input value={form.bankAccountName} onChange={set('bankAccountName')} />
            </div>
            <div className="field">
              <label>Account number</label>
              <input value={form.bankAccountNumber} onChange={set('bankAccountNumber')} />
            </div>
          </div>
          <div className="field" style={{ maxWidth: 260 }}>
            <label>IFSC code</label>
            <input value={form.bankIfsc} onChange={set('bankIfsc')} placeholder="HDFC0001234" />
          </div>
        </div>

        <div className="admin-card">
          <h3 style={{ marginTop: 0 }}>Your selling terms</h3>
          <p className="muted" style={{ marginBottom: 0 }}>
            {me.sellerMode === 'marketplace'
              ? 'You sell directly to the customer — the bill is in your name, so your own FSSAI registration applies. '
              : 'We buy from you and sell it on our shop under our own food licence, so you need no licence of your own. '}
            You get <b>{100 - me.platformFeeRate}%</b> of what each item sells for.
            {me.probationRemaining > 0
              ? ` Your next ${me.probationRemaining} listing(s) are reviewed before going live.`
              : ' Your listings go live instantly.'}
            {' '}These are set by the store team — message us if you'd like to discuss them.
          </p>
        </div>

        <button className="btn btn-gold" disabled={saving}>{saving ? 'Saving…' : 'Save profile'}</button>
      </form>
    </>
  );
}
