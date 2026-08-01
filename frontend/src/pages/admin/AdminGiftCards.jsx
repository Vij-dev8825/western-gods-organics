import { useEffect, useState } from 'react';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';

function statusLabel(c) {
  if (c.status === 'cancelled') return { text: 'Cancelled', cls: 'cancelled' };
  if (c.balance <= 0) return { text: 'Fully redeemed', cls: 'cancelled' };
  if (c.expiresAt && new Date(c.expiresAt) < new Date()) return { text: 'Expired', cls: 'cancelled' };
  return { text: 'Active', cls: 'placed' };
}

export default function AdminGiftCards() {
  const { token } = useAuth();
  const [giftCards, setGiftCards] = useState([]);
  const [message, setMessage] = useState(null);

  function load() {
    api.admin.getGiftCards(token).then((d) => setGiftCards(d.giftCards)).catch(() => {});
  }
  useEffect(load, [token]);

  async function cancel(c) {
    if (!window.confirm(`Cancel gift card "${c.id}"? This cannot be undone.`)) return;
    try {
      await api.admin.cancelGiftCard(token, c.id);
      load();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  }

  return (
    <>
      <div className="admin-head">
        <h1>Gift Cards</h1>
      </div>
      <p className="muted">
        Every gift card purchased on the site, with its live remaining balance. Customers buy these from the{' '}
        <code>/gift-cards</code> page and redeem them at checkout, stacked on top of any coupon or reward points.
      </p>

      {message && <div className={`alert alert-${message.type}`}>{message.text}</div>}

      <div className="admin-card">
        {giftCards.length === 0 ? (
          <p className="muted">No gift cards purchased yet.</p>
        ) : (
          <table className="admin-table">
            <thead>
              <tr><th>Code</th><th>Value</th><th>Balance</th><th>Purchaser</th><th>Recipient</th><th>Status</th><th>Purchased</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {giftCards.map((c) => {
                const status = statusLabel(c);
                return (
                  <tr key={c.id}>
                    <td><code>{c.id}</code></td>
                    <td>₹{c.initialValue}</td>
                    <td>₹{c.balance}</td>
                    <td>
                      {c.purchaserName || '—'}
                      <div className="muted" style={{ fontSize: '0.75rem' }}>{c.purchaserEmail}</div>
                    </td>
                    <td>
                      {c.recipientName || c.recipientEmail || c.recipientPhone
                        ? (
                          <>
                            {c.recipientName || '—'}
                            <div className="muted" style={{ fontSize: '0.75rem' }}>{c.recipientEmail || c.recipientPhone}</div>
                          </>
                        )
                        : <span className="muted">Self</span>}
                    </td>
                    <td><span className={`pill status-${status.cls}`}>{status.text}</span></td>
                    <td>{new Date(c.createdAt).toLocaleDateString('en-IN')}</td>
                    <td>
                      {c.status !== 'cancelled' && (
                        <button className="link-btn danger" onClick={() => cancel(c)}>cancel</button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
