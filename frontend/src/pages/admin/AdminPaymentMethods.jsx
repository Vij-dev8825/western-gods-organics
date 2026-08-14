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
  const [prepaidDraft, setPrepaidDraft] = useState('');
  const [gatewayDraft, setGatewayDraft] = useState('');

  function load() {
    api.admin.getPaymentMethods(token).then((d) => {
      setMethods(d.paymentMethods);
      setPrepaidDraft(String(d.paymentMethods.prepaidDiscountPercent ?? 0));
      setGatewayDraft(String(d.paymentMethods.gatewayFeePercent ?? 0));
    }).catch(() => {});
  }
  useEffect(load, [token]);

  async function save(next) {
    const previous = methods;
    setMethods(next);
    setSaving(true);
    try {
      const d = await api.admin.updatePaymentMethods(token, next);
      // Re-sync from the server's clamped value rather than the draft, so a
      // rate it capped is visible immediately instead of silently disagreeing.
      setMethods(d.paymentMethods);
      setPrepaidDraft(String(d.paymentMethods.prepaidDiscountPercent ?? 0));
      setGatewayDraft(String(d.paymentMethods.gatewayFeePercent ?? 0));
      showToast('Payment methods updated.');
    } catch (err) {
      showToast(err.message, 'error');
      setMethods(previous); // revert on failure
    } finally {
      setSaving(false);
    }
  }

  const toggle = (key, value) => save({ ...methods, [key]: value });

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

      {methods && (
        <div className="form-card" style={{ maxWidth: 480, marginTop: 20 }}>
          <h4 style={{ marginTop: 0 }}>Prepaid discount</h4>
          <p className="muted" style={{ fontSize: '0.85rem' }}>
            A percentage off for customers who pay the full amount online, shown in the cart as a
            reason to choose Pay Online over Cash on Delivery. Every COD order you avoid is one that
            can't come back undelivered. Set to 0 to turn this off. Partial-advance COD doesn't get
            it — most of that total is still collected at the door.
          </p>
          <div className="flex gap-1" style={{ alignItems: 'center' }}>
            <input
              type="number"
              min={0}
              max={50}
              step={0.5}
              value={prepaidDraft}
              disabled={saving}
              onChange={(e) => setPrepaidDraft(e.target.value)}
              style={{ width: 100 }}
            />
            <span className="muted">% off online payments</span>
            <button
              type="button"
              className="btn btn-gold btn-sm"
              disabled={saving || prepaidDraft === String(methods.prepaidDiscountPercent ?? 0)}
              onClick={() => save({ ...methods, prepaidDiscountPercent: Number(prepaidDraft) || 0 })}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      )}

      {methods && (
        <div className="form-card" style={{ maxWidth: 480, marginTop: 20 }}>
          <h4 style={{ marginTop: 0 }}>What the payment gateway keeps</h4>
          <p className="muted" style={{ fontSize: '0.85rem' }}>
            Razorpay's cut of an online payment, from your own Razorpay pricing page. It changes nothing
            a customer sees or pays — it is used only by <b>Admin → Profit</b>, to subtract the fee from
            what you actually kept. Cash on Delivery is never charged it. Leave it at 0 and the profit
            report simply won't deduct anything, which is better than deducting a guess.
          </p>
          <div className="flex gap-1" style={{ alignItems: 'center' }}>
            <input
              type="number"
              min={0}
              max={20}
              step={0.01}
              value={gatewayDraft}
              disabled={saving}
              onChange={(e) => setGatewayDraft(e.target.value)}
              style={{ width: 100 }}
            />
            <span className="muted">% of each online payment</span>
            <button
              type="button"
              className="btn btn-gold btn-sm"
              disabled={saving || gatewayDraft === String(methods.gatewayFeePercent ?? 0)}
              onClick={() => save({ ...methods, gatewayFeePercent: Number(gatewayDraft) || 0 })}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
