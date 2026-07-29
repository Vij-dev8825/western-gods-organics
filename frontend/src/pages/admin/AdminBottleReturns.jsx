import { useEffect, useState } from 'react';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';

const STATUSES = ['requested', 'approved', 'rejected'];

export default function AdminBottleReturns() {
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
      const { creditIssued } = await api.admin.updateBottleReturnStatus(token, o.id, status);
      setMessage({
        type: 'success',
        text: creditIssued
          ? `Approved — a ₹${creditIssued} refill credit coupon was issued to the customer.`
          : `Bottle return for order ${o.orderNumber} marked "${status}" — customer notified.`,
      });
      load();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  }

  const returns = orders.filter((o) => o.bottleReturn);

  return (
    <>
      <div className="admin-head">
        <h1>Bottle Returns</h1>
      </div>
      <p className="muted">
        Empty glass bottle return requests from delivered orders — approving issues the customer a ₹20/bottle refill credit coupon.
      </p>

      {message && <div className={`alert alert-${message.type}`}>{message.text}</div>}

      <div className="admin-card">
        {returns.length === 0 ? (
          <p className="muted">No bottle return requests yet.</p>
        ) : (
          <table className="admin-table">
            <thead>
              <tr><th>Order</th><th>Customer</th><th>Bottles</th><th>Requested</th><th>Status → change (notifies customer)</th></tr>
            </thead>
            <tbody>
              {returns
                .slice()
                .sort((a, b) => new Date(b.bottleReturn.createdAt) - new Date(a.bottleReturn.createdAt))
                .map((o) => (
                  <tr key={o.id}>
                    <td>
                      <b>{o.orderNumber}</b>
                      <div className="muted" style={{ fontSize: '0.75rem' }}>₹{o.total}</div>
                    </td>
                    <td>
                      {o.customer?.name || '—'}
                      <div className="muted" style={{ fontSize: '0.75rem' }}>{o.customer?.phone}</div>
                    </td>
                    <td>{o.bottleReturn.quantity}</td>
                    <td className="muted" style={{ fontSize: '0.82rem' }}>
                      {new Date(o.bottleReturn.createdAt).toLocaleDateString('en-IN')}
                    </td>
                    <td>
                      <select
                        className="select"
                        value={o.bottleReturn.status}
                        onChange={(e) => setStatus(o, e.target.value)}
                      >
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
