import { Link } from 'react-router-dom';
import { useSeller } from './SellerLayout';

export default function SellerDashboard() {
  const { me } = useSeller();

  return (
    <>
      <div className="admin-head">
        <h1>Dashboard</h1>
      </div>
      <p className="muted" style={{ marginTop: -10, marginBottom: 20 }}>
        You keep <b className="gold-text">{100 - me.platformFeeRate}%</b> of every sale, credited once the
        order is delivered.
      </p>

      {me.probationRemaining > 0 && (
        <div className="alert" style={{ marginBottom: 20 }}>
          Your first {me.probationRemaining} listing{me.probationRemaining === 1 ? '' : 's'} will be reviewed
          before going live — after that, your listings post instantly.
        </div>
      )}

      <div className="stat-tiles">
        <Link to="/seller/dashboard/orders" className="stat-tile">
          <b className="gold-text">₹{me.balance}</b>
          <span>Available balance</span>
        </Link>
        <Link to="/seller/dashboard/orders" className="stat-tile">
          <b className="gold-text">₹{me.totalEarned}</b>
          <span>Total earned</span>
        </Link>
        <Link to="/seller/dashboard/orders" className="stat-tile">
          <b className="gold-text">₹{me.totalPaid}</b>
          <span>Total paid out</span>
        </Link>
      </div>

      <div className="admin-card">
        <h3>Earnings history</h3>
        {me.history.length === 0 ? (
          <p className="muted">
            No sales yet. Once an order containing one of your products is delivered, your share appears here.
          </p>
        ) : (
          <table className="admin-table">
            <thead>
              <tr><th>Date</th><th>Activity</th><th style={{ textAlign: 'right' }}>Amount</th></tr>
            </thead>
            <tbody>
              {me.history.map((e) => (
                <tr key={e.id}>
                  <td>{new Date(e.createdAt).toLocaleDateString('en-IN')}</td>
                  <td>{e.type === 'earn' ? `Sale — ${e.note}` : e.note}</td>
                  <td style={{ textAlign: 'right', color: e.amount > 0 ? 'var(--forest)' : 'inherit' }}>
                    {e.amount > 0 ? `+₹${e.amount}` : `−₹${Math.abs(e.amount)}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="muted" style={{ fontSize: '0.8rem', marginBottom: 0 }}>
          Payouts are made by bank transfer/UPI outside this app — your balance updates here once we've sent it.
        </p>
      </div>
    </>
  );
}
