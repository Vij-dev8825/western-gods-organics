import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import ChakkiWheel from '../components/ChakkiWheel';
import SeoMeta from '../components/SeoMeta';

/** Public-facing "become a seller" page. Once an application is approved the
 * seller works entirely inside the separate portal at /seller (see
 * pages/seller/SellerLayout.jsx) — this page just hands them over to it. */
export default function Seller() {
  const { token, user } = useAuth();
  const { showToast } = useToast();
  const [me, setMe] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [form, setForm] = useState({ businessName: '', phone: user?.phone || '', whatTheySell: '' });
  const [applying, setApplying] = useState(false);

  function loadMe() {
    api.seller.getMe(token).then(setMe).catch(() => setMe({ status: 'none' })).finally(() => setLoaded(true));
  }
  useEffect(loadMe, [token]);

  async function submitApplication(e) {
    e.preventDefault();
    setApplying(true);
    try {
      await api.seller.apply(token, form);
      showToast("Application submitted! We'll review it shortly.");
      loadMe();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setApplying(false);
    }
  }

  if (!loaded) {
    return (
      <div className="center" style={{ padding: '120px 0' }}>
        <ChakkiWheel size={56} />
      </div>
    );
  }

  if (me.status === 'approved') return <Navigate to="/seller" replace />;

  if (me.status === 'pending') {
    return (
      <div className="container section">
        <SeoMeta title="Sell With Us | Western Gods Organics" path="/sell-with-us" />
        <div className="breadcrumb">Home / Sell With Us</div>
        <h2>Sell With Us</h2>
        <div className="empty-state">
          <ChakkiWheel size={56} spin={false} />
          <h3>Application under review</h3>
          <p className="muted">
            Thanks for applying, {me.businessName}! We typically review new seller applications within a few
            business days — we'll email you as soon as there's news.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container section">
      <SeoMeta
        title="Sell With Us | Western Gods Organics"
        description="Apply to sell your own cold-pressed oils, handmade soaps or herbal products alongside ours. Approved sellers keep the majority of every sale."
        path="/sell-with-us"
      />
      <div className="breadcrumb">Home / Sell With Us</div>
      <h2>Sell With Us</h2>
      <p className="muted" style={{ marginBottom: 24, maxWidth: 640 }}>
        List your own oils, soaps or herbal products alongside ours — approved sellers get their own seller
        portal, their own storefront page, and keep the majority of every sale, paid out directly.
      </p>

      {me.status === 'rejected' && (
        <div className="alert alert-error" style={{ marginBottom: 20 }}>
          Your last application wasn't approved{me.reviewNote ? `: ${me.reviewNote}` : '.'} Feel free to apply
          again below.
        </div>
      )}

      <form className="form-card" onSubmit={submitApplication} style={{ maxWidth: 480 }}>
        <div className="field">
          <label>Business name</label>
          <input
            value={form.businessName}
            onChange={(e) => setForm((f) => ({ ...f, businessName: e.target.value }))}
            required
          />
        </div>
        <div className="field">
          <label>Contact phone</label>
          <input
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            placeholder={user?.phone}
          />
        </div>
        <div className="field">
          <label>What will you sell?</label>
          <textarea
            rows={3}
            value={form.whatTheySell}
            onChange={(e) => setForm((f) => ({ ...f, whatTheySell: e.target.value }))}
            placeholder="e.g. Handmade cold-pressed mustard oil from our family farm…"
            required
          />
        </div>
        <button className="btn btn-gold" disabled={applying}>{applying ? 'Submitting…' : 'Apply to sell'}</button>
      </form>
    </div>
  );
}
