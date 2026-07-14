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

  const { stats, lowStock, recentOrders, recentEnquiries } = data;
  const tiles = [
    ['Customers', stats.customers, '/admin/leads'],
    ['Products', stats.products, '/admin/products'],
    ['Orders', stats.orders, '/admin/orders'],
    ['Revenue', `₹${stats.revenue.toLocaleString('en-IN')}`, '/admin/orders'],
    ['New bulk enquiries', stats.newEnquiries, '/admin/leads'],
    ['Unread chats', stats.unreadChats, '/admin/chat'],
  ];

  return (
    <>
      <div className="admin-head">
        <h1>Dashboard</h1>
        <span className={`db-pill ${data.dbMode === 'postgres' ? 'pg' : ''}`}>
          {data.dbMode === 'postgres' ? '● Neon Postgres' : '● Local JSON (set DATABASE_URL for Neon)'}
        </span>
      </div>

      <div className="stat-tiles">
        {tiles.map(([label, value, to]) => (
          <Link to={to} className="stat-tile" key={label}>
            <b className="gold-text">{value}</b>
            <span>{label}</span>
          </Link>
        ))}
      </div>

      {lowStock.length > 0 && (
        <div className="admin-card">
          <h3>⚠ Low stock (≤ 10 units)</h3>
          <table className="admin-table">
            <thead>
              <tr><th>Product</th><th>Size</th><th>Stock</th></tr>
            </thead>
            <tbody>
              {lowStock.map((l) => (
                <tr key={`${l.productId}-${l.size}`}>
                  <td>{l.name}</td>
                  <td>{l.size}</td>
                  <td><span className="pill warn">{l.stock}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

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
    </>
  );
}
