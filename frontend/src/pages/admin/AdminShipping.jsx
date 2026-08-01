import { useEffect, useState } from 'react';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';

export default function AdminShipping() {
  const { token } = useAuth();
  const [settings, setSettings] = useState({ domesticFee: '', domesticFreeThreshold: '', domesticShippingEnabled: true });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    api.admin.getShippingSettings(token).then((d) => setSettings({
      domesticFee: String(d.shippingSettings.domesticFee),
      domesticFreeThreshold: String(d.shippingSettings.domesticFreeThreshold),
      domesticShippingEnabled: d.shippingSettings.domesticShippingEnabled,
    })).catch(() => {});
  }, [token]);

  async function save() {
    const domesticFee = Number(settings.domesticFee);
    const domesticFreeThreshold = Number(settings.domesticFreeThreshold);
    if (!(domesticFee >= 0) || !(domesticFreeThreshold >= 0)) {
      setMessage({ type: 'error', text: 'Shipping fee and free-shipping threshold must be non-negative numbers.' });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const d = await api.admin.updateShippingSettings(token, {
        domesticFee,
        domesticFreeThreshold,
        domesticShippingEnabled: settings.domesticShippingEnabled,
      });
      setSettings({
        domesticFee: String(d.shippingSettings.domesticFee),
        domesticFreeThreshold: String(d.shippingSettings.domesticFreeThreshold),
        domesticShippingEnabled: d.shippingSettings.domesticShippingEnabled,
      });
      setMessage({ type: 'success', text: 'Shipping settings updated.' });
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="admin-head">
        <h1>Domestic Shipping</h1>
      </div>
      <p className="muted">
        The flat shipping fee charged on India orders below the free-shipping threshold. Silver and Gold loyalty
        members keep their own better-than-base free-shipping perks (₹699 / any order) regardless of what's set here
        — this only affects guests and Bronze-tier customers. International shipping fees are set separately, on
        the Currency Rates page.
      </p>

      {message && <div className={`alert alert-${message.type}`}>{message.text}</div>}

      <div className="admin-card">
        <label className="check-row">
          <input
            type="checkbox"
            checked={settings.domesticShippingEnabled}
            onChange={(e) => setSettings((s) => ({ ...s, domesticShippingEnabled: e.target.checked }))}
          />
          Charge shipping on India orders
        </label>
        <p className="muted" style={{ fontSize: '0.85rem' }}>
          Turn this off to make domestic shipping free for everyone, regardless of the fee/threshold below.
        </p>

        <div className="form-grid">
          <div className="field">
            <label>Shipping fee (₹)</label>
            <input
              type="number"
              min="0"
              step="1"
              value={settings.domesticFee}
              onChange={(e) => setSettings((s) => ({ ...s, domesticFee: e.target.value }))}
              placeholder="e.g. 60"
            />
          </div>
          <div className="field">
            <label>Free shipping above (₹)</label>
            <input
              type="number"
              min="0"
              step="1"
              value={settings.domesticFreeThreshold}
              onChange={(e) => setSettings((s) => ({ ...s, domesticFreeThreshold: e.target.value }))}
              placeholder="e.g. 999"
            />
          </div>
        </div>

        <button type="button" className="btn btn-gold btn-sm" disabled={saving} onClick={save}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </>
  );
}
