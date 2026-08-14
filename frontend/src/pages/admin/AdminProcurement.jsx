import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

const fmtDate = (iso) =>
  new Date(iso).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });

/** "in 3 days" is what decides whether to act; the date is what you write down. */
function when(days) {
  if (days <= 0) return 'today';
  if (days === 1) return 'tomorrow';
  return `in ${days} days`;
}

/**
 * The buying list.
 *
 * Reads as a week's work in the order it gets done: what has been promised and
 * must be bought for, what is running out and needs a run booked, then the
 * total to actually go and buy. Grower names sit on each line because the
 * output of this screen is a phone call, not a report.
 */
export default function AdminProcurement() {
  const { token } = useAuth();
  const { showToast } = useToast();
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.admin.procurement(token)
      .then((d) => setPlan(d.plan))
      .catch((err) => showToast(err.message, 'error'))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return <p className="muted">Working out what you need…</p>;
  if (!plan) return null;

  const nothingAtAll = !plan.runs.length && !plan.lowStock.length;

  return (
    <>
      <div className="admin-head">
        <h1>What to buy</h1>
      </div>
      <p className="muted" style={{ maxWidth: '62ch' }}>
        Everything the mill has committed to press, what is running out without a run booked, and
        what that adds up to in seed. Quantities appear once you record what each bottle takes —
        until then this still tells you the dates and the counts.
      </p>

      {nothingAtAll && (
        <div className="admin-card">
          <p className="muted" style={{ margin: 0 }}>
            Nothing to buy: no pressings scheduled and nothing running low.{' '}
            <Link to="/admin/pressings">Schedule a run</Link> and it will show up here.
          </p>
        </div>
      )}

      {plan.shoppingList.length > 0 && (
        <>
          <h2 className="proc-heading">Buy this</h2>
          <div className="proc-buy">
            {plan.shoppingList.map((row) => (
              <div className={`proc-buy-item ${row.daysAway <= 3 ? 'urgent' : ''}`} key={`${row.material}|${row.unit}`}>
                <div className="proc-buy-qty">
                  {row.quantity} <span>{row.unit}</span>
                </div>
                <div className="proc-buy-body">
                  <b>{row.material}</b>
                  <span className="muted">
                    needed by {fmtDate(row.neededBy)} — {when(row.daysAway)}
                  </span>
                  <span className="muted">for {row.forRuns.join(', ')}</span>
                  {row.growers.length > 0 && (
                    <span className="proc-grower">Call {row.growers.join(' · ')}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {plan.runs.length > 0 && (
        <>
          <h2 className="proc-heading">Runs to prepare</h2>
          <div className="table-wrap">
            <table className="admin-table admin-table-stack">
              <thead>
                <tr>
                  <th>Pressing</th><th>When</th><th>Bottles</th><th>Needs</th><th>Grower</th>
                </tr>
              </thead>
              <tbody>
                {plan.runs.map((r) => (
                  <tr key={r.pressingId}>
                    <td data-label="Pressing">{r.name}<br /><span className="muted">{r.size}</span></td>
                    <td data-label="When">
                      {fmtDate(r.pressDate)}<br />
                      <span className={r.daysAway <= 3 ? 'proc-soon' : 'muted'}>{when(r.daysAway)}</span>
                    </td>
                    <td data-label="Bottles">
                      <b>{r.units}</b>
                      {r.reserved > 0 && (
                        <><br /><span className="muted">{r.reserved} already sold</span></>
                      )}
                    </td>
                    <td data-label="Needs">
                      {r.materialNeeded != null
                        ? <><b>{r.materialNeeded} {r.materialUnit}</b><br /><span className="muted">{r.material}</span></>
                        : <span className="muted">{r.material || 'not recorded'}</span>}
                    </td>
                    <td data-label="Grower">
                      {r.grower
                        ? <>{r.grower}{r.growerVillage && <><br /><span className="muted">{r.growerVillage}</span></>}</>
                        : <span className="muted">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {plan.missingRatio.length > 0 && (
        <p className="muted" style={{ fontSize: '0.85rem', maxWidth: '62ch' }}>
          {plan.missingRatio.length} of these runs {plan.missingRatio.length === 1 ? 'has' : 'have'} no
          quantity because nobody has recorded what one bottle takes. Set <b>Raw material</b> on the
          product and <b>Material per unit</b> on the size in{' '}
          <Link to="/admin/products">Products</Link>, and they'll be added to the list above.
        </p>
      )}

      {plan.lowStock.length > 0 && (
        <>
          <h2 className="proc-heading">Running out, nothing booked</h2>
          <p className="muted" style={{ fontSize: '0.85rem', maxWidth: '62ch' }}>
            {plan.thresholds.lowStock} or fewer left, and no pressing scheduled. Days left is worked out
            from the last {plan.thresholds.forecastDays} days of sales. These aren't in the buying list
            above — until a run is booked, nobody knows how much to buy.
          </p>
          <div className="table-wrap">
            <table className="admin-table admin-table-stack">
              <thead>
                <tr><th>Product</th><th>Left</th><th>Selling</th><th>Runs out</th><th /></tr>
              </thead>
              <tbody>
                {plan.lowStock.map((s) => (
                  <tr key={`${s.productId}|${s.size}`}>
                    <td data-label="Product">
                      {s.name}<br /><span className="muted">{s.size}</span>
                      {s.grower && <><br /><span className="muted">{s.grower}{s.growerVillage ? `, ${s.growerVillage}` : ''}</span></>}
                    </td>
                    <td data-label="Left"><b>{s.stock}</b></td>
                    <td data-label="Selling">
                      {s.perDay > 0 ? `${s.perDay}/day` : <span className="muted">not lately</span>}
                    </td>
                    <td data-label="Runs out">
                      {s.daysLeft != null
                        ? <span className={s.daysLeft <= 7 ? 'proc-soon' : ''}>{when(s.daysLeft)}</span>
                        : <span className="muted">—</span>}
                    </td>
                    <td className="cell-action">
                      <Link className="btn btn-outline btn-sm" to="/admin/pressings">Schedule</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
