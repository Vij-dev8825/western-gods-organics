import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { api } from '../api';
import { useNavigate, Link } from 'react-router-dom';
import { IconBox } from '../components/Icons';
import { isValidEmail } from '../utils/validators';
import ChakkiWheel from '../components/ChakkiWheel';
import { CANONICAL_ORIGIN } from '../utils/site';

export default function Profile() {
  const { user, token, logout, updateUser } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setEmail(user.email || '');
    }
  }, [user]);

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
