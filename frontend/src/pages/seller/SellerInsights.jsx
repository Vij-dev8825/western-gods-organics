import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import ChakkiWheel from '../../components/ChakkiWheel';

const RANGES = [
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
  { days: 90, label: '90 days' },
];

export default function SellerInsights() {
  const { token } = useAuth();
  const [data, setData] = useState(null);
  const [days, setDays] = useState(30);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!token) return;
    setLoaded(false);
    api.seller.getAnalytics(token, days)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoaded(true));
  }, [token, days]);

  if (!loaded) {
    return (
      <div className="empty-state">
        <ChakkiWheel size={56} />
        <p className="muted">Crunching your numbers…</p>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="admin-card">
        <p className="muted" style={{ marginBottom: 0 }}>Couldn't load your insights just now — try again in a moment.</p>
      </div>
    );
  }

  // Guard the divisor: every bar would be NaN-wide on a week with no sales.
  const peak = Math.max(1, ...data.trend.map((d) => d.revenue));
  const topUnits = Math.max(1, ...data.topProducts.map((p) => p.units));

  return (
    <>
      <div className="admin-head">
        <h1>Insights</h1>
        <div className="tab-row" style={{ marginBottom: 0 }}>
          {RANGES.map((r) => (
            <button
              key={r.days}
              type="button"
              className={`tab ${days === r.days ? 'active' : ''}`}
              onClick={() => setDays(r.days)}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="stat-tiles">
        <div className="stat-tile">
          <b className="gold-text">₹{data.totals.earnings.toLocaleString('en-IN')}</b>
          <span>Your share, last {data.days} days</span>
        </div>
        <div className="stat-tile">
          <b className="gold-text">{data.totals.units}</b>
          <span>Units sold</span>
        </div>
        <div className="stat-tile">
          <b className="gold-text">{data.totals.orders}</b>
          <span>Orders</span>
        </div>
        <div className="stat-tile">
          <b className="gold-text">{data.totals.liveListings}</b>
          <span>Live listings</span>
        </div>
      </div>

      <div className="admin-card">
        <h3 style={{ marginTop: 0 }}>Your share, day by day</h3>
        {data.totals.orders === 0 ? (
          <p className="muted" style={{ marginBottom: 0 }}>
            Nothing sold in this window yet. Once orders start coming in, they'll chart here.
          </p>
        ) : (
          <div className="trend-chart">
            {data.trend.map((d) => (
              <div className="trend-row" key={d.date}>
                <span className="trend-date muted">
                  {new Date(d.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                </span>
                <div className="trend-bar-track">
                  <div className="trend-bar" style={{ width: `${(d.revenue / peak) * 100}%` }} />
                </div>
                <span className="trend-value">₹{d.revenue.toLocaleString('en-IN')}</span>
                <span className="muted trend-orders">{d.orders} order{d.orders === 1 ? '' : 's'}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="admin-two-col">
        <div className="admin-card">
          <h3 style={{ marginTop: 0 }}>Best sellers</h3>
          {data.topProducts.length === 0 ? (
            <p className="muted" style={{ marginBottom: 0 }}>No sales in this window.</p>
          ) : (
            <div className="trend-chart">
              {data.topProducts.map((p) => (
                <div className="trend-row" key={p.productId}>
                  <span className="trend-date muted" title={p.name}>{p.name}</span>
                  <div className="trend-bar-track">
                    <div className="trend-bar" style={{ width: `${(p.units / topUnits) * 100}%` }} />
                  </div>
                  <span className="trend-value">{p.units} sold</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="admin-card">
          <h3 style={{ marginTop: 0 }}>Worth a look</h3>

          {data.lowStock.length > 0 && (
            <>
              <p style={{ marginBottom: 6, fontWeight: 600, fontSize: '0.85rem' }}>Running low</p>
              <ul className="muted" style={{ fontSize: '0.85rem', marginTop: 0 }}>
                {data.lowStock.map((s, i) => (
                  <li key={i}>
                    {s.name} ({s.size}) — <b>{s.stock === 0 ? 'out of stock' : `${s.stock} left`}</b>
                  </li>
                ))}
              </ul>
            </>
          )}

          {data.idleListings.length > 0 && (
            <>
              <p style={{ marginBottom: 6, fontWeight: 600, fontSize: '0.85rem' }}>No sales in this window</p>
              <ul className="muted" style={{ fontSize: '0.85rem', marginTop: 0 }}>
                {data.idleListings.map((p) => <li key={p.productId}>{p.name}</li>)}
              </ul>
              <p className="muted" style={{ fontSize: '0.8rem' }}>
                A better photo, a clearer description or a keener price usually moves these.
              </p>
            </>
          )}

          {data.lowStock.length === 0 && data.idleListings.length === 0 && (
            <p className="muted" style={{ marginBottom: 0 }}>
              Nothing needs your attention — stock is healthy and every listing has sold.
            </p>
          )}

          <Link to="/seller/dashboard/products" className="btn btn-outline btn-sm">Manage listings →</Link>
        </div>
      </div>
    </>
  );
}
