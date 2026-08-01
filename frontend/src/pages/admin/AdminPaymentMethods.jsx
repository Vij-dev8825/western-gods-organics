import { useEffect, useState } from 'react';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

const METHODS = [
  { key: 'cod', label: 'Cash on Delivery', description: 'Pay in cash when the order arrives.' },
  { key: 'razorpay', label: 'Pay Online', description: 'Cards, UPI, NetBanking & wallets, via Razorpay.' },
  { key: 'codAdvance', label: 'Partial-advance COD', description: '"Pay ₹49 now, rest on delivery" — requires Pay Online to also be on.' },
];

export default function AdminPaymentMethods() {
  const { token } = useAuth();
  const { showToast } = useToast();
  const [methods, setMethods] = useState(null);
  const [saving, setSaving] = useState(false);

  function load() {
    api.admin.getPaymentMethods(token).then((d) => setMethods(d.paymentMethods)).catch(() => {});
  }
  useEffect(load, [token]);

  async function toggle(key, value) {
    const next = { ...methods, [key]: value };
    setMethods(next);
    setSaving(true);
    try {
      await api.admin.updatePaymentMethods(token, next);
      showToast('Payment methods updated.');
    } catch (err) {
      showToast(err.message, 'error');
      setMethods(methods); // revert on failure
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="section-head">
        <div>
          <span className="eyebrow">Checkout</span>
          <h2>Payment Methods</h2>
        </div>
      </div>

      <div className="form-card" style={{ maxWidth: 480 }}>
        <p className="muted" style={{ marginTop: 0 }}>
          Turn checkout payment options on or off for customers. Cash on Delivery and Pay Online also depend
          on their own setup (COD needs no configuration; Pay Online needs Razorpay keys) — this only
          controls whether an already-working method is offered.
        </p>

        {!methods ? (
          <p className="muted">Loading…</p>
        ) : (
          METHODS.map((m) => (
            <label key={m.key} className="flex" style={{ alignItems: 'flex-start', gap: 10, margin: '14px 0' }}>
              <input
                type="checkbox"
                checked={!!methods[m.key]}
                disabled={saving}
                onChange={(e) => toggle(m.key, e.target.checked)}
                style={{ marginTop: 3 }}
              />
              <span>
                <b>{m.label}</b>
                <span className="muted" style={{ display: 'block', fontSize: '0.85rem' }}>{m.description}</span>
              </span>
            </label>
          ))
        )}
      </div>
    </div>
  );
}
