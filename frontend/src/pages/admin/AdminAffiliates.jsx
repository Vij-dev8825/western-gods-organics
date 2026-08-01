import { useEffect, useState } from 'react';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';

export default function AdminAffiliates() {
  const { token } = useAuth();
  const [affiliates, setAffiliates] = useState([]);
  const [payoutDrafts, setPayoutDrafts] = useState({}); // { [id]: { amount, note } }
  const [message, setMessage] = useState(null);

  function load() {
    api.admin.getAffiliates(token).then((d) => setAffiliates(d.affiliates)).catch(() => {});
  }
  useEffect(load, [token]);

  function draftFor(id) {
    return payoutDrafts[id] || { amount: '', note: '' };
  }

  async function recordPayout(a) {
    const draft = draftFor(a.id);
    const amount = Number(draft.amount);
    if (!(amount > 0)) {
      setMessage({ type: 'error', text: 'Enter a payout amount greater than ₹0.' });
      return;
    }
    try {
      await api.admin.recordAffiliatePayout(token, a.id, { amount, note: draft.note });
      setPayoutDrafts((d) => ({ ...d, [a.id]: { amount: '', note: '' } }));
      setMessage({ type: 'success', text: `Recorded ₹${amount} payout to ${a.name}.` });
      load();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  }

  return (
    <>
      <div className="admin-head">
        <h1>Affiliates</h1>
      </div>
      <p className="muted">
        Grant a customer affiliate status from Enquiries &amp; Leads → Customers. Commission is credited here once an
        order attributed to them is marked delivered — record a payout below once you've actually paid them (bank
        transfer/UPI, done outside this app).
      </p>

      {message && <div className={`alert alert-${message.type}`}>{message.text}</div>}

      <div className="admin-card">
        {affiliates.length === 0 ? (
          <p className="muted">No affiliates yet.</p>
        ) : (
          <table className="admin-table">
            <thead>
              <tr><th>Name</th><th>Code</th><th>Rate</th><th>Balance owed</th><th>Lifetime earned</th><th>Lifetime paid</th><th>Record payout</th></tr>
            </thead>
            <tbody>
              {affiliates.map((a) => (
                <tr key={a.id}>
                  <td>
                    <b>{a.name || '—'}</b>
                    <div className="muted" style={{ fontSize: '0.75rem' }}>{a.phone}</div>
                  </td>
                  <td><code>{a.affiliateCode}</code></td>
                  <td>{a.commissionRate}%</td>
                  <td><b>₹{a.balance}</b></td>
                  <td>₹{a.totalEarned}</td>
                  <td>₹{a.totalPaid}</td>
                  <td>
                    {a.isAffiliate ? (
                      <div className="flex gap-1">
                        <input
                          type="number"
                          min="0"
                          placeholder="₹"
                          value={draftFor(a.id).amount}
                          onChange={(e) => setPayoutDrafts((d) => ({ ...d, [a.id]: { ...draftFor(a.id), amount: e.target.value } }))}
                          style={{ width: 70 }}
                        />
                        <input
                          placeholder="Note (optional)"
                          value={draftFor(a.id).note}
                          onChange={(e) => setPayoutDrafts((d) => ({ ...d, [a.id]: { ...draftFor(a.id), note: e.target.value } }))}
                          style={{ width: 110 }}
                        />
                        <button className="link-btn" onClick={() => recordPayout(a)} disabled={a.balance <= 0}>pay</button>
                      </div>
                    ) : (
                      <span className="muted">Revoked</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
