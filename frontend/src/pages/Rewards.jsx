import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import ChakkiWheel from '../components/ChakkiWheel';

export default function Rewards() {
  const { token } = useAuth();
  const [data, setData] = useState(null);

  useEffect(() => {
    api.getLoyalty(token).then(setData).catch(() => setData({ balance: 0, history: [] }));
  }, [token]);

  if (!data) {
    return (
      <div className="center" style={{ padding: '120px 0' }}>
        <ChakkiWheel size={56} />
      </div>
    );
  }

  return (
    <div className="container section">
      <div className="breadcrumb">Home / My Rewards</div>
      <h2>My Rewards</h2>
      <p className="muted" style={{ marginBottom: 24 }}>
        Earn 1 point for every ₹10 you spend, credited once your order is delivered. Redeem points for ₹1 off
        per point at checkout.
      </p>

      <div className="form-card" style={{ margin: '0 0 22px' }}>
        <span className="muted" style={{ fontSize: '0.85rem' }}>Available balance</span>
        <h2 style={{ margin: '4px 0 0' }}>{data.balance} points</h2>
        <span className="muted" style={{ fontSize: '0.85rem' }}>worth ₹{data.balance} off your next order</span>
      </div>

      {data.history.length === 0 ? (
        <div className="empty-state">
          <ChakkiWheel size={56} spin={false} />
          <h3>No activity yet</h3>
          <p className="muted">Place an order to start earning reward points.</p>
          <Link to="/shop" className="btn btn-gold">Browse the shop</Link>
        </div>
      ) : (
        <div className="form-card">
          <h3 style={{ marginTop: 0 }}>History</h3>
          <div style={{ overflowX: 'auto' }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Activity</th>
                  <th>Order</th>
                  <th style={{ textAlign: 'right' }}>Points</th>
                </tr>
              </thead>
              <tbody>
                {data.history.map((e) => (
                  <tr key={e.id}>
                    <td>{new Date(e.createdAt).toLocaleDateString()}</td>
                    <td>{e.type === 'earn' ? 'Earned' : 'Redeemed'}</td>
                    <td className="muted">{e.note}</td>
                    <td style={{ textAlign: 'right', color: e.points > 0 ? 'var(--forest)' : 'inherit' }}>
                      {e.points > 0 ? `+${e.points}` : e.points}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
