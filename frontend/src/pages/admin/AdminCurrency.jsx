import { useEffect, useState } from 'react';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';

const CURRENCY_SYMBOLS = { USD: '$', GBP: '£', CAD: 'C$', AUD: 'A$', SGD: 'S$', MYR: 'RM', AED: 'AED ' };
const CURRENCY_LABELS = {
  USD: 'US Dollar (USA)',
  GBP: 'British Pound (UK)',
  CAD: 'Canadian Dollar (Canada)',
  AUD: 'Australian Dollar (Australia)',
  SGD: 'Singapore Dollar (Singapore)',
  MYR: 'Malaysian Ringgit (Malaysia)',
  AED: 'UAE Dirham (United Arab Emirates)',
};

export default function AdminCurrency() {
  const { token } = useAuth();
  const [currencies, setCurrencies] = useState([]);
  const [liveInrPerUnit, setLiveInrPerUnit] = useState({});
  const [rateInputs, setRateInputs] = useState({});
  const [minOrderInputs, setMinOrderInputs] = useState({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  function load() {
    api.admin.getCurrencyOverrides(token).then((d) => {
      setCurrencies(d.currencies);
      setLiveInrPerUnit(d.liveInrPerUnit);
      setRateInputs(
        Object.fromEntries(d.currencies.map((code) => [code, d.inrPerUnit[code] ? String(d.inrPerUnit[code]) : '']))
      );
      setMinOrderInputs(
        Object.fromEntries(d.currencies.map((code) => [code, d.minOrder[code] ? String(d.minOrder[code]) : '']))
      );
    }).catch(() => {});
  }
  useEffect(load, [token]);

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      const inrPerUnit = Object.fromEntries(
        Object.entries(rateInputs).map(([code, v]) => [code, v ? Number(v) : 0])
      );
      const minOrder = Object.fromEntries(
        Object.entries(minOrderInputs).map(([code, v]) => [code, v ? Number(v) : 0])
      );
      await api.admin.updateCurrencyOverrides(token, { inrPerUnit, minOrder });
      setMessage({ type: 'success', text: 'Currency settings updated.' });
      load();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="admin-head">
        <h1>Currency Rates &amp; Minimum Order</h1>
      </div>
      <p className="muted">
        Prices shown while browsing (Shop, product pages) track the live exchange rate automatically. Set a fixed
        rate to override that for any currency, and/or a minimum order value below which checkout is blocked for
        that country (e.g. to cover higher international shipping costs). Leave a field empty for no restriction —
        checkout always charges the real ₹ (INR) amount either way.
      </p>

      {message && <div className={`alert alert-${message.type}`}>{message.text}</div>}

      <div className="admin-card">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Currency</th>
              <th>Live rate (1 unit = ₹)</th>
              <th>Fixed rate (optional, ₹ per unit)</th>
              <th>Minimum order (optional, in that currency)</th>
            </tr>
          </thead>
          <tbody>
            {currencies.map((code) => (
              <tr key={code}>
                <td><b>{code}</b><div className="muted" style={{ fontSize: '0.75rem' }}>{CURRENCY_LABELS[code] || code}</div></td>
                <td className="muted">{liveInrPerUnit[code] ? `₹${liveInrPerUnit[code]}` : '—'}</td>
                <td>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={rateInputs[code] || ''}
                    onChange={(e) => setRateInputs((s) => ({ ...s, [code]: e.target.value }))}
                    placeholder={liveInrPerUnit[code] ? `Live: ${liveInrPerUnit[code]}` : 'e.g. 83.50'}
                    style={{ maxWidth: 140 }}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={minOrderInputs[code] || ''}
                    onChange={(e) => setMinOrderInputs((s) => ({ ...s, [code]: e.target.value }))}
                    placeholder={`e.g. 25 (${CURRENCY_SYMBOLS[code] || ''})`}
                    style={{ maxWidth: 140 }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <button type="button" className="btn btn-gold btn-sm" disabled={saving} onClick={save} style={{ marginTop: 16 }}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </>
  );
}
