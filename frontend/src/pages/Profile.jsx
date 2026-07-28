import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useCurrency } from '../context/CurrencyContext';
import { api } from '../api';
import { useNavigate, Link } from 'react-router-dom';
import { IconBox } from '../components/Icons';
import { isValidEmail, validateAddress } from '../utils/validators';
import { normalizeAddresses } from '../utils/addresses';
import ChakkiWheel from '../components/ChakkiWheel';
import AddressForm from '../components/AddressForm';
import { CANONICAL_ORIGIN } from '../utils/site';

export default function Profile() {
  const { user, token, logout, updateUser } = useAuth();
  const { showToast } = useToast();
  const { country } = useCurrency();
  const navigate = useNavigate();

  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const [addresses, setAddresses] = useState(() => normalizeAddresses(user?.addresses));
  const [editingAddrId, setEditingAddrId] = useState(null); // null | 'new' | address id
  const [addrDraft, setAddrDraft] = useState(null);
  const [addrErrors, setAddrErrors] = useState({});
  const [savingAddr, setSavingAddr] = useState(false);

  const [pointsBalance, setPointsBalance] = useState(null);
  useEffect(() => {
    api.getLoyalty(token).then((d) => setPointsBalance(d.balance)).catch(() => setPointsBalance(0));
  }, [token]);

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setEmail(user.email || '');
    }
  }, [user]);

  // Backfills id/isDefault for addresses saved before multi-address support
  // existed, then persists the backfilled version once so it stabilizes.
  useEffect(() => {
    if (!user?.addresses?.length) return;
    const normalized = normalizeAddresses(user.addresses);
    setAddresses(normalized);
    if (normalized !== user.addresses) {
      api.updateProfile(token, { addresses: normalized }).then((d) => updateUser(d.user)).catch(() => {});
    }
  }, [user]);

  function startAddAddress() {
    setEditingAddrId('new');
    setAddrDraft({ line1: '', city: '', state: '', pincode: '', phone: '', country: country.code, label: '' });
    setAddrErrors({});
  }

  function startEditAddress(a) {
    setEditingAddrId(a.id);
    setAddrDraft({ ...a });
    setAddrErrors({});
  }

  function cancelAddressEdit() {
    setEditingAddrId(null);
    setAddrDraft(null);
    setAddrErrors({});
  }

  function updateAddrDraft(field, value) {
    setAddrDraft((d) => ({ ...d, [field]: value }));
    setAddrErrors((errs) => (errs[field] ? { ...errs, [field]: undefined } : errs));
  }

  async function saveAddress(e) {
    e.preventDefault();
    const errs = validateAddress(addrDraft);
    setAddrErrors(errs);
    if (Object.keys(errs).length) return;

    setSavingAddr(true);
    const next = editingAddrId === 'new'
      ? [...addresses, { ...addrDraft, id: crypto.randomUUID(), isDefault: addresses.length === 0 }]
      : addresses.map((a) => (a.id === editingAddrId ? { ...addrDraft, id: editingAddrId } : a));
    try {
      const data = await api.updateProfile(token, { addresses: next });
      updateUser(data.user);
      setAddresses(data.user.addresses);
      showToast('Address saved.');
      cancelAddressEdit();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSavingAddr(false);
    }
  }

  async function deleteAddress(id) {
    if (!window.confirm('Remove this address?')) return;
    let next = addresses.filter((a) => a.id !== id);
    if (next.length && !next.some((a) => a.isDefault)) {
      next = next.map((a, i) => (i === 0 ? { ...a, isDefault: true } : a));
    }
    try {
      const data = await api.updateProfile(token, { addresses: next });
      updateUser(data.user);
      setAddresses(data.user.addresses);
      showToast('Address removed.');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function setDefaultAddress(id) {
    const next = addresses.map((a) => ({ ...a, isDefault: a.id === id }));
    try {
      const data = await api.updateProfile(token, { addresses: next });
      updateUser(data.user);
      setAddresses(data.user.addresses);
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function handleSave(e) {
    e.preventDefault();
    const fieldErrors = {};
    if (!name || name.trim().length < 2) fieldErrors.name = 'Enter your name.';
    if (email && !isValidEmail(email)) fieldErrors.email = 'Enter a valid email address, or leave it blank.';
    setErrors(fieldErrors);
    if (Object.keys(fieldErrors).length) return;

    setSaving(true);
    try {
      const data = await api.updateProfile(token, { name, email });
      updateUser(data.user);
      showToast('Profile updated.');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  function handleLogout() {
    logout();
    navigate('/');
  }

  const referralLink = user?.referralCode ? `${CANONICAL_ORIGIN}/login?ref=${user.referralCode}` : '';

  async function handleCopyReferralLink() {
    try {
      await navigator.clipboard.writeText(referralLink);
      showToast('Referral link copied!');
    } catch {
      showToast('Could not copy automatically — please copy the link manually.', 'error');
    }
  }

  if (!user) {
    return (
      <div className="center" style={{ padding: '120px 0' }}>
        <ChakkiWheel size={56} />
      </div>
    );
  }

  return (
    <div className="container section">
      <div className="breadcrumb">Home / My Account</div>
      <div className="section-head">
        <div>
          <span className="eyebrow">My Account</span>
          <h2>Hi{user.name ? `, ${user.name}` : ''} 👋</h2>
        </div>
        <button className="btn btn-outline btn-sm" onClick={handleLogout}>Log out</button>
      </div>

      <Link to="/orders" className="profile-orders-link">
        <span className="profile-orders-link-icon"><IconBox size={22} /></span>
        <span>
          <b>My Orders</b>
          <span className="muted" style={{ display: 'block', fontSize: '0.82rem' }}>
            Track, re-order, or download invoices for past purchases
          </span>
        </span>
        <span className="profile-orders-link-arrow">→</span>
      </Link>

      <Link to="/subscriptions" className="profile-orders-link">
        <span className="profile-orders-link-icon" aria-hidden="true">🔁</span>
        <span>
          <b>My Subscriptions</b>
          <span className="muted" style={{ display: 'block', fontSize: '0.82rem' }}>
            Manage auto-delivery — pause, resume, or cancel anytime
          </span>
        </span>
        <span className="profile-orders-link-arrow">→</span>
      </Link>

      <Link to="/rewards" className="profile-orders-link">
        <span className="profile-orders-link-icon" aria-hidden="true">⭐</span>
        <span>
          <b>My Rewards</b>
          <span className="muted" style={{ display: 'block', fontSize: '0.82rem' }}>
            {pointsBalance === null ? 'Loading…' : `${pointsBalance} points available — worth ₹${pointsBalance}`}
          </span>
        </span>
        <span className="profile-orders-link-arrow">→</span>
      </Link>

      {referralLink && (
        <div className="form-card" style={{ margin: '0 0 22px' }}>
          <h3 style={{ marginTop: 0 }}>🎁 Refer a friend, earn ₹100</h3>
          <p className="muted" style={{ marginBottom: 14 }}>
            Share your link — when a friend signs up and places their first order, you both get ₹100 off.
          </p>
          <div className="field" style={{ display: 'flex', gap: 8 }}>
            <input readOnly value={referralLink} onFocus={(e) => e.target.select()} style={{ flex: 1 }} />
            <button type="button" className="btn btn-outline btn-sm" onClick={handleCopyReferralLink}>
              Copy
            </button>
          </div>
        </div>
      )}

      <div className="form-card" style={{ margin: '0 0 22px' }}>
        <div className="flex-between" style={{ marginBottom: addresses.length || editingAddrId ? 14 : 0 }}>
          <h3 style={{ margin: 0 }}>Address Book</h3>
          {editingAddrId === null && (
            <button type="button" className="btn btn-outline btn-sm" onClick={startAddAddress}>
              + Add address
            </button>
          )}
        </div>

        {addresses.map((a) => (
          editingAddrId === a.id ? (
            <form key={a.id} onSubmit={saveAddress} style={{ marginBottom: 18 }} noValidate>
              <AddressForm address={addrDraft} onChange={updateAddrDraft} errors={addrErrors} showLabel />
              <div className="flex gap-1">
                <button className="btn btn-forest btn-sm" disabled={savingAddr}>
                  {savingAddr ? 'Saving…' : 'Save'}
                </button>
                <button type="button" className="btn btn-outline btn-sm" onClick={cancelAddressEdit}>Cancel</button>
              </div>
            </form>
          ) : (
            <div key={a.id} className="address-card">
              <b>{a.label || 'Address'}</b>{a.isDefault && <span className="muted"> · Default</span>}
              <div className="muted" style={{ fontSize: '0.85rem', marginTop: 2 }}>
                {a.line1}, {a.city}, {a.state} – {a.pincode}<br />
                {a.phone}
              </div>
              <div className="address-card-actions">
                {!a.isDefault && (
                  <button type="button" className="link-btn" onClick={() => setDefaultAddress(a.id)}>Set as default</button>
                )}
                <button type="button" className="link-btn" onClick={() => startEditAddress(a)}>Edit</button>
                <button type="button" className="link-btn" onClick={() => deleteAddress(a.id)}>Delete</button>
              </div>
            </div>
          )
        ))}

        {editingAddrId === 'new' && (
          <form onSubmit={saveAddress} noValidate>
            <AddressForm address={addrDraft} onChange={updateAddrDraft} errors={addrErrors} showLabel />
            <div className="flex gap-1">
              <button className="btn btn-forest btn-sm" disabled={savingAddr}>
                {savingAddr ? 'Saving…' : 'Save address'}
              </button>
              <button type="button" className="btn btn-outline btn-sm" onClick={cancelAddressEdit}>Cancel</button>
            </div>
          </form>
        )}

        {!addresses.length && editingAddrId === null && (
          <p className="muted" style={{ margin: 0 }}>No saved addresses yet.</p>
        )}
      </div>

      <form className="form-card" style={{ margin: 0 }} onSubmit={handleSave} noValidate>
        <div className="field">
          <label>Mobile number</label>
          <input value={user.phone} disabled />
        </div>
        <div className="field">
          <label>Full name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
          {errors.name && <div className="field-error">{errors.name}</div>}
        </div>
        <div className="field">
          <label>Email (optional)</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          {errors.email && <div className="field-error">{errors.email}</div>}
        </div>
        <button className="btn btn-gold btn-block" disabled={saving}>
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </form>
    </div>
  );
}
