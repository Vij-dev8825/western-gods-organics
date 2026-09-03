import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';

export default function Dashboard() {
  const { token } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.admin.stats(token).then(setData).catch((e) => setError(e.message));
  }, [token]);

  if (error) return <div className="alert alert-error">{error}</div>;
  if (!data) return <p className="muted">Loading…</p>;

  const { stats, lowStock, salesTrend, visitTrend, bestSellers, recentOrders, recentEnquiries, recentContacts, recentComments } = data;
  const maxTrendRevenue = Math.max(...salesTrend.map((d) => d.revenue), 1);
  const maxTrendVisitors = Math.max(...visitTrend.map((d) => d.visitors), 1);
  const tiles = [
    ['Visitors today', stats.visitorsToday, '#visitor-trend', false],
    ['Customers', stats.customers, '/admin/leads', false],
    ['Products', stats.products, '/admin/products', false],
    ['Orders', stats.orders, '/admin/orders', false],
    ['Revenue', `₹${stats.revenue.toLocaleString('en-IN')}`, '/admin/orders', false],
    ['Needs confirmation', stats.pendingOrders, '/admin/orders', stats.pendingOrders > 0],
    ['New enquiries', stats.newEnquiries, '/admin/leads', stats.newEnquiries > 0],
    ['Contact messages', stats.contacts, '/admin/leads', false],
    ['Unread chats', stats.unreadChats, '/admin/chat', stats.unreadChats > 0],
  ];

  return (
    <>
      <div className="admin-head">
        <h1>Dashboard</h1>
        <span className={`db-pill ${data.dbMode === 'postgres' ? 'pg' : ''}`}>
          {data.dbMode === 'postgres' ? '● Neon Postgres' : '● Local JSON (set DATABASE_URL for Neon)'}
        </span>
      </div>

      <p className="muted" style={{ marginTop: -10, marginBottom: 20 }}>
        Today: <b className="gold-text">{stats.todayOrders}</b> order{stats.todayOrders === 1 ? '' : 's'} ·{' '}
        <b className="gold-text">₹{stats.todayRevenue.toLocaleString('en-IN')}</b> in revenue
      </p>

      <div className="stat-tiles">
        {tiles.map(([label, value, to, alert]) => (
          <Link to={to} className={`stat-tile ${alert ? 'alert' : ''}`} key={label}>
            <b className={alert ? '' : 'gold-text'}>{value}</b>
            <span>{label}</span>
          </Link>
        ))}
      </div>

      {lowStock.length > 0 && (
        <div className="admin-card">
          <h3>⚠ Low stock (≤ 10 units)</h3>
          <table className="admin-table">
            <thead>
              <tr><th>Product</th><th>Size</th><th>Stock</th><th>Est. days left</th></tr>
            </thead>
            <tbody>
              {lowStock.map((l) => (
                <tr key={`${l.productId}-${l.size}`}>
                  <td>{l.name}</td>
                  <td>{l.size}</td>
                  <td><span className="pill warn">{l.stock}</span></td>
                  <td>
                    {l.daysLeft == null
                      ? <span className="muted">— no recent sales</span>
                      : <span className={l.daysLeft <= 7 ? 'pill warn' : 'muted'}>~{l.daysLeft}d</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="admin-card" id="visitor-trend">
        <h3>Visitor trend (last 14 days)</h3>
        <p className="muted" style={{ marginTop: -6, marginBottom: 14 }}>
          First-party count — no Google Analytics account needed. Counts a distinct browser once per day;
          {' '}{stats.pageViewsToday} page view{stats.pageViewsToday === 1 ? '' : 's'} recorded today in total.
        </p>
        <div className="trend-chart">
          {visitTrend.map((d) => (
            <div className="trend-row" key={d.date}>
              <span className="trend-date muted">
                {new Date(d.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
              </span>
              <div className="trend-bar-track">
                <div className="trend-bar" style={{ width: `${(d.visitors / maxTrendVisitors) * 100}%` }} />
              </div>
              <span className="trend-value">{d.visitors} visitor{d.visitors === 1 ? '' : 's'}</span>
              <span className="muted trend-orders">{d.pageViews} view{d.pageViews === 1 ? '' : 's'}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="admin-two-col">
        <div className="admin-card">
          <h3>Sales trend (last 14 days)</h3>
          <div className="trend-chart">
            {salesTrend.map((d) => (
              <div className="trend-row" key={d.date}>
                <span className="trend-date muted">
                  {new Date(d.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                </span>
                <div className="trend-bar-track">
                  <div className="trend-bar" style={{ width: `${(d.revenue / maxTrendRevenue) * 100}%` }} />
                </div>
                <span className="trend-value">₹{d.revenue.toLocaleString('en-IN')}</span>
                <span className="muted trend-orders">{d.orders} order{d.orders === 1 ? '' : 's'}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="admin-card">
          <h3>Best sellers (last 30 days)</h3>
          {bestSellers.length === 0 ? (
            <p className="muted">No sales in the last 30 days yet.</p>
          ) : (
            <table className="admin-table">
              <thead>
                <tr><th>Product</th><th>Units sold</th><th>Revenue</th></tr>
              </thead>
              <tbody>
                {bestSellers.map((b) => (
                  <tr key={b.productId}>
                    <td>{b.name}</td>
                    <td>{b.unitsSold}</td>
                    <td>₹{b.revenue.toLocaleString('en-IN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="admin-two-col">
        <div className="admin-card">
          <h3>Recent orders</h3>
          {recentOrders.length === 0 ? (
            <p className="muted">No orders yet.</p>
          ) : (
            <table className="admin-table">
              <thead>
                <tr><th>Order</th><th>Total</th><th>Status</th></tr>
              </thead>
              <tbody>
                {recentOrders.map((o) => (
                  <tr key={o.id}>
                    <td>{o.orderNumber}</td>
                    <td>₹{o.total}</td>
                    <td><span className={`pill status-${o.status}`}>{o.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="admin-card">
          <h3>Recent bulk enquiries</h3>
          {recentEnquiries.length === 0 ? (
            <p className="muted">No enquiries yet.</p>
          ) : (
            <table className="admin-table">
              <thead>
                <tr><th>Name</th><th>Wants</th><th>Status</th></tr>
              </thead>
              <tbody>
                {recentEnquiries.map((e) => (
                  <tr key={e.id}>
                    <td>{e.name}</td>
                    <td>{e.quantity} {e.unit} {e.productCategory}</td>
                    <td><span className="pill">{e.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="admin-two-col">
        <div className="admin-card">
          <h3>Recent contact messages</h3>
          {recentContacts.length === 0 ? (
            <p className="muted">No messages yet.</p>
          ) : (
            <table className="admin-table">
              <thead>
                <tr><th>Name</th><th>Subject</th><th>Message</th></tr>
              </thead>
              <tbody>
                {recentContacts.map((c) => (
                  <tr key={c.id}>
                    <td>{c.name}</td>
                    <td>{c.subject}</td>
                    <td className="truncate-cell">{c.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <Link to="/admin/leads" className="link-btn" style={{ display: 'inline-block', marginTop: 10 }}>View all →</Link>
        </div>
        <div className="admin-card">
          <h3>Recent blog comments</h3>
          {recentComments.length === 0 ? (
            <p className="muted">No comments yet.</p>
          ) : (
            <table className="admin-table">
              <thead>
                <tr><th>Post</th><th>Comment</th></tr>
              </thead>
              <tbody>
                {recentComments.map((c) => (
                  <tr key={c.id}>
                    <td>{c.postTitle}</td>
                    <td className="truncate-cell"><b>{c.userName}:</b> {c.text}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <Link to="/admin/blog" className="link-btn" style={{ display: 'inline-block', marginTop: 10 }}>Manage →</Link>
        </div>
      </div>
    </>
  );
}
