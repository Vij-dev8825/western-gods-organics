import { useEffect, useState } from 'react';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';

const FREQUENCY_LABELS = { 14: 'Every 2 weeks', 28: 'Every 4 weeks', 42: 'Every 6 weeks' };
function formatFrequency(days) {
  return FREQUENCY_LABELS[days] || `Every ${days} days`;
}

export default function AdminSubscriptions() {
  const { token } = useAuth();
  const [subscriptions, setSubscriptions] = useState([]);
  const [message, setMessage] = useState(null);
  const [running, setRunning] = useState(false);

  function load() {
    api.admin.getSubscriptions(token).then((d) => setSubscriptions(d.subscriptions)).catch(() => {});
  }
  useEffect(load, [token]);

  async function runNow() {
    setRunning(true);
    setMessage(null);
    try {
      const d = await api.admin.runSubscriptions(token);
      const created = d.results.filter((r) => r.orderId).length;
      const skipped = d.results.filter((r) => r.skipped || r.error).length;
      setMessage({
        type: 'success',
        text: `Processed ${d.results.length} due subscription(s) — ${created} order(s) created${skipped ? `, ${skipped} skipped` : ''}.`,
      });
      load();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setRunning(false);
    }
  }

  const activeCount = subscriptions.filter((s) => s.status === 'active').length;

  return (
    <>
      <div className="admin-head">
        <h1>Subscriptions</h1>
        <button className="btn btn-gold btn-sm" onClick={runNow} disabled={running}>
          {running ? 'Running…' : 'Run due subscriptions now'}
        </button>
      </div>

      <p className="muted" style={{ fontSize: '0.85rem' }}>
        Due subscriptions are also processed automatically every hour while the server is running.
        This button is a manual fallback — {activeCount} active subscription(s) total.
      </p>

      {message && <div className={`alert alert-${message.type}`}>{message.text}</div>}

      <div className="admin-card">
        <table className="admin-table">
          <thead>
            <tr><th>Customer</th><th>Product</th><th>Frequency</th><th>Next delivery</th><th>Status</th></tr>
          </thead>
          <tbody>
            {subscriptions.length === 0 && (
              <tr><td colSpan={5} className="muted">No subscriptions yet.</td></tr>
            )}
            {subscriptions.map((s) => (
              <tr key={s.id}>
                <td><b>{s.customerName || '—'}</b><div className="muted" style={{ fontSize: '0.75rem' }}>{s.customerPhone}</div></td>
                <td>{s.productName}<div className="muted" style={{ fontSize: '0.75rem' }}>{s.size} × {s.quantity}</div></td>
                <td>{formatFrequency(s.frequencyDays)}</td>
                <td>{s.status === 'active' ? new Date(s.nextOrderDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</td>
                <td>
                  <span className={`pill status-${s.status === 'active' ? 'placed' : s.status === 'paused' ? 'processing' : 'cancelled'}`}>
                    {s.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
