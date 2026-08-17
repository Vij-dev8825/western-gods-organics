/**
 * What every product would earn if it sold today.
 *
 * Admin → Profit reports what actually happened, and needs orders to say
 * anything. This needs none: it reads the costs and prices already on the
 * catalogue and ranks them. For a shop that has just entered its costs, this
 * is where that hour becomes visible — and it stays true when a seed price
 * moves, which a table worked out by hand does not.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';

const money = (n) => `₹${Math.round(Number(n) || 0).toLocaleString('en-IN')}`;
const THIN = 20;

export default function AdminMargins() {
  const { token } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.admin.catalogMargins(token).then(setData).catch((err) => setError(err.message));
  }, [token]);

  if (error) return <div className="alert alert-error">{error}</div>;
  if (!data) {
    return (
      <div>
        <div className="section-head"><div><span className="eyebrow">Money</span><h2>Margins</h2></div></div>
        <p className="muted">Loading…</p>
      </div>
    );
  }

  const { products, summary } = data;

  return (
    <div>
      <div className="section-head">
        <div><span className="eyebrow">Money</span><h2>Margins</h2></div>
      </div>
      <p className="muted" style={{ marginTop: -8, maxWidth: '64ch' }}>
        What each size would earn if it sold today — price less what the goods cost you.
        No orders needed. <Link to="/admin/profit">Profit</Link> answers the other question:
        what actually survived after the gateway fee, the courier and anything owed out.
        This is the ceiling; that is the result.
      </p>

      <div className="stat-grid" style={{ marginTop: 18 }}>
        <div className="stat-card">
          <span className="stat-label">Average margin</span>
          <b className="stat-value">{summary.averageMarginPercent === null ? '—' : `${summary.averageMarginPercent}%`}</b>
        </div>
        <div className="stat-card">
          <span className="stat-label">Sizes costed</span>
          <b className="stat-value">{summary.sizesCosted} / {summary.sizes}</b>
        </div>
        <div className="stat-card">
          <span className="stat-label">Still to cost</span>
          <b className="stat-value">{summary.sizesUncosted}</b>
        </div>
        {summary.tradeBelowCost > 0 && (
          <div className="stat-card" style={{ borderColor: '#A8462B' }}>
            <span className="stat-label">Trade rates below cost</span>
            <b className="stat-value" style={{ color: '#A8462B' }}>{summary.tradeBelowCost}</b>
          </div>
        )}
      </div>

      {summary.sizesCosted === 0 && (
        <div className="form-card" style={{ maxWidth: 620, marginTop: 18 }}>
          <p style={{ margin: 0 }}>No costs entered yet.</p>
          <p className="muted" style={{ fontSize: '0.86rem', marginBottom: 0 }}>
            Add a <b>Cost ₹</b> to any size in <Link to="/admin/products">Products</Link> and it
            appears here straight away — no order required.
          </p>
        </div>
      )}

      {/* Averaged straight across sizes, not weighted by sales. Said plainly
          rather than implied, because with no orders there is nothing to
          weight by and a "weighted" figure would be a fiction. */}
      {summary.sizesCosted > 0 && (
        <p className="muted" style={{ fontSize: '0.78rem', marginTop: 10 }}>
          Average is a straight mean across costed sizes — nothing has sold yet, so there are no
          volumes to weight it by.
        </p>
      )}

      <div className="table-wrap" style={{ marginTop: 16, overflowX: 'auto' }}>
        <table className="admin-table admin-table-stack">
          <thead>
            <tr>
              <th>Product</th><th>Size</th><th>Price</th><th>Cost</th>
              <th>You keep</th><th>Trade</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) =>
              p.sizes.map((s, i) => {
                const thin = s.marginPercent !== null && s.marginPercent < THIN;
                return (
                  <tr key={`${p.id}-${s.label}`} style={s.tradeBelowCost ? { background: 'rgba(168,70,43,0.06)' } : undefined}>
                    <td data-label="Product">
                      {i === 0 ? (
                        <>
                          <Link to="/admin/products">{p.name}</Link>
                          <div className="muted" style={{ fontSize: '0.74rem' }}>{p.category}</div>
                        </>
                      ) : (
                        <span className="muted" style={{ fontSize: '0.78rem' }}>↳</span>
                      )}
                    </td>
                    <td data-label="Size">{s.label}</td>
                    <td data-label="Price">{money(s.price)}</td>
                    <td data-label="Cost">
                      {s.cost === null
                        ? <span className="muted" style={{ fontSize: '0.8rem' }}><i>not set</i></span>
                        : money(s.cost)}
                    </td>
                    <td data-label="You keep">
                      {s.margin === null ? <span className="muted">—</span> : (
                        <span style={{ color: s.margin < 0 ? '#A8462B' : thin ? '#9A6A12' : 'inherit' }}>
                          <b>{money(s.margin)}</b>{' '}
                          <span className="muted" style={{ fontSize: '0.8rem' }}>{s.marginPercent}%</span>
                        </span>
                      )}
                    </td>
                    <td data-label="Trade">
                      {s.wholesale === null ? <span className="muted" style={{ fontSize: '0.8rem' }}>—</span> : (
                        <>
                          {money(s.wholesale)}
                          {s.tradeMargin !== null && (
                            <div style={{ fontSize: '0.74rem', color: s.tradeBelowCost ? '#A8462B' : 'var(--muted, #6B7A70)' }}>
                              {s.tradeBelowCost
                                ? `⚠ ${money(s.tradeMargin)} — below cost`
                                : `keeps ${money(s.tradeMargin)} · ${s.tradeMarginPercent}%`}
                            </div>
                          )}
                        </>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <p className="muted" style={{ fontSize: '0.8rem', marginTop: 14, maxWidth: '64ch' }}>
        Gross margin only — the gateway fee depends on how a customer pays, delivery on where
        they live, and commission on who referred them. None of that is knowable per size, so
        none of it is guessed at here.
      </p>
    </div>
  );
}
