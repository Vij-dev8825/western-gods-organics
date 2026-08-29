import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { CANONICAL_ORIGIN } from '../utils/site';
import ChakkiWheel from '../components/ChakkiWheel';
import SeoMeta from '../components/SeoMeta';

export default function Affiliate() {
  const { token } = useAuth();
  const { showToast } = useToast();
  const [data, setData] = useState(null); // undefined-ish states: null = loading, false = not an affiliate
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    api.getMyAffiliate(token)
      .then((d) => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoaded(true));
  }, [token]);

  const link = data ? `${CANONICAL_ORIGIN}/?aff=${data.code}` : '';

  function copyLink() {
    navigator.clipboard.writeText(link);
    showToast('Affiliate link copied!');
  }

  if (!loaded) {
    return (
      <div className="center" style={{ padding: '120px 0' }}>
        <ChakkiWheel size={56} />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="container section">
        <SeoMeta
          title="Affiliate Program | Western Gods Organics"
          description="Earn commission for every sale you refer — bloggers, reviewers and creators welcome to join our affiliate program."
          path="/affiliate"
          robots="noindex"
        />
        <div className="breadcrumb">Home / Affiliate Program</div>
        <h2>Affiliate Program</h2>
        <div className="empty-state">
          <span style={{ fontSize: '2.5rem' }}>🤝</span>
          <h3>Not enrolled yet</h3>
          <p className="muted">
            Earn a commission for every sale you bring us — bloggers, reviewers and creators welcome.{' '}
            <a href="mailto:westerngodsorganic@gmail.com">Email us</a> or{' '}
            <a href="https://wa.me/918825875607" target="_blank" rel="noreferrer">message us on WhatsApp</a> to get set up.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container section">
      <SeoMeta
        title="Affiliate Program | Western Gods Organics"
        description="Earn commission for every sale you refer — bloggers, reviewers and creators welcome to join our affiliate program."
        path="/affiliate"
        robots="noindex"
      />
      <div className="breadcrumb">Home / Affiliate Program</div>
      <h2>Affiliate Program</h2>
      <p className="muted" style={{ marginBottom: 24 }}>
        Share your link — anyone who buys after clicking it (within 30 days) counts as your referral. You earn{' '}
        {data.commissionRate}% commission once their order is delivered.
      </p>

      <div className="form-card" style={{ margin: '0 0 22px' }}>
        <span className="muted" style={{ fontSize: '0.85rem' }}>Your affiliate link</span>
        <div className="flex gap-1" style={{ marginTop: 6 }}>
          <input readOnly value={link} style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }} onFocus={(e) => e.target.select()} />
          <button type="button" className="btn btn-gold btn-sm" onClick={copyLink}>Copy</button>
        </div>
        <span className="muted" style={{ fontSize: '0.82rem', display: 'block', marginTop: 8 }}>
          Or just share your code: <b>{data.code}</b>
        </span>
      </div>

      <div className="form-grid" style={{ marginBottom: 22 }}>
        <div className="form-card">
          <span className="muted" style={{ fontSize: '0.85rem' }}>Available balance</span>
          <h2 style={{ margin: '4px 0 0' }}>₹{data.balance}</h2>
        </div>
        <div className="form-card">
          <span className="muted" style={{ fontSize: '0.85rem' }}>Total earned</span>
          <h2 style={{ margin: '4px 0 0' }}>₹{data.totalEarned}</h2>
        </div>
        <div className="form-card">
          <span className="muted" style={{ fontSize: '0.85rem' }}>Total paid out</span>
          <h2 style={{ margin: '4px 0 0' }}>₹{data.totalPaid}</h2>
        </div>
      </div>

      {data.history.length === 0 ? (
        <div className="empty-state">
          <ChakkiWheel size={56} spin={false} />
          <h3>No activity yet</h3>
          <p className="muted">Share your link to start earning commission.</p>
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
                  <th style={{ textAlign: 'right' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {data.history.map((e) => (
                  <tr key={e.id}>
                    <td>{new Date(e.createdAt).toLocaleDateString()}</td>
                    <td>{e.type === 'earn' ? `Commission — ${e.note}` : e.type === 'reversal' ? `Reversed — ${e.note}` : e.note}</td>
                    <td style={{ textAlign: 'right', color: e.amount > 0 ? 'var(--forest)' : 'inherit' }}>
                      {e.amount > 0 ? `+₹${e.amount}` : `−₹${Math.abs(e.amount)}`}
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
