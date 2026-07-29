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

export default function AdminWhatsApp() {
  const { token } = useAuth();
  const { showToast } = useToast();
  const [status, setStatus] = useState(null);
  const [resetting, setResetting] = useState(false);
  const [savingOrdering, setSavingOrdering] = useState(false);

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
    </div>
  );
}
