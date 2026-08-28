import { useEffect, useState } from 'react';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

const STATE_LABELS = {
  connecting: 'Connecting…',
  qr: 'Waiting for you to scan the QR code',
  open: 'Connected',
  close: 'Disconnected — reconnecting…',
};

function timeAgo(iso) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}

export default function AdminWhatsApp() {
  const { token } = useAuth();
  const { showToast } = useToast();
  const [status, setStatus] = useState(null);
  const [resetting, setResetting] = useState(false);
  const [savingOrdering, setSavingOrdering] = useState(false);
  const [recipients, setRecipients] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const [campaignLog, setCampaignLog] = useState([]);

  function loadRecipients() {
    api.admin.getWhatsAppEligibleRecipients(token).then((d) => {
      setRecipients(d.recipients);
      setSelected(new Set(d.recipients.map((r) => r.phone)));
    }).catch(() => {});
  }
  function loadLog() {
    api.admin.getWhatsAppBroadcastLog(token).then((d) => setCampaignLog(d.log)).catch(() => {});
  }
  useEffect(() => {
    loadRecipients();
    loadLog();
  }, [token]);

  function toggleSelect(phone) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(phone)) next.delete(phone);
      else next.add(phone);
      return next;
    });
  }

  async function handleSend() {
    const phones = [...selected];
    if (!phones.length || !message.trim()) return;
    if (!window.confirm(`Send this message to ${phones.length} customer(s) who messaged you in the last 24 hours? This sends real WhatsApp messages and can't be undone.`)) {
      return;
    }
    setSending(true);
    setLastResult(null);
    try {
      const res = await api.admin.sendWhatsAppBroadcast(token, { phones, message: message.trim() });
      setLastResult(res.log);
      setMessage('');
      showToast(`Sent to ${res.log.sentCount} of ${res.log.requestedCount}.`);
      loadRecipients();
      loadLog();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSending(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    const load = () => api.admin.getWhatsAppStatus(token).then((d) => !cancelled && setStatus(d)).catch(() => {});
    load();
    const id = setInterval(load, 4000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [token]);

  async function handleReset() {
    if (!window.confirm('This disconnects the current WhatsApp number. You\'ll need to scan a new QR code with the number you want to use instead. Continue?')) return;
    setResetting(true);
    try {
      await api.admin.resetWhatsApp(token);
      showToast('Session reset — scan the new QR code below.');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setResetting(false);
    }
  }

  async function toggleOrdering(enabled) {
    if (enabled && !window.confirm(
      'When on, texting "reorder" to this WhatsApp number lets a customer repeat one of their own past orders by replying to a numbered list — it never places an order without an explicit "yes" confirmation, and ignores anything else (so normal support chats here are unaffected). Enable it?'
    )) {
      return;
    }
    setSavingOrdering(true);
    try {
      await api.admin.setWhatsAppOrdering(token, enabled);
      setStatus((s) => ({ ...s, orderingEnabled: enabled }));
      showToast(enabled ? 'WhatsApp reordering enabled.' : 'WhatsApp reordering disabled.');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSavingOrdering(false);
    }
  }

  return (
    <div>
      <div className="section-head">
        <div>
          <span className="eyebrow">Notifications</span>
          <h2>WhatsApp Connection</h2>
        </div>
      </div>

      <div className="form-card" style={{ maxWidth: 480 }}>
        <p className="muted" style={{ marginTop: 0 }}>
          Order updates and login codes are sent from a real WhatsApp number linked here — the same way
          WhatsApp Web works. Scan the QR code below from that phone's WhatsApp app
          (Settings → Linked Devices → Link a Device).
        </p>

        {!status ? (
          <p className="muted">Checking status…</p>
        ) : (
          <>
            <p>
              <b>Status:</b> {STATE_LABELS[status.state] || status.state}
            </p>

            {status.state === 'qr' && status.qr && (
              <div style={{ textAlign: 'center', margin: '20px 0' }}>
                <img src={status.qr} alt="Scan with WhatsApp to link this number" style={{ width: 260, height: 260 }} />
              </div>
            )}

            {status.state === 'open' && (
              <button type="button" className="btn btn-outline btn-sm" onClick={handleReset} disabled={resetting}>
                {resetting ? 'Resetting…' : 'Link a different number'}
              </button>
            )}
          </>
        )}
      </div>

      <div className="form-card" style={{ maxWidth: 480 }}>
        <h3 style={{ marginTop: 0 }}>WhatsApp Reordering</h3>
        <p className="muted">
          When on, a customer can text <b>"reorder"</b> to this number and repeat one of their own past
          orders from a numbered list — nothing is placed without an explicit "yes" confirmation, and any
          other message is left alone for you to answer as usual.
        </p>
        {status && (
          <label className="flex" style={{ alignItems: 'center', gap: 10 }}>
            <input
              type="checkbox"
              checked={!!status.orderingEnabled}
              disabled={savingOrdering}
              onChange={(e) => toggleOrdering(e.target.checked)}
            />
            {status.orderingEnabled ? 'Enabled' : 'Disabled'}
          </label>
        )}
      </div>

      <div className="form-card" style={{ maxWidth: 560 }}>
        <h3 style={{ marginTop: 0 }}>Broadcast (safe mode)</h3>
        <p className="muted">
          Only sends to customers who've messaged this number themselves in the last 24 hours — the same
          window WhatsApp's own Business API uses for replies. Keeping to it here means outbound traffic still
          looks like normal conversation rather than a marketing blast, which is what risks this number getting
          banned and taking your OTP/order notifications down with it.
        </p>

        {recipients.length === 0 ? (
          <p className="muted">No one has messaged this number in the last 24 hours.</p>
        ) : (
          <>
            <div style={{ maxHeight: 220, overflowY: 'auto', border: '1px solid rgba(0,0,0,0.12)', borderRadius: 8, padding: 8, marginBottom: 12 }}>
              {recipients.map((r) => (
                <label key={r.phone} className="flex gap-2" style={{ alignItems: 'center', padding: '4px 0', fontWeight: 400 }}>
                  <input type="checkbox" checked={selected.has(r.phone)} onChange={() => toggleSelect(r.phone)} />
                  <span>
                    <b>{r.name || r.phone}</b>{r.name ? ` (${r.phone})` : ''}
                    <span className="muted" style={{ fontSize: '0.78rem', marginLeft: 8 }}>{timeAgo(r.lastInboundAt)}</span>
                  </span>
                </label>
              ))}
            </div>

            <div className="field">
              <label htmlFor="broadcast-message">Message</label>
              <textarea
                id="broadcast-message"
                rows={4}
                maxLength={1000}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="What would you like to say?"
              />
            </div>

            <button type="button" className="btn btn-gold" disabled={sending || !selected.size || !message.trim()} onClick={handleSend}>
              {sending ? 'Sending…' : `Send to ${selected.size} selected`}
            </button>
          </>
        )}

        {lastResult && (
          <p className="muted" style={{ marginTop: 12 }}>
            Last campaign: sent to {lastResult.sentCount} of {lastResult.requestedCount}
            {lastResult.skippedCount > 0 ? ` (${lastResult.skippedCount} skipped)` : ''}.
          </p>
        )}
      </div>

      {campaignLog.length > 0 && (
        <div className="form-card" style={{ maxWidth: 560 }}>
          <h3 style={{ marginTop: 0 }}>Recent campaigns</h3>
          <table className="admin-table">
            <thead>
              <tr><th>Date</th><th>Message</th><th>Sent</th><th>Skipped</th></tr>
            </thead>
            <tbody>
              {campaignLog.slice(0, 10).map((c) => (
                <tr key={c.id}>
                  <td className="muted">{new Date(c.createdAt).toLocaleString('en-IN')}</td>
                  <td style={{ maxWidth: 260 }}>{c.message}</td>
                  <td>{c.sentCount}</td>
                  <td>{c.skippedCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
