import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

const WINDOWS = [7, 30, 90, 365];
const rupees = (n) => `₹${Math.round(n || 0).toLocaleString('en-IN')}`;

/**
 * What the shop kept, not what it took.
 *
 * Every other screen here counts sales. This one subtracts: what the goods
 * cost to make, what the gateway skimmed, and what a seller or affiliate is
 * owed out of the sale. Deliberately blunt about what it doesn't know — an
 * order whose cost was never recorded is left out of the margin and said so,
 * rather than being counted as free to produce and quietly inflating the
 * number the owner is about to make decisions on.
 */
export default function AdminProfit() {
  const { token } = useAuth();
  const { showToast } = useToast();
  const [days, setDays] = useState(30);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(null);

  useEffect(() => {
    let live = true;
    setLoading(true);
    api.admin.profit(token, days)
      .then((d) => { if (live) setReport(d.report); })
      .catch((err) => showToast(err.message, 'error'))
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [token, days]);

  async function download(what, label) {
    setDownloading(what);
    try {
      const url = await api.admin.exportCsv(token, what, what === 'orders' ? days : null);
      const a = document.createElement('a');
      a.href = url;
      a.download = `western-gods-${what}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      // The blob is held in memory until this is called — without it every
      // export in a session leaks a copy of the file.
      setTimeout(() => URL.revokeObjectURL(url), 30000);
      showToast(`${label} downloaded.`);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setDownloading(null);
    }
  }

  const t = report?.totals;
  const knownAll = t && t.ordersMissingCost === 0;

  return (
    <>
      <div className="admin-head">
        <h1>Profit</h1>
        <div className="seg">
          {WINDOWS.map((d) => (
            <button key={d} type="button" className={days === d ? 'on' : ''} onClick={() => setDays(d)}>
              {d === 365 ? '1 year' : `${d} days`}
            </button>
          ))}
        </div>
      </div>
      <p className="muted" style={{ maxWidth: '62ch' }}>
        Counts orders placed in this window that have been <b>delivered</b> — money that arrived and stayed.
        Orders still on their way are listed separately, because that money isn't yours yet.
      </p>

      {loading && <p className="muted">Working it out…</p>}

      {!loading && report && (
        <>
          {t.orders === 0 ? (
            <div className="admin-card">
              <p className="muted" style={{ margin: 0 }}>
                No delivered orders in the last {report.days} days, so there is nothing to add up yet.
              </p>
            </div>
          ) : (
            <>
              <div className="profit-flow">
                {/* Every figure in this row covers the same set of orders — the
                    ones that could be costed — so the subtraction reconciles.
                    Mixing in revenue whose cost is unknown would show a total
                    that doesn't follow from the line above it. */}
                <div className="profit-step">
                  <span className="k">Goods sold</span>
                  <b>{rupees(t.goodsRevenueKnown)}</b>
                  <span className="muted">
                    {t.ordersWithKnownCost} delivered order{t.ordersWithKnownCost === 1 ? '' : 's'}
                  </span>
                </div>
                <div className="profit-step out">
                  <span className="k">Cost to make</span>
                  <b>−{rupees(t.goodsCost)}</b>
                  <span className="muted">seed, bottle, label</span>
                </div>
                <div className="profit-step out">
                  <span className="k">Payment fees</span>
                  <b>−{rupees(t.gatewayFeeKnown)}</b>
                  <span className="muted">
                    {report.gatewayFeeRate > 0
                      ? `${report.gatewayFeeRate}% on online payments`
                      : <>not set — <Link to="/admin/payment-methods">add your rate</Link></>}
                  </span>
                </div>
                <div className="profit-step out">
                  <span className="k">Owed to others</span>
                  <b>−{rupees(t.owedOutKnown)}</b>
                  <span className="muted">sellers and affiliates</span>
                </div>
                <div className={`profit-step total ${t.margin < 0 ? 'negative' : ''}`}>
                  <span className="k">You kept</span>
                  <b>{rupees(t.margin)}</b>
                  <span className="muted">
                    {t.goodsRevenueKnown > 0 ? `${Math.round((t.margin / t.goodsRevenueKnown) * 100)}% of goods sold` : ''}
                  </span>
                </div>
              </div>

              {!knownAll && (
                <div className="alert alert-error" style={{ marginTop: 16 }}>
                  <b>
                    A further {rupees(t.revenueMissingCost)} of sales is not in the figures above.
                  </b>{' '}
                  {t.ordersMissingCost} of the {t.orders} delivered orders {t.ordersMissingCost === 1 ? 'contains' : 'contain'}{' '}
                  a product with no cost recorded, so what {t.ordersMissingCost === 1 ? 'it was' : 'they were'} worth
                  can't be worked out — and counting those sales while ignoring their cost would overstate
                  what you kept. Everything above covers the other{' '}
                  {t.ordersWithKnownCost}. Fill in Cost ₹ on the sizes listed below and orders from then on
                  will count.
                </div>
              )}

              <div className="profit-flow" style={{ marginTop: 12 }}>
                <div className="profit-step">
                  <span className="k">Delivery collected</span>
                  <b>{rupees(t.shipping)}</b>
                  <span className="muted">not counted as profit — compare it with your courier bills</span>
                </div>
                <div className="profit-step">
                  <span className="k">Still on its way</span>
                  <b>{rupees(report.inFlight.charged)}</b>
                  <span className="muted">{report.inFlight.orders} order(s) not yet delivered</span>
                </div>
                <div className="profit-step">
                  <span className="k">Came to nothing</span>
                  <b>{rupees(report.lost.charged)}</b>
                  <span className="muted">{report.lost.orders} cancelled or refunded</span>
                </div>
              </div>

              <h2 style={{ marginTop: 28, fontSize: '1.05rem' }}>What each size earned</h2>
              <div className="table-wrap">
                <table className="admin-table admin-table-stack">
                  <thead>
                    <tr>
                      <th>Product</th><th>Units</th><th>Sold for</th><th>Cost</th><th>Kept</th><th>Margin</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.lines.map((l) => (
                      <tr key={`${l.productId}|${l.size}`}>
                        <td data-label="Product">{l.name}<br /><span className="muted">{l.size}</span></td>
                        <td data-label="Units">{l.units}</td>
                        <td data-label="Sold for">{rupees(l.revenue)}</td>
                        <td data-label="Cost">{l.costKnown ? rupees(l.cost) : <span className="muted">not set</span>}</td>
                        <td data-label="Kept">{l.costKnown ? <b>{rupees(l.margin)}</b> : <span className="muted">—</span>}</td>
                        <td data-label="Margin">{l.costKnown ? `${l.marginPercent}%` : <span className="muted">—</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {report.missingCost.length > 0 && (
            <div className="admin-card" style={{ marginTop: 22 }}>
              <h3 style={{ marginTop: 0, fontSize: '1rem' }}>
                {report.missingCost.length} size{report.missingCost.length === 1 ? '' : 's'} with no cost recorded
              </h3>
              <p className="muted" style={{ fontSize: '0.85rem' }}>
                Until each has a Cost ₹ in <Link to="/admin/products">Products</Link>, orders containing it
                can't be counted. Costs apply from the moment you set them — orders already placed keep the
                cost they were placed with, so past months don't change when you update a price.
              </p>
              <div className="chip-list">
                {report.missingCost.slice(0, 30).map((m) => (
                  <span className="pill" key={`${m.productId}|${m.size}`}>{m.name} · {m.size}</span>
                ))}
                {report.missingCost.length > 30 && (
                  <span className="muted">+ {report.missingCost.length - 30} more</span>
                )}
              </div>
            </div>
          )}
        </>
      )}

      <h2 style={{ marginTop: 30, fontSize: '1.05rem' }}>Download as a spreadsheet</h2>
      <p className="muted" style={{ maxWidth: '62ch' }}>
        Opens in Excel, Google Sheets or LibreOffice. Orders come out one row per item, which is the shape
        that lets you total by product, month or state without retyping anything.
      </p>
      <div className="btn-row">
        <button type="button" className="btn btn-gold btn-sm" disabled={!!downloading} onClick={() => download('orders', 'Orders')}>
          {downloading === 'orders' ? 'Preparing…' : `Orders (last ${days} days)`}
        </button>
        <button type="button" className="btn btn-outline btn-sm" disabled={!!downloading} onClick={() => download('products', 'Products')}>
          {downloading === 'products' ? 'Preparing…' : 'Products & stock'}
        </button>
        <button type="button" className="btn btn-outline btn-sm" disabled={!!downloading} onClick={() => download('customers', 'Customers')}>
          {downloading === 'customers' ? 'Preparing…' : 'Customers'}
        </button>
      </div>
    </>
  );
}
