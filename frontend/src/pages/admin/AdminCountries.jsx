import { useEffect, useState } from 'react';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';

const EMPTY_COUNTRY = { code: '', label: '', currency: '', symbol: '' };

export default function AdminCountries() {
  const { token } = useAuth();
  const [countries, setCountries] = useState([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  function load() {
    api.admin.getCountryCatalog(token).then((d) => setCountries(d.countries)).catch(() => {});
  }
  useEffect(load, [token]);

  function setCountry(i, key, value) {
    setCountries((list) => list.map((c, idx) => (idx === i ? { ...c, [key]: value } : c)));
  }

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      const d = await api.admin.updateCountryCatalog(token, countries);
      setCountries(d.countries);
      setMessage({ type: 'success', text: 'Country list updated.' });
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="admin-head">
        <h1>Countries &amp; Currencies</h1>
      </div>
      <p className="muted">
        Controls every country/currency selector across the site (header, footer, welcome popup, checkout
        address, product country-price overrides) plus which currencies appear on the Currency Rates page.
        Add a country with its 2-letter code (e.g. "JP"), a display name, its 3-letter currency code (e.g.
        "JPY"), and a symbol (e.g. "¥"). The currency code is checked against the live exchange-rate
        provider when you save — one entry must be INR (India), since checkout always charges in ₹.
      </p>

      {message && <div className={`alert alert-${message.type}`}>{message.text}</div>}

      <div className="admin-card">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Country code</th>
              <th>Display name</th>
              <th>Currency code</th>
              <th>Symbol</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {countries.map((c, i) => (
              <tr key={i}>
                <td>
                  <input
                    value={c.code}
                    maxLength={2}
                    placeholder="e.g. JP"
                    onChange={(e) => setCountry(i, 'code', e.target.value.toUpperCase())}
                  />
                </td>
                <td>
                  <input
                    value={c.label}
                    placeholder="e.g. Japan"
                    onChange={(e) => setCountry(i, 'label', e.target.value)}
                  />
                </td>
                <td>
                  <input
                    value={c.currency}
                    maxLength={3}
                    placeholder="e.g. JPY"
                    onChange={(e) => setCountry(i, 'currency', e.target.value.toUpperCase())}
                  />
                </td>
                <td>
                  <input
                    value={c.symbol}
                    placeholder="e.g. ¥"
                    onChange={(e) => setCountry(i, 'symbol', e.target.value)}
                  />
                </td>
                <td>
                  {countries.length > 1 && (
                    <button
                      type="button"
                      className="link-btn danger"
                      onClick={() => setCountries((list) => list.filter((_, idx) => idx !== i))}
                    >
                      remove
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <button
          type="button"
          className="link-btn"
          onClick={() => setCountries((list) => [...list, { ...EMPTY_COUNTRY }])}
        >
          + add country
        </button>

        <div style={{ marginTop: 16 }}>
          <button type="button" className="btn btn-gold btn-sm" disabled={saving} onClick={save}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </>
  );
}
