import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';

/**
 * Who your customers are, and which of them you are losing.
 *
 * The Leads page already listed everyone with an account. This is the other
 * question: of those people, who has actually bought, what are they worth, and
 * how long since they last did. Sorted by lifetime value on open, because
 * "who matters" is what you came here to find out.
 */

const STATUS_LABEL = {
  active: 'Active',
  lapsing: 'Slipping',
  lapsed: 'Lapsed',
  never: 'Never ordered',
};

function money(n) {
  return '₹' + Number(n || 0).toLocaleString('en-IN');
}

function when(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function quiet(days) {
  if (days == null) return '—';
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  return days + ' days ago';
}

export default function AdminCustomers() {
  const { token } = useAuth();
  const [customers, setCustomers] = useState([]);
  const [segments, setSegments] = useState([]);
  const [segment, setSegment] = useState('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('lifetimeValue');
  const [open, setOpen] = useState(null); // the customer whose detail is showing
  const [detail, setDetail] = useState(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    api.admin
      .getCustomers(token)
      .then((d) => {
        setCustomers(d.customers || []);
        setSegments(d.segments || []);
      })
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(load, [load]);

  // The segment tests live on the server, so rather than reimplement them here
  // — and risk the list disagreeing with what a broadcast would actually reach
  // — filter on the status and flags the server already computed.
  const inSegment = useCallback((c, key) => {
    switch (key) {
      case 'all': return true;
      case 'active': return c.status === 'active';
      case 'lapsing': return c.status === 'lapsing';
      case 'lapsed': return c.status === 'lapsed';
      case 'never-ordered': return c.status === 'never';
      case 'vip': return c.isVip;
      case 'wholesale': return c.isWholesale;
      case 'repeat': return c.orderCount > 1;
      default: return true;
    }
  }, []);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return customers
      .filter((c) => inSegment(c, segment))
      .filter((c) =>
        !q ||
        c.name.toLowerCase().includes(q) ||
        c.phone.includes(q) ||
        c.email.toLowerCase().includes(q)
      )
      .sort((a, b) => {
        if (sort === 'lifetimeValue') return b.lifetimeValue - a.lifetimeValue;
        if (sort === 'orderCount') return b.orderCount - a.orderCount;
        if (sort === 'recent') {
          // Never-ordered has no last order; park those at the end rather than
          // letting null sort to the top as if they were the freshest.
          if (a.daysSinceLastOrder == null) return 1;
          if (b.daysSinceLastOrder == null) return -1;
          return a.daysSinceLastOrder - b.daysSinceLastOrder;
        }
        return (a.name || '').localeCompare(b.name || '');
      });
  }, [customers, segment, query, sort, inSegment]);

  function show(c) {
    setOpen(c);
    setDetail(null);
    setNoteDraft(c.note || '');
    api.admin.getCustomer(token, c.id).then(setDetail).catch(() => setDetail(null));
  }

  async function saveNote() {
    if (!open) return;
    setSaving(true);
    try {
      await api.admin.setCustomerNote(token, open.id, noteDraft);
      setCustomers((prev) => prev.map((c) => (c.id === open.id ? { ...c, note: noteDraft } : c)));
      setOpen((o) => (o ? { ...o, note: noteDraft } : o));
    } finally {
      setSaving(false);
    }
  }

  const totals = useMemo(() => {
    const buyers = customers.filter((c) => c.orderCount > 0);
    const value = buyers.reduce((s, c) => s + c.lifetimeValue, 0);
    return {
      buyers: buyers.length,
      value,
      avg: buyers.length ? Math.round(value / buyers.length) : 0,
    };
  }, [customers]);

  return (
    <div className="admin-page">
      <div className="admin-head">
        <h1>Customers</h1>
        <p className="muted">
          {customers.length} accounts · {totals.buyers} have ordered · {money(totals.value)} lifetime
          {totals.buyers ? ` · ${money(totals.avg)} each on average` : ''}
        </p>
      </div>

      <div className="crm-segments">
        {segments.map((s) => (
          <button
            key={s.key}
            type="button"
            className={`crm-seg ${segment === s.key ? 'on' : ''}`}
            onClick={() => setSegment(s.key)}
            title={s.label}
          >
            {s.label.split('—')[0].trim()}
            <span className="crm-seg-n">{s.count}</span>
          </button>
        ))}
      </div>

      <div className="crm-controls">
        <input
          type="search"
          placeholder="Search name, phone or email"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort by">
          <option value="lifetimeValue">Most valuable</option>
          <option value="orderCount">Most orders</option>
          <option value="recent">Most recent order</option>
          <option value="name">Name</option>
        </select>
      </div>

      {loading ? (
        <p className="muted">Loading…</p>
      ) : !shown.length ? (
        <p className="muted">No customers in this segment.</p>
      ) : (
        <div className="table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th className="num">Lifetime</th>
                <th className="num">Orders</th>
                <th className="num">Avg</th>
                <th>Last order</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((c) => (
                <tr key={c.id} onClick={() => show(c)} className="crm-row">
                  <td>
                    <b>{c.name || '(no name)'}</b>
                    {c.isVip && <span className="crm-tag vip">VIP</span>}
                    {c.isWholesale && <span className="crm-tag">Wholesale</span>}
                    {c.note && <span className="crm-tag note" title={c.note}>Note</span>}
                    <div className="muted small">{c.phone}{c.email ? ` · ${c.email}` : ''}</div>
                  </td>
                  <td className="num">{money(c.lifetimeValue)}</td>
                  <td className="num">{c.orderCount}</td>
                  <td className="num">{c.orderCount ? money(c.avgOrderValue) : '—'}</td>
                  <td>{quiet(c.daysSinceLastOrder)}</td>
                  <td><span className={`crm-status ${c.status}`}>{STATUS_LABEL[c.status]}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {open && (
        <div className="crm-drawer-backdrop" onClick={() => setOpen(null)}>
          <aside className="crm-drawer" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="crm-close" onClick={() => setOpen(null)} aria-label="Close">×</button>
            <h2>{open.name || '(no name)'}</h2>
            <p className="muted">{open.phone}{open.email ? ` · ${open.email}` : ''}</p>

            <div className="crm-stats">
              <div><span>{money(open.lifetimeValue)}</span><small>lifetime</small></div>
              <div><span>{open.orderCount}</span><small>orders</small></div>
              <div><span>{open.orderCount ? money(open.avgOrderValue) : '—'}</span><small>average</small></div>
              <div><span>{quiet(open.daysSinceLastOrder)}</span><small>last ordered</small></div>
            </div>

            <label className="crm-note-label" htmlFor="crm-note">
              Private note — never shown to the customer
            </label>
            <textarea
              id="crm-note"
              rows={3}
              value={noteDraft}
              placeholder="Prefers delivery after 6pm. Runs the canteen on SH 97."
              onChange={(e) => setNoteDraft(e.target.value)}
            />
            <button type="button" className="btn" onClick={saveNote} disabled={saving || noteDraft === (open.note || '')}>
              {saving ? 'Saving…' : 'Save note'}
            </button>

            <h3>Orders</h3>
            {!detail ? (
              <p className="muted">Loading…</p>
            ) : !detail.orders?.length ? (
              <p className="muted">Signed up {when(open.createdAt)} and hasn't ordered yet.</p>
            ) : (
              <ul className="crm-orders">
                {detail.orders.map((o) => (
                  <li key={o.id}>
                    <div className="crm-order-top">
                      <b>{o.orderNumber}</b>
                      <span>{money(o.total)}</span>
                    </div>
                    <div className="muted small">
                      {when(o.createdAt)} · {o.status}
                      {o.paymentStatus ? ` · ${o.paymentStatus}` : ''}
                    </div>
                    {!!o.items?.length && (
                      <div className="muted small">
                        {o.items.map((i) => `${i.quantity}× ${i.name}${i.size ? ` (${i.size})` : ''}`).join(', ')}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
