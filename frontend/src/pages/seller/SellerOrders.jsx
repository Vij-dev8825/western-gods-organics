import { useEffect, useState } from 'react';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import ChakkiWheel from '../../components/ChakkiWheel';

// Orders the store hasn't finished yet — what a seller most wants to see
// first, since those are the ones still needing stock.
const OPEN_STATUSES = ['placed', 'confirmed', 'shipped'];

const TABS = [
  { key: 'open', label: 'To fulfil' },
  { key: 'delivered', label: 'Delivered' },
  { key: 'all', label: 'All' },
];

export default function SellerOrders() {
  const { token } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState('open');

  useEffect(() => {
    if (!token) return;
    api.seller.getOrders(token)
      .then((d) => setOrders(d.orders))
      .catch(() => setOrders([]))
      .finally(() => setLoaded(true));
  }, [token]);

  const shown = orders.filter((o) => {
    if (tab === 'open') return OPEN_STATUSES.includes(o.status);
    if (tab === 'delivered') return o.status === 'delivered';
    return true;
  });

  const openCount = orders.filter((o) => OPEN_STATUSES.includes(o.status)).length;
  const unitsSold = orders
    .filter((o) => o.status === 'delivered')
    .reduce((sum, o) => sum + o.items.reduce((n, i) => n + i.quantity, 0), 0);
  const pending = orders
    .filter((o) => OPEN_STATUSES.includes(o.status))
    .reduce((sum, o) => sum + o.estimated, 0);

  if (!loaded) {
    return (
      <div className="empty-state">
        <ChakkiWheel size={56} />
        <p className="muted">Loading your orders…</p>
      </div>
    );
  }

  return (
    <>
      <div className="admin-head">
        <h1>Orders</h1>
      </div>

      {orders.length === 0 ? (
        <div className="admin-card">
          <p className="muted" style={{ marginBottom: 0 }}>
            No orders yet. When a shopper buys one of your products, it shows up here — and your share is
            credited once the order is delivered.
          </p>
        </div>
      ) : (
        <>
          <div className="stat-tiles">
            <div className="stat-tile">
              <b className="gold-text">{openCount}</b>
              <span>Awaiting fulfilment</span>
            </div>
            <div className="stat-tile">
              <b className="gold-text">₹{pending}</b>
              <span>Coming your way</span>
            </div>
            <div className="stat-tile">
              <b className="gold-text">{unitsSold}</b>
              <span>Units delivered</span>
            </div>
          </div>

          <div className="tab-row">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                className={`tab ${tab === t.key ? 'active' : ''}`}
                onClick={() => setTab(t.key)}
              >
                {t.label}
                {t.key === 'open' && openCount > 0 && <span className="badge-count static">{openCount}</span>}
              </button>
            ))}
          </div>

          <div className="admin-card">
            {shown.length === 0 ? (
              <p className="muted" style={{ marginBottom: 0 }}>Nothing in this tab right now.</p>
            ) : (
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Your items</th>
                    <th>Ships to</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Your share</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((o) => (
                    <tr key={o.id}>
                      <td>
                        <b>{o.orderNumber}</b>
                        <br />
                        <span className="muted" style={{ fontSize: '0.78rem' }}>
                          {new Date(o.placedAt).toLocaleDateString('en-IN', {
                            day: 'numeric', month: 'short', year: 'numeric',
                          })}
                        </span>
                      </td>
                      <td>
                        {o.items.map((i, idx) => (
                          <div key={idx}>
                            {i.quantity} × {i.name} <span className="muted">({i.size})</span>
                          </div>
                        ))}
                      </td>
                      <td className="muted">{o.destination || '—'}</td>
                      <td>
                        <span className={`pill status-${o.status}`}>{o.status}</span>
                        {o.returnStatus && (
                          <>
                            <br />
                            <span className={`pill status-${o.returnStatus}`}>return {o.returnStatus}</span>
                          </>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {o.earned != null ? (
                          <b style={{ color: 'var(--forest)' }}>₹{o.earned}</b>
                        ) : (
                          <>
                            ₹{o.estimated}
                            <br />
                            <span className="muted" style={{ fontSize: '0.75rem' }}>on delivery</span>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <p className="muted" style={{ fontSize: '0.8rem', marginBottom: 0 }}>
              We pack and ship these for you, so buyer contact details stay with the store. Your share is
              credited once an order reaches Delivered.
            </p>
          </div>
        </>
      )}
    </>
  );
}
