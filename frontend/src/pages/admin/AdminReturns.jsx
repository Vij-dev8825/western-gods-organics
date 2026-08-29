import { useEffect, useMemo, useState } from 'react';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';

const STATUSES = ['requested', 'approved', 'rejected', 'refunded'];
const REASON_LABELS = {
  'damaged-incorrect': 'Damaged or incorrect item',
  'quality-issue': "Doesn't meet quality promise",
  other: 'Other',
};

export default function AdminReturns() {
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
      await api.admin.updateReturnStatus(token, o.id, status);
      setMessage({ type: 'success', text: `Return for order ${o.orderNumber} marked "${status}" — customer notified.` });
      load();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  }

  const sortedReturns = useMemo(
    () =>
      orders
        .filter((o) => o.returnRequest)
        .slice()
        .sort((a, b) => new Date(b.returnRequest.createdAt) - new Date(a.returnRequest.createdAt)),
    [orders]
  );

  return (
    <>
      <div className="admin-head">
        <h1>Returns</h1>
      </div>
      <p className="muted">Return/replacement requests customers submitted from My Orders (delivered orders only, within 7 days).</p>

      {message && <div className={`alert alert-${message.type}`}>{message.text}</div>}

      <div className="admin-card">
        {sortedReturns.length === 0 ? (
          <p className="muted">No return requests yet.</p>
        ) : (
          <table className="admin-table">
            <thead>
              <tr><th>Order</th><th>Customer</th><th>Reason</th><th>Description</th><th>Requested</th><th>Status → change (notifies customer)</th></tr>
            </thead>
            <tbody>
              {sortedReturns.map((o) => (
                <tr key={o.id}>
                  <td>
                    <b>{o.orderNumber}</b>
                    <div className="muted" style={{ fontSize: '0.75rem' }}>₹{o.total}</div>
                  </td>
                  <td>
                    {o.customer?.name || '—'}
                    <div className="muted" style={{ fontSize: '0.75rem' }}>{o.customer?.phone}</div>
                  </td>
                  <td>{REASON_LABELS[o.returnRequest.reason] || o.returnRequest.reason}</td>
                  <td style={{ maxWidth: 280 }} className="truncate-cell">{o.returnRequest.description}</td>
                  <td className="muted" style={{ fontSize: '0.82rem' }}>
                    {new Date(o.returnRequest.createdAt).toLocaleDateString('en-IN')}
                  </td>
                  <td>
                    <select
                      className="select"
                      value={o.returnRequest.status}
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
