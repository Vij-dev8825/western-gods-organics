import { useEffect, useState } from 'react';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { getProductImage } from '../../utils/productImages';

export default function AdminSellers() {
  const { token } = useAuth();
  const [tab, setTab] = useState('applications');
  const [applications, setApplications] = useState([]);
  const [sellers, setSellers] = useState([]);
  const [pendingProducts, setPendingProducts] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [activeSellerId, setActiveSellerId] = useState(null);
  const [thread, setThread] = useState({ seller: null, messages: [] });
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [rateDrafts, setRateDrafts] = useState({}); // { [applicationId]: '10' }
  const [noteDrafts, setNoteDrafts] = useState({}); // { [applicationId]: 'note' }
  const [payoutDrafts, setPayoutDrafts] = useState({}); // { [sellerId]: { amount, note } }
  const [message, setMessage] = useState(null);

  function load() {
    api.admin.getSellerApplications(token).then((d) => setApplications(d.applications)).catch(() => {});
    api.admin.getSellers(token).then((d) => setSellers(d.sellers)).catch(() => {});
    api.admin.getPendingSellerProducts(token).then((d) => setPendingProducts(d.products)).catch(() => {});
    api.admin.getSellerConversations(token).then((d) => setConversations(d.conversations)).catch(() => {});
  }
  useEffect(load, [token]);

  // Opening a thread marks its seller messages read server-side, so refresh
  // the conversation list afterwards to clear that row's unread badge.
  useEffect(() => {
    if (!activeSellerId) return;
    api.admin
      .getSellerThread(token, activeSellerId)
      .then((d) => {
        setThread({ seller: d.seller, messages: d.messages });
        api.admin.getSellerConversations(token).then((c) => setConversations(c.conversations)).catch(() => {});
      })
      .catch(() => {});
  }, [activeSellerId, token]);

  async function sendReply(e) {
    e.preventDefault();
    const text = replyText.trim();
    if (!text) return;
    setSending(true);
    try {
      const res = await api.admin.sendSellerMessage(token, activeSellerId, text);
      setThread((t) => ({ ...t, messages: [...t.messages, res.message] }));
      setReplyText('');
      load();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSending(false);
    }
  }

  async function decide(app, status) {
    const payload = { status };
    if (status === 'approved') {
      const rate = Number(rateDrafts[app.id] ?? 10);
      if (!(rate >= 0) || rate > 100) {
        window.alert('Enter a platform fee rate between 0 and 100.');
        return;
      }
      payload.platformFeeRate = rate;
    } else {
      payload.reviewNote = noteDrafts[app.id] || '';
    }
    try {
      await api.admin.decideSellerApplication(token, app.id, payload);
      load();
    } catch (err) {
      window.alert(err.message);
    }
  }

  function payoutDraftFor(id) {
    return payoutDrafts[id] || { amount: '', note: '' };
  }

  async function recordPayout(s) {
    const draft = payoutDraftFor(s.id);
    const amount = Number(draft.amount);
    if (!(amount > 0)) {
      setMessage({ type: 'error', text: 'Enter a payout amount greater than ₹0.' });
      return;
    }
    try {
      await api.admin.recordSellerPayout(token, s.id, { amount, note: draft.note });
      setPayoutDrafts((d) => ({ ...d, [s.id]: { amount: '', note: '' } }));
      setMessage({ type: 'success', text: `Recorded ₹${amount} payout to ${s.sellerBusinessName}.` });
      load();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  }

  async function moderate(p, approve) {
    await api.admin.moderateSellerProduct(token, p.id, approve).catch(() => {});
    load();
  }

  const pendingApplicationsCount = applications.filter((a) => a.status === 'pending').length;

  return (
    <>
      <div className="admin-head">
        <h1>Sellers</h1>
      </div>

      <div className="tab-row">
        {[
          ['applications', `Applications (${pendingApplicationsCount})`],
          ['sellers', `Sellers (${sellers.length})`],
          ['pending-products', `Pending products (${pendingProducts.length})`],
          ['chat', `Chat (${conversations.reduce((sum, c) => sum + c.unread, 0)})`],
        ].map(([key, label]) => (
          <button key={key} className={`tab ${tab === key ? 'active' : ''}`} onClick={() => setTab(key)}>
            {label}
          </button>
        ))}
      </div>

      {message && <div className={`alert alert-${message.type}`}>{message.text}</div>}

      {tab === 'applications' && (
        <div className="admin-card">
          {applications.length === 0 ? <p className="muted">No seller applications yet.</p> : (
            <table className="admin-table">
              <thead>
                <tr><th>Business</th><th>Contact</th><th>What they'll sell</th><th>Status</th><th>Decision</th></tr>
              </thead>
              <tbody>
                {applications.map((a) => (
                  <tr key={a.id}>
                    <td><b>{a.businessName}</b></td>
                    <td>{a.phone}</td>
                    <td style={{ maxWidth: 260 }}>{a.whatTheySell}</td>
                    <td>
                      <span className={`pill ${a.status === 'approved' ? 'status-placed' : a.status === 'rejected' ? '' : 'warn'}`}>
                        {a.status}
                      </span>
                    </td>
                    <td>
                      {a.status === 'pending' ? (
                        <div className="flex gap-1" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            placeholder="Fee %"
                            value={rateDrafts[a.id] ?? ''}
                            onChange={(e) => setRateDrafts((d) => ({ ...d, [a.id]: e.target.value }))}
                            style={{ width: 64 }}
                          />
                          <button className="link-btn" onClick={() => decide(a, 'approved')}>approve</button>
                          <input
                            placeholder="Reject note (optional)"
                            value={noteDrafts[a.id] ?? ''}
                            onChange={(e) => setNoteDrafts((d) => ({ ...d, [a.id]: e.target.value }))}
                            style={{ width: 140 }}
                          />
                          <button className="link-btn danger" onClick={() => decide(a, 'rejected')}>reject</button>
                        </div>
                      ) : (
                        <span className="muted">{a.reviewNote || '—'}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'sellers' && (
        <div className="admin-card">
          {sellers.length === 0 ? <p className="muted">No approved sellers yet.</p> : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Business</th><th>Fee rate</th><th>Probation</th><th>Balance owed</th>
                  <th>Lifetime earned</th><th>Lifetime paid</th><th>Record payout</th>
                </tr>
              </thead>
              <tbody>
                {sellers.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <b>{s.sellerBusinessName}</b>
                      <div className="muted" style={{ fontSize: '0.75rem' }}>{s.contactPhone || s.phone}</div>
                      {s.contactEmail && <div className="muted" style={{ fontSize: '0.72rem' }}>{s.contactEmail}</div>}
                      <details style={{ marginTop: 4 }}>
                        <summary className="link-btn" style={{ fontSize: '0.72rem' }}>details</summary>
                        <div className="muted" style={{ fontSize: '0.72rem', lineHeight: 1.6, marginTop: 4 }}>
                          {s.address && <div>📍 {s.address}</div>}
                          {s.gstin && <div>GSTIN: {s.gstin}</div>}
                          {s.fssai && <div>FSSAI: {s.fssai}</div>}
                          {s.upiId && <div><b>UPI:</b> {s.upiId}</div>}
                          {s.bankAccountNumber && (
                            <div><b>Bank:</b> {s.bankAccountName} · {s.bankAccountNumber} · {s.bankIfsc}</div>
                          )}
                          {!s.upiId && !s.bankAccountNumber && (
                            <div className="pill warn" style={{ fontSize: '0.68rem' }}>No payout details yet</div>
                          )}
                        </div>
                      </details>
                    </td>
                    <td>{s.sellerPlatformFeeRate}%</td>
                    <td>
                      {s.sellerProbationRemaining > 0
                        ? `${s.sellerProbationRemaining} left`
                        : <span className="muted">Auto-trusted</span>}
                    </td>
                    <td><b>₹{s.balance}</b></td>
                    <td>₹{s.totalEarned}</td>
                    <td>₹{s.totalPaid}</td>
                    <td>
                      <div className="flex gap-1">
                        <input
                          type="number"
                          min="0"
                          placeholder="₹"
                          value={payoutDraftFor(s.id).amount}
                          onChange={(e) => setPayoutDrafts((d) => ({ ...d, [s.id]: { ...payoutDraftFor(s.id), amount: e.target.value } }))}
                          style={{ width: 70 }}
                        />
                        <input
                          placeholder="Note (optional)"
                          value={payoutDraftFor(s.id).note}
                          onChange={(e) => setPayoutDrafts((d) => ({ ...d, [s.id]: { ...payoutDraftFor(s.id), note: e.target.value } }))}
                          style={{ width: 110 }}
                        />
                        <button className="link-btn" onClick={() => recordPayout(s)} disabled={s.balance <= 0}>pay</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'pending-products' && (
        <div className="admin-card">
          {pendingProducts.length === 0 ? <p className="muted">No listings waiting for review.</p> : (
            <table className="admin-table">
              <thead>
                <tr><th /><th>Product</th><th>Seller</th><th>Price</th><th>Decision</th></tr>
              </thead>
              <tbody>
                {pendingProducts.map((p) => (
                  <tr key={p.id}>
                    <td>
                      {p.image && (
                        <img
                          src={getProductImage(p.image)}
                          alt=""
                          style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 6 }}
                        />
                      )}
                    </td>
                    <td>
                      <b>{p.name}</b>
                      <div className="muted" style={{ fontSize: '0.75rem' }}>{p.category}</div>
                    </td>
                    <td>{p.sellerName}</td>
                    <td>₹{p.sizes[0]?.price}</td>
                    <td>
                      <button className="link-btn" onClick={() => moderate(p, true)}>approve</button>{' '}
                      <button className="link-btn danger" onClick={() => moderate(p, false)}>reject</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'chat' && (
        <div className="admin-two-col">
          <div className="admin-card">
            <h3 style={{ marginTop: 0 }}>Conversations</h3>
            {conversations.length === 0 ? (
              <p className="muted">No seller messages yet.</p>
            ) : (
              conversations.map((c) => (
                <button
                  key={c.sellerId}
                  type="button"
                  className={`chat-conv ${activeSellerId === c.sellerId ? 'active' : ''}`}
                  onClick={() => setActiveSellerId(c.sellerId)}
                >
                  <span className="flex-between">
                    <b>{c.sellerName}</b>
                    {c.unread > 0 && <span className="badge-count static">{c.unread}</span>}
                  </span>
                  <span className="muted" style={{ fontSize: '0.78rem', display: 'block' }}>{c.lastMessage}</span>
                  <span className="muted" style={{ fontSize: '0.7rem' }}>
                    {new Date(c.lastAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: 'numeric', minute: '2-digit' })}
                  </span>
                </button>
              ))
            )}
          </div>

          <div className="admin-card">
            {!activeSellerId ? (
              <p className="muted">Pick a conversation to read and reply.</p>
            ) : (
              <>
                <h3 style={{ marginTop: 0 }}>{thread.seller?.name || 'Seller'}</h3>
                <div style={{ maxHeight: 420, overflowY: 'auto', marginBottom: 14 }}>
                  {thread.messages.length === 0 ? (
                    <p className="muted">No messages in this thread.</p>
                  ) : (
                    thread.messages.map((m) => (
                      <div
                        key={m.id}
                        style={{
                          display: 'flex',
                          justifyContent: m.from === 'admin' ? 'flex-end' : 'flex-start',
                          marginBottom: 10,
                        }}
                      >
                        <div
                          style={{
                            maxWidth: '75%',
                            padding: '9px 13px',
                            borderRadius: 14,
                            background: m.from === 'admin' ? 'var(--forest)' : 'var(--cream-deep)',
                            color: m.from === 'admin' ? 'var(--paper)' : 'var(--ink)',
                            fontSize: '0.88rem',
                            lineHeight: 1.5,
                          }}
                        >
                          <div style={{ whiteSpace: 'pre-wrap' }}>{m.text}</div>
                          <div style={{ fontSize: '0.68rem', opacity: 0.7, marginTop: 4 }}>
                            {new Date(m.createdAt).toLocaleString('en-IN', {
                              day: '2-digit', month: 'short', hour: 'numeric', minute: '2-digit',
                            })}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <form onSubmit={sendReply} className="flex gap-1" style={{ alignItems: 'flex-start' }}>
                  <textarea
                    rows={2}
                    placeholder="Type your reply…"
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    style={{ flex: 1 }}
                  />
                  <button className="btn btn-gold btn-sm" disabled={sending || !replyText.trim()}>
                    {sending ? 'Sending…' : 'Send'}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
