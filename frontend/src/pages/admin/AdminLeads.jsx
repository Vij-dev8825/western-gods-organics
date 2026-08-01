import { useEffect, useState } from 'react';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';

// Enquiries submitted before the multi-product form existed used a flat
// productCategory/quantity/unit shape instead of an items array — read
// either so old leads still display correctly without a data migration.
function enquiryItems(e2) {
  if (Array.isArray(e2.items) && e2.items.length) return e2.items;
  if (e2.productCategory) return [{ productCategory: e2.productCategory, quantity: e2.quantity, unit: e2.unit }];
  return [];
}

export default function AdminLeads() {
  const { token } = useAuth();
  const [tab, setTab] = useState('enquiries');
  const [enquiries, setEnquiries] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [rateDrafts, setRateDrafts] = useState({}); // { [customerId]: '10' } — draft commission rate before granting

  function load() {
    api.admin.getEnquiries(token).then((d) => setEnquiries(d.enquiries)).catch(() => {});
    api.admin.getContacts(token).then((d) => setContacts(d.contacts)).catch(() => {});
    api.admin.getCustomers(token).then((d) => setCustomers(d.customers)).catch(() => {});
  }
  useEffect(load, [token]);

  async function setStatus(e2, status) {
    await api.admin.updateEnquiry(token, e2.id, status).catch(() => {});
    load();
  }

  async function toggleWholesale(c) {
    await api.admin.setCustomerWholesale(token, c.id, !c.isWholesale).catch(() => {});
    load();
  }

  async function grantAffiliate(c) {
    const rate = Number(rateDrafts[c.id] ?? c.commissionRate ?? 10);
    if (!(rate > 0) || rate > 100) {
      window.alert('Enter a commission rate between 0 and 100.');
      return;
    }
    await api.admin.setCustomerAffiliate(token, c.id, { isAffiliate: true, commissionRate: rate }).catch(() => {});
    load();
  }

  async function revokeAffiliate(c) {
    await api.admin.setCustomerAffiliate(token, c.id, { isAffiliate: false }).catch(() => {});
    load();
  }

  return (
    <>
      <div className="admin-head">
        <h1>Enquiries & Leads</h1>
      </div>

      <div className="tab-row">
        {[
          ['enquiries', `Bulk enquiries (${enquiries.length})`],
          ['contacts', `Contact messages (${contacts.length})`],
          ['customers', `Customers (${customers.length})`],
        ].map(([key, label]) => (
          <button key={key} className={`tab ${tab === key ? 'active' : ''}`} onClick={() => setTab(key)}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'enquiries' && (
        <div className="admin-card">
          {enquiries.length === 0 ? <p className="muted">No bulk enquiries yet.</p> : (
            <table className="admin-table">
              <thead>
                <tr><th>Name</th><th>Contact</th><th>Wants</th><th>Message</th><th>Status</th></tr>
              </thead>
              <tbody>
                {enquiries.map((e2) => (
                  <tr key={e2.id}>
                    <td>
                      <b>{e2.name}</b>
                      {e2.enquiryNumber && <div className="muted" style={{ fontSize: '0.72rem' }}>{e2.enquiryNumber}</div>}
                      {e2.company && <div className="muted" style={{ fontSize: '0.75rem' }}>{e2.company}</div>}
                    </td>
                    <td>{e2.phone}<div className="muted" style={{ fontSize: '0.75rem' }}>{e2.email}</div></td>
                    <td>
                      {enquiryItems(e2).map((it, idx) => (
                        <div key={idx}>{it.quantity} {it.unit} of {it.productCategory}</div>
                      ))}
                      {(e2.country || e2.city) && (
                        <div className="muted" style={{ fontSize: '0.75rem' }}>
                          {[e2.city, e2.country].filter(Boolean).join(', ')}
                        </div>
                      )}
                      {e2.gstin && <div className="muted" style={{ fontSize: '0.75rem' }}>GST: {e2.gstin}</div>}
                      {(e2.sampleRequested || e2.privateLabel) && (
                        <div className="muted" style={{ fontSize: '0.75rem' }}>
                          {[e2.sampleRequested && 'Sample requested', e2.privateLabel && 'Private label'].filter(Boolean).join(' · ')}
                        </div>
                      )}
                    </td>
                    <td style={{ maxWidth: 220 }}>{e2.message}</td>
                    <td>
                      <select className="select" value={e2.status} onChange={(ev) => setStatus(e2, ev.target.value)}>
                        {['new', 'contacted', 'quoted', 'won', 'lost'].map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'contacts' && (
        <div className="admin-card">
          {contacts.length === 0 ? <p className="muted">No contact messages yet.</p> : (
            <table className="admin-table">
              <thead>
                <tr><th>Name</th><th>Email / phone</th><th>Subject</th><th>Message</th><th>When</th></tr>
              </thead>
              <tbody>
                {contacts.map((c) => (
                  <tr key={c.id}>
                    <td><b>{c.name}</b></td>
                    <td>{c.email}<div className="muted" style={{ fontSize: '0.75rem' }}>{c.phone}</div></td>
                    <td>{c.subject}</td>
                    <td style={{ maxWidth: 260 }}>{c.message}</td>
                    <td className="muted">{new Date(c.createdAt).toLocaleDateString('en-IN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'customers' && (
        <div className="admin-card">
          {customers.length === 0 ? <p className="muted">No customers yet.</p> : (
            <table className="admin-table">
              <thead>
                <tr><th>Name</th><th>Phone</th><th>Email</th><th>Joined</th><th>Wholesale</th><th>Affiliate</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {customers.map((c) => (
                  <tr key={c.id}>
                    <td><b>{c.name || '—'}</b></td>
                    <td>{c.phone}</td>
                    <td>{c.email || '—'}</td>
                    <td className="muted">{new Date(c.createdAt).toLocaleDateString('en-IN')}</td>
                    <td>
                      {c.isWholesale ? <span className="pill status-placed">Wholesale</span> : <span className="muted">Retail</span>}
                    </td>
                    <td>
                      {c.isAffiliate ? (
                        <span className="pill status-placed">{c.affiliateCode} · {c.commissionRate}%</span>
                      ) : c.affiliateCode ? (
                        <span className="muted">Revoked ({c.affiliateCode})</span>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td>
                      <button className="link-btn" onClick={() => toggleWholesale(c)}>
                        {c.isWholesale ? 'revoke wholesale' : 'grant wholesale'}
                      </button>
                      <br />
                      {c.isAffiliate ? (
                        <button className="link-btn danger" onClick={() => revokeAffiliate(c)}>revoke affiliate</button>
                      ) : (
                        <span className="flex gap-1" style={{ alignItems: 'center', marginTop: 4 }}>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            placeholder="Rate %"
                            value={rateDrafts[c.id] ?? ''}
                            onChange={(e) => setRateDrafts((d) => ({ ...d, [c.id]: e.target.value }))}
                            style={{ width: 64 }}
                          />
                          <button className="link-btn" onClick={() => grantAffiliate(c)}>grant affiliate</button>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </>
  );
}
