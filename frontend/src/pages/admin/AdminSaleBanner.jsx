import { useEffect, useState } from 'react';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';

// <input type="datetime-local"> wants "YYYY-MM-DDTHH:mm" in local time —
// converting straight from/to a stored ISO string either way.
function toLocalInputValue(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function AdminSaleBanner() {
  const { token } = useAuth();
  const [settings, setSettings] = useState({ active: false, title: '', subtitle: '', endDate: '' });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    api.admin.getSaleBanner(token).then((d) => setSettings(d.settings)).catch(() => {});
  }, [token]);

  async function save() {
    if (settings.active && (!settings.title || !settings.endDate)) {
      setMessage({ type: 'error', text: 'A title and end date are required to switch the banner on.' });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const d = await api.admin.updateSaleBanner(token, settings);
      setSettings(d.settings);
      setMessage({ type: 'success', text: 'Sale banner updated.' });
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="admin-head">
        <h1>Sale Countdown Banner</h1>
      </div>
      <p className="muted">
        A site-wide banner with a live countdown, shown above the announcement bar. Stays hidden until you switch it
        on below — nothing shows by default.
      </p>

      {message && <div className={`alert alert-${message.type}`}>{message.text}</div>}

      <div className="admin-card">
        <label className="check-row">
          <input
            type="checkbox"
            checked={settings.active}
            onChange={(e) => setSettings((s) => ({ ...s, active: e.target.checked }))}
          />
          Show the sale banner
        </label>

        <div className="form-grid" style={{ marginTop: 16 }}>
          <div className="field">
            <label htmlFor="sale-banner-title">Title</label>
            <input
              id="sale-banner-title"
              value={settings.title}
              onChange={(e) => setSettings((s) => ({ ...s, title: e.target.value }))}
              placeholder="e.g. Monsoon Sale — Up to 30% Off"
            />
          </div>
          <div className="field">
            <label htmlFor="sale-banner-subtitle">Subtitle (optional)</label>
            <input
              id="sale-banner-subtitle"
              value={settings.subtitle}
              onChange={(e) => setSettings((s) => ({ ...s, subtitle: e.target.value }))}
              placeholder="e.g. On all cold-pressed oils"
            />
          </div>
        </div>
        <div className="field">
          <label htmlFor="sale-banner-end-date">Ends on</label>
          <input
            id="sale-banner-end-date"
            type="datetime-local"
            value={toLocalInputValue(settings.endDate)}
            onChange={(e) => setSettings((s) => ({ ...s, endDate: e.target.value ? new Date(e.target.value).toISOString() : '' }))}
          />
        </div>

        <button type="button" className="btn btn-gold btn-sm" disabled={saving} onClick={save}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </>
  );
}
