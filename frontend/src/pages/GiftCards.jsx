import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { loadRazorpay } from '../utils/loadRazorpay';
import { isValidEmail } from '../utils/validators';
import ChakkiWheel from '../components/ChakkiWheel';
import SeoMeta from '../components/SeoMeta';

export default function GiftCards() {
  const { token, user } = useAuth();
  const { showToast } = useToast();
  const [config, setConfig] = useState(null);
  const [amount, setAmount] = useState(null); // a denomination number, or 'custom'
  const [customAmount, setCustomAmount] = useState('');
  const [forSelf, setForSelf] = useState(false);
  const [recipientName, setRecipientName] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [purchased, setPurchased] = useState(null);

  useEffect(() => {
    api.getGiftCardConfig().then(setConfig).catch(() => {});
  }, []);

  const effectiveAmount = amount === 'custom' ? Number(customAmount) || 0 : Number(amount) || 0;
  const minAmount = config?.minAmount ?? 200;
  const maxAmount = config?.maxAmount ?? 10000;
  const validAmount = effectiveAmount >= minAmount && effectiveAmount <= maxAmount;

  function resetForm() {
    setPurchased(null);
    setAmount(null);
    setCustomAmount('');
    setForSelf(false);
    setRecipientName('');
    setRecipientEmail('');
    setRecipientPhone('');
    setMessage('');
    setError('');
  }

  async function handleBuy(e) {
    e.preventDefault();
    setError('');
    if (!validAmount) {
      setError(`Choose an amount between ₹${minAmount} and ₹${maxAmount}.`);
      return;
    }
    if (!forSelf && recipientEmail && !isValidEmail(recipientEmail)) {
      setError('Enter a valid recipient email, or leave it blank.');
      return;
    }
    setBusy(true);
    try {
      const rzpOrder = await api.createGiftCardPurchase(token, { amount: effectiveAmount });
      await loadRazorpay();
      await new Promise((resolve, reject) => {
        const rzp = new window.Razorpay({
          key: rzpOrder.keyId,
          amount: rzpOrder.amount,
          currency: rzpOrder.currency,
          order_id: rzpOrder.razorpayOrderId,
          name: 'Western Gods Organics',
          description: `Gift card · ₹${effectiveAmount}`,
          prefill: { name: user?.name || '', contact: user?.phone || '' },
          theme: { color: '#6fae4f' },
          modal: { ondismiss: () => reject(new Error('Payment cancelled.')) },
          handler: async (response) => {
            try {
              const data = await api.verifyGiftCardPurchase(token, {
                amount: effectiveAmount,
                recipientName: forSelf ? '' : recipientName.trim(),
                recipientEmail: forSelf ? '' : recipientEmail.trim(),
                recipientPhone: forSelf ? '' : recipientPhone.trim(),
                message: message.trim(),
                ...response,
              });
              setPurchased(data.giftCard);
              showToast('Gift card purchased!');
              resolve();
            } catch (err) {
              setError(err.message);
              reject(err);
            }
          },
        });
        rzp.on('payment.failed', () => reject(new Error('Payment failed. Please try again.')));
        rzp.open();
      });
    } catch (err) {
      if (err.message !== 'Payment cancelled.') setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (!config) {
    return (
      <div className="center" style={{ padding: '120px 0' }}>
        <ChakkiWheel size={56} />
      </div>
    );
  }

  if (purchased) {
    const sentTo = purchased.recipientEmail || purchased.recipientPhone;
    return (
      <div className="container section">
        <div className="breadcrumb">Home / Gift Cards</div>
        <div className="empty-state">
          <span style={{ fontSize: '2.5rem' }}>🎁</span>
          <h2>Gift card purchased!</h2>
          <p className="muted">
            {sentTo
              ? `We've sent the code to ${purchased.recipientName || sentTo}.`
              : "It's yours to use — redeem it at checkout anytime in the next year."}
          </p>
          <div className="form-card" style={{ display: 'inline-block', margin: '12px 0' }}>
            <span className="muted" style={{ fontSize: '0.85rem' }}>Gift card code</span>
            <h2 style={{ margin: '4px 0', fontFamily: 'var(--font-mono)' }}>{purchased.id}</h2>
            <span className="muted" style={{ fontSize: '0.85rem' }}>Worth ₹{purchased.initialValue}</span>
          </div>
          <p className="muted" style={{ fontSize: '0.85rem' }}>We've also emailed you a copy of this code for your records.</p>
          <div className="flex gap-2" style={{ justifyContent: 'center', marginTop: 12 }}>
            <button className="btn btn-outline" onClick={resetForm}>Buy another</button>
            <Link to="/shop" className="btn btn-gold">Continue shopping</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container section">
      <SeoMeta
        title="Gift Cards — Western Gods Organics"
        description="Buy a Western Gods Organics gift card for yourself or someone else, redeemable on any order for a year."
        path="/gift-cards"
        robots="noindex"
      />
      <div className="breadcrumb">Home / Gift Cards</div>
      <h2>Gift Cards</h2>
      <p className="muted" style={{ marginBottom: 24, maxWidth: 640 }}>
        Send a Western Gods Organics gift card by email or WhatsApp, or buy one for yourself to use anytime in
        the next year — redeemable at checkout on any order, on top of any coupon or reward points.
      </p>

      <form className="form-card" onSubmit={handleBuy} style={{ maxWidth: 520 }}>
        <h3 style={{ marginTop: 0 }}>Choose an amount</h3>
        <div className="flex gap-2" style={{ flexWrap: 'wrap', marginBottom: 12 }}>
          {config.denominations.map((d) => (
            <button
              type="button"
              key={d}
              className={`btn btn-sm ${amount === d ? 'btn-gold' : 'btn-outline'}`}
              onClick={() => { setAmount(d); setCustomAmount(''); }}
            >
              ₹{d}
            </button>
          ))}
          <button
            type="button"
            className={`btn btn-sm ${amount === 'custom' ? 'btn-gold' : 'btn-outline'}`}
            onClick={() => setAmount('custom')}
          >
            Custom
          </button>
        </div>
        {amount === 'custom' && (
          <div className="field" style={{ maxWidth: 220 }}>
            <label htmlFor="giftcard-custom-amount">Amount (₹{minAmount}–₹{maxAmount})</label>
            <input
              id="giftcard-custom-amount"
              type="number"
              min={minAmount}
              max={maxAmount}
              value={customAmount}
              onChange={(e) => setCustomAmount(e.target.value)}
            />
          </div>
        )}

        <h3 style={{ marginTop: 22 }}>Who's it for?</h3>
        <label className="flex gap-2" style={{ alignItems: 'center', cursor: 'pointer', marginBottom: 12, fontWeight: 400 }}>
          <input type="checkbox" checked={forSelf} onChange={(e) => setForSelf(e.target.checked)} />
          Just for me — I'll use it myself
        </label>

        {!forSelf && (
          <>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="giftcard-recipient-name">Recipient's name (optional)</label>
                <input id="giftcard-recipient-name" value={recipientName} onChange={(e) => setRecipientName(e.target.value)} placeholder="e.g. Priya" />
              </div>
              <div className="field">
                <label htmlFor="giftcard-recipient-email">Recipient's email (optional)</label>
                <input id="giftcard-recipient-email" type="email" value={recipientEmail} onChange={(e) => setRecipientEmail(e.target.value)} placeholder="priya@example.com" />
              </div>
              <div className="field">
                <label htmlFor="giftcard-recipient-phone">Recipient's WhatsApp number (optional)</label>
                <input id="giftcard-recipient-phone" value={recipientPhone} onChange={(e) => setRecipientPhone(e.target.value)} placeholder="+91 98765 43210" />
              </div>
            </div>
            <div className="field">
              <label htmlFor="giftcard-message">Personal message (optional)</label>
              <textarea
                id="giftcard-message"
                rows={3}
                maxLength={500}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Happy birthday! Enjoy some cold-pressed goodness."
              />
            </div>
            <p className="muted" style={{ fontSize: '0.82rem', marginTop: -4 }}>
              Leave the recipient fields blank to keep the code for yourself instead.
            </p>
          </>
        )}

        {error && <div className="alert alert-error" style={{ marginTop: 12 }}>{error}</div>}

        <button className="btn btn-gold btn-block" style={{ marginTop: 18 }} disabled={busy || !validAmount}>
          {busy ? 'Processing…' : `Buy gift card${validAmount ? ` — ₹${effectiveAmount}` : ''}`}
        </button>
      </form>
    </div>
  );
}
