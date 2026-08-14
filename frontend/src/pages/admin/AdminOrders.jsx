import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { printPackingSlips } from '../../utils/packingSlip';

const STATUSES = ['placed', 'confirmed', 'shipped', 'delivered', 'cancelled'];
const PAGE_SIZE = 50;

export default function AdminOrders() {
  const { token } = useAuth();
  const [orders, setOrders] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [message, setMessage] = useState(null);
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(null);
  const [selected, setSelected] = useState(() => new Set());

  // `search` is what's typed; `query` is what's actually been sent. Kept apart
  // so a search only fires on submit — otherwise every keystroke is a request.
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const load = useCallback(() => {
    api.admin.getOrders(token, { search: query, status, from, to, page, limit: PAGE_SIZE })
      .then((d) => { setOrders(d.orders); setTotal(d.total); })
      .catch(() => {});
  }, [token, query, status, from, to, page]);
  useEffect(load, [load]);

  // Any change to the filters puts us back on page one — staying on page 4 of
  // a result set that now has two pages just shows an empty table.
  function applyFilters(e) {
    e?.preventDefault();
    setSelected(new Set());
    setPage(1);
    setQuery(search);
  }
  function changeFilter(setter) {
    return (value) => { setSelected(new Set()); setPage(1); setter(value); };
  }
  function clearAll() {
    setSearch(''); setQuery(''); setStatus(''); setFrom(''); setTo('');
    setSelected(new Set()); setPage(1);
  }

  async function resendInvoice(o) {
    setSending(o.id);
    setMessage(null);
    try {
      const d = await api.admin.sendInvoice(token, o.id);
      setMessage({ type: 'success', text: `${o.orderNumber}: ${d.message}` });
      load();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSending(null);
    }
  }

  async function openInvoice(o) {
    try {
      const url = await api.admin.invoicePdf(token, o.id);
      window.open(url, '_blank', 'noopener');
      // Held in memory until revoked; long enough for the new tab to load it.
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  }

  async function setStatusFor(o, next) {
    setMessage(null);
    try {
      await api.admin.updateOrderStatus(token, o.id, next);
      setMessage({ type: 'success', text: `Order ${o.orderNumber} marked "${next}" — customer notified.` });
      load();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  }

  function toggle(id) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  const allShown = orders.length > 0 && orders.every((o) => selected.has(o.id));
  function toggleAll() {
    setSelected(allShown ? new Set() : new Set(orders.map((o) => o.id)));
  }

  // Sequential, not Promise.all: each one emails and WhatsApps the customer,
  // and firing fifty of those at once is how you get rate-limited.
  async function bulkStatus(next) {
    const ids = orders.filter((o) => selected.has(o.id));
    if (!ids.length) return;
    if (!window.confirm(`Mark ${ids.length} order(s) as "${next}"? Each customer gets notified.`)) return;
    setBusy(true);
    setMessage(null);
    let done = 0;
    const failed = [];
    for (const o of ids) {
      try {
        await api.admin.updateOrderStatus(token, o.id, next);
        done += 1;
      } catch {
        failed.push(o.orderNumber);
      }
    }
    setBusy(false);
    setSelected(new Set());
    setMessage(failed.length
      ? { type: 'error', text: `${done} updated. Failed: ${failed.join(', ')}` }
      : { type: 'success', text: `${done} order(s) marked "${next}".` });
    load();
  }

  const selectedOrders = orders.filter((o) => selected.has(o.id));
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const filtering = !!(query || status || from || to);

  return (
    <>
      <div className="admin-head">
        <h1>Orders</h1>
        <span className="muted" style={{ fontSize: '0.85rem' }}>
          {total} order{total === 1 ? '' : 's'}{filtering ? ' match' : ''}
        </span>
      </div>

      {message && <div className={`alert alert-${message.type}`}>{message.text}</div>}

      <form className="admin-card order-filters" onSubmit={applyFilters}>
        <div className="field" style={{ flex: '2 1 220px' }}>
          <label>Search</label>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Order number, name, phone or product"
          />
        </div>
        <div className="field" style={{ flex: '1 1 130px' }}>
          <label>Status</label>
          <select className="select" value={status} onChange={(e) => changeFilter(setStatus)(e.target.value)}>
            <option value="">Any</option>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="field" style={{ flex: '1 1 130px' }}>
          <label>From</label>
          <input type="date" value={from} onChange={(e) => changeFilter(setFrom)(e.target.value)} />
        </div>
        <div className="field" style={{ flex: '1 1 130px' }}>
          <label>To</label>
          <input type="date" value={to} onChange={(e) => changeFilter(setTo)(e.target.value)} />
        </div>
        <div className="flex gap-1">
          <button className="btn btn-gold btn-sm">Search</button>
          {filtering && <button type="button" className="btn btn-ghost btn-sm" onClick={clearAll}>Clear</button>}
        </div>
      </form>

      {selected.size > 0 && (
        <div className="admin-card bulk-bar">
          <b>{selected.size} selected</b>
          <button type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={() => bulkStatus('confirmed')}>
            Mark confirmed
          </button>
          <button type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={() => bulkStatus('shipped')}>
            Mark shipped
          </button>
          <button type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={() => bulkStatus('delivered')}>
            Mark delivered
          </button>
          <button type="button" className="btn btn-gold btn-sm" onClick={() => printPackingSlips(selectedOrders)}>
            Print packing slips
          </button>
          {busy && <span className="muted">Working…</span>}
        </div>
      )}

      <div className="admin-card">
        {orders.length === 0 ? (
          <p className="muted">{filtering ? 'No orders match those filters.' : 'No orders yet.'}</p>
        ) : (
          <>
            {/* admin-table-stack: on a phone this stops being a table and
                becomes one card per order. Packing orders is the job most
                likely to be done standing up with a phone in one hand, and a
                six-column table puts the status control off the right edge —
                you had to swipe sideways to reach the only thing you came to
                change. The data-label on each cell is what the stacked layout
                prints in place of the column heading. */}
            <table className="admin-table admin-table-stack">
              <thead>
                <tr>
                  <th style={{ width: 32 }}>
                    <input type="checkbox" checked={allShown} onChange={toggleAll} aria-label="Select all on this page" />
                  </th>
                  <th>Order</th><th>Customer</th><th>Items</th><th>Total</th>
                  <th>Status → change (notifies customer)</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td className="cell-select">
                      <input
                        type="checkbox"
                        checked={selected.has(o.id)}
                        onChange={() => toggle(o.id)}
                        aria-label={`Select order ${o.orderNumber}`}
                      />
                    </td>
                    <td data-label="Order">
                      <b>{o.orderNumber}</b>
                      <div className="muted" style={{ fontSize: '0.75rem' }}>
                        {new Date(o.createdAt).toLocaleString('en-IN')}
                      </div>
                    </td>
                    <td data-label="Customer">
                      {o.customer?.name || o.address?.name || '—'}
                      <div className="muted" style={{ fontSize: '0.75rem' }}>{o.customer?.phone || o.address?.phone}</div>
                    </td>
                    <td data-label="Items">
                      {o.items.map((i) => (
                        <div key={`${i.productId}-${i.size}`} style={{ fontSize: '0.82rem' }}>
                          {i.quantity}× {i.name} ({i.size})
                        </div>
                      ))}
                      {o.isGift && (
                        <div className="muted" style={{ fontSize: '0.75rem', marginTop: 4 }}>
                          🎁 Gift{o.giftMessage ? `: "${o.giftMessage}"` : ''}
                        </div>
                      )}
                      {o.giftCardApplied > 0 && (
                        <div className="muted" style={{ fontSize: '0.75rem', marginTop: 4 }}>
                          Gift card {o.giftCardCode} applied: −₹{o.giftCardApplied}
                        </div>
                      )}
                      {o.affiliateCode && (
                        <div className="muted" style={{ fontSize: '0.75rem', marginTop: 4 }}>
                          🤝 Affiliate: {o.affiliateCode}
                        </div>
                      )}
                      {o.source === 'counter' && (
                        <div className="muted" style={{ fontSize: '0.75rem', marginTop: 4 }}>
                          ☎️ Taken by phone or at the counter
                        </div>
                      )}
                      {/* Whatever was said while the order was being taken —
                          "leave it with the neighbour" is only useful to the
                          person packing it, so it belongs beside the items. */}
                      {o.note && (
                        <div className="muted" style={{ fontSize: '0.75rem', marginTop: 4 }}>
                          📝 {o.note}
                        </div>
                      )}
                      {/* Loud on purpose. A collection order that gets packed
                          onto the courier run is a delivery paid for twice and
                          a customer standing at the mill for nothing. */}
                      {o.shippingChoice === 'pickup' && (
                        <div className="collect-flag">🏭 COLLECTING — do not courier</div>
                      )}
                    </td>
                    <td data-label="Total">
                      ₹{o.total}
                      {o.paymentMethod === 'cod_advance' && (
                        <div className="muted" style={{ fontSize: '0.72rem' }}>
                          ₹{o.advancePaid} paid · ₹{o.total - o.advancePaid} cash due
                        </div>
                      )}
                      {o.paymentMethod === 'razorpay' && (
                        <div className="muted" style={{ fontSize: '0.72rem' }}>Paid online</div>
                      )}
                      {o.paymentMethod === 'counter' && (
                        <div className="muted" style={{ fontSize: '0.72rem' }}>Paid at the mill</div>
                      )}
                    </td>
                    <td data-label="Status — changing this notifies the customer" className="cell-action">
                      <select className="select" value={o.status} onChange={(e) => setStatusFor(o, e.target.value)}>
                        {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                      {/* The bill goes out by itself when an order is marked
                          delivered. This is for "I never got it", or an email
                          address given after the fact. */}
                      <div className="row-links">
                        <button type="button" className="link-btn" disabled={sending === o.id} onClick={() => resendInvoice(o)}>
                          {sending === o.id ? 'Sending…' : o.invoiceSentAt ? 'Send bill again' : 'Send bill'}
                        </button>
                        <button type="button" className="link-btn" onClick={() => openInvoice(o)}>print</button>
                      </div>
                      {o.invoiceSentAt && (
                        <div className="muted" style={{ fontSize: '0.7rem' }}>
                          Bill sent {new Date(o.invoiceSentAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {pages > 1 && (
              <div className="flex gap-2" style={{ alignItems: 'center', marginTop: 14, flexWrap: 'wrap' }}>
                <button
                  type="button" className="btn btn-outline btn-sm"
                  disabled={page <= 1}
                  onClick={() => { setSelected(new Set()); setPage((p) => p - 1); }}
                >
                  ← Newer
                </button>
                <span className="muted">Page {page} of {pages}</span>
                <button
                  type="button" className="btn btn-outline btn-sm"
                  disabled={page >= pages}
                  onClick={() => { setSelected(new Set()); setPage((p) => p + 1); }}
                >
                  Older →
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
