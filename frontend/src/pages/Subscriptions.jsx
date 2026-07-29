import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { loadRazorpay } from '../utils/loadRazorpay';
import ChakkiWheel from '../components/ChakkiWheel';

const FREQUENCY_LABELS = { 14: 'Every 2 weeks', 28: 'Every 4 weeks', 42: 'Every 6 weeks' };
function formatFrequency(days) {
  return FREQUENCY_LABELS[days] || `Every ${days} days`;
}

export default function Subscriptions() {
  const { token } = useAuth();
  const { showToast } = useToast();
  const [subscriptions, setSubscriptions] = useState(null);
  const [busyId, setBusyId] = useState(null);

  function load() {
    api.getSubscriptions(token).then((d) => setSubscriptions(d.subscriptions)).catch(() => setSubscriptions([]));
  }
  useEffect(load, [token]);

  async function setStatus(sub, status) {
    setBusyId(sub.id);
    try {
      await api.updateSubscription(token, sub.id, { status });
      showToast(status === 'cancelled' ? 'Subscription cancelled.' : status === 'paused' ? 'Subscription paused.' : 'Subscription resumed.');
      load();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setBusyId(null);
    }
  }

  async function enableAutopay(sub) {
    setBusyId(sub.id);
    try {
      const setup = await api.createSubscriptionAutopay(token, sub.id);
      await loadRazorpay();
      await new Promise((resolve, reject) => {
        const rzp = new window.Razorpay({
          key: setup.keyId,
          subscription_id: setup.razorpaySubscriptionId,
          name: 'Western Gods Organics',
          description: `${sub.productName} (${sub.size}) — auto-pay every delivery`,
          theme: { color: '#6fae4f' },
          modal: { ondismiss: () => reject(new Error('Autopay setup cancelled.')) },
          handler: async (response) => {
            try {
              await api.verifySubscriptionAutopay(token, sub.id, response);
              showToast('UPI Autopay enabled — future deliveries are charged automatically.');
              resolve();
            } catch (err) {
              reject(err);
            }
          },
        });
        rzp.on('payment.failed', () => reject(new Error('Mandate setup failed. Please try again.')));
        rzp.open();
      });
      load();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setBusyId(null);
    }
  }

  if (!subscriptions) {
    return (
      <div className="center" style={{ padding: '120px 0' }}>
        <ChakkiWheel size={56} />
      </div>
    );
  }

  return (
    <div className="container section">
      <div className="breadcrumb">Home / My Subscriptions</div>
      <h2>My Subscriptions</h2>
      <p className="muted" style={{ marginBottom: 24 }}>
        Manage your auto-delivery subscriptions — pause, resume or cancel anytime.
      </p>

      {subscriptions.length === 0 ? (
        <div className="empty-state">
          <ChakkiWheel size={56} spin={false} />
          <h3>No subscriptions yet</h3>
          <p className="muted">Subscribe to a product from its detail page to save on every delivery.</p>
          <Link to="/shop" className="btn btn-gold">Browse the shop</Link>
        </div>
      ) : (
        <div className="orders-list">
          {subscriptions.map((s) => (
            <div className="order-card" key={s.id}>
              <div className="order-card-head">
                <div>
                  <b>{s.productName}</b>
                  <span className="muted" style={{ display: 'block', fontSize: '0.85rem' }}>
                    Size: {s.size} · Qty: {s.quantity} · {formatFrequency(s.frequencyDays)}
                  </span>
                </div>
                <span className={`pill status-${s.status === 'active' ? 'placed' : s.status === 'paused' ? 'processing' : 'cancelled'}`}>
                  {s.status}
                </span>
              </div>
              <p className="muted" style={{ fontSize: '0.85rem', margin: '8px 0' }}>
                {s.status === 'active'
                  ? `Next delivery: ${new Date(s.nextOrderDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} · ${s.discountPercent}% off every order`
                  : `${s.discountPercent}% off every order when active`}
                {s.autopayEnabled && ' · 🔁 UPI Autopay on — charged automatically each delivery'}
              </p>
              <div className="order-card-actions">
                {s.status === 'active' && (
                  <button className="btn btn-outline btn-sm" disabled={busyId === s.id} onClick={() => setStatus(s, 'paused')}>
                    Pause
                  </button>
                )}
                {s.status === 'paused' && (
                  <button className="btn btn-forest btn-sm" disabled={busyId === s.id} onClick={() => setStatus(s, 'active')}>
                    Resume
                  </button>
                )}
                {s.status === 'active' && !s.autopayEnabled && (
                  <button className="btn btn-gold btn-sm" disabled={busyId === s.id} onClick={() => enableAutopay(s)}>
                    {busyId === s.id ? 'Opening…' : '🔁 Enable UPI Autopay'}
                  </button>
                )}
                {s.status !== 'cancelled' && (
                  <button className="btn btn-outline btn-sm" disabled={busyId === s.id} onClick={() => setStatus(s, 'cancelled')}>
                    Cancel
                  </button>
                )}
                {s.lastOrderId && (
                  <Link to={`/invoice/${s.lastOrderId}`} className="link-btn">View last order</Link>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
