import { useEffect, useState } from 'react';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';

const STATUSES = ['placed', 'confirmed', 'shipped', 'delivered', 'cancelled'];

export default function AdminOrders() {
  const { token } = useAuth();
  const [orders, setOrders] = useState([]);
  const [message, setMessage] = useState(null);

  function load() {
    api.admin.getOrders(token).then((d) => setOrders(d.orders)).catch(() => {});
  }
  useEffect(load, [token]);

  async function setStatus(o, status) {
    setMessage(null);
    try {
      await api.admin.updateOrderStatus(token, o.id, status);
      setMessage({ type: 'success', text: `Order ${o.orderNumber} marked "${status}" — customer notified.` });
      load();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  }

  return (
    <>
      <div className="admin-head">
        <h1>Orders</h1>
      </div>

      {message && <div className={`alert alert-${message.type}`}>{message.text}</div>}

      <div className="admin-card">
        {orders.length === 0 ? (
          <p className="muted">No orders yet.</p>
        ) : (
          <table className="admin-table">
            <thead>
              <tr><th>Order</th><th>Customer</th><th>Items</th><th>Total</th><th>Status → change (notifies customer)</th></tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td>
                    <b>{o.orderNumber}</b>
                    <div className="muted" style={{ fontSize: '0.75rem' }}>
                      {new Date(o.createdAt).toLocaleString('en-IN')}
                    </div>
                  </td>
                  <td>
                    {o.customer?.name || '—'}
                    <div className="muted" style={{ fontSize: '0.75rem' }}>{o.customer?.phone}</div>
                  </td>
                  <td>
                    {o.items.map((i) => (
                      <div key={`${i.productId}-${i.size}`} style={{ fontSize: '0.82rem' }}>
                        {i.quantity}× {i.name} ({i.size})
                      </div>
                    ))}
                    {o.isGift && (
                      <div className="muted" style={{ fontSize: '0.75rem', marginTop: 4 }}>
                        🎁 Gift{o.giftMessage ? `: "${o.giftMessage}"` : ''}
                      </div>
                    )}
                    {o.giftCardApplied > 0 && (
                      <div className="muted" style={{ fontSize: '0.75rem', marginTop: 4 }}>
                        Gift card {o.giftCardCode} applied: −₹{o.giftCardApplied}
                      </div>
                    )}
                  </td>
                  <td>
                    ₹{o.total}
                    {o.paymentMethod === 'cod_advance' && (
                      <div className="muted" style={{ fontSize: '0.72rem' }}>
                        ₹{o.advancePaid} paid · ₹{o.total - o.advancePaid} cash due
                      </div>
                    )}
                    {o.paymentMethod === 'razorpay' && (
                      <div className="muted" style={{ fontSize: '0.72rem' }}>Paid online</div>
                    )}
                  </td>
                  <td>
                    <select className="select" value={o.status} onChange={(e) => setStatus(o, e.target.value)}>
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
