import { useEffect, useState } from 'react';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';

const EMPTY_REVIEW = { author: '', rating: 5, text: '', relativeTime: '' };
const EMPTY_SETTINGS = { rating: '', reviewCount: '', mapsUrl: '', reviews: [] };

export default function AdminHomepageReviews() {
  const { token } = useAuth();
  const [settings, setSettings] = useState(EMPTY_SETTINGS);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    api.admin.getHomepageReviews(token).then((d) => setSettings(d.settings)).catch(() => {});
  }, [token]);

  function setReview(i, key, value) {
    setSettings((s) => ({
      ...s,
      reviews: s.reviews.map((r, idx) => (idx === i ? { ...r, [key]: value } : r)),
    }));
  }

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      const d = await api.admin.updateHomepageReviews(token, settings);
      setSettings(d.settings);
      setMessage({ type: 'success', text: 'Homepage reviews updated.' });
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="admin-head">
        <h1>Homepage Reviews Showcase</h1>
      </div>
      <p className="muted">
        A manually-curated "Google Reviews" trust section shown on the homepage — copy your real aggregate
        rating, total review count, and a few genuine quotes from your actual Google Business listing. Stays
        hidden until you add at least one review below.
      </p>

      {message && <div className={`alert alert-${message.type}`}>{message.text}</div>}

      <div className="admin-card">
        <div className="form-grid">
          <div className="field">
            <label htmlFor="homepage-review-rating">Aggregate rating (e.g. 4.8)</label>
            <input
              id="homepage-review-rating"
              type="number"
              min="0"
              max="5"
              step="0.1"
              value={settings.rating || ''}
              onChange={(e) => setSettings((s) => ({ ...s, rating: e.target.value }))}
            />
          </div>
          <div className="field">
            <label htmlFor="homepage-review-count">Total review count</label>
            <input
              id="homepage-review-count"
              type="number"
              min="0"
              value={settings.reviewCount || ''}
              onChange={(e) => setSettings((s) => ({ ...s, reviewCount: e.target.value }))}
            />
          </div>
          <div className="field">
            <label htmlFor="homepage-review-maps-url">Google Maps listing URL (optional)</label>
            <input
              id="homepage-review-maps-url"
              value={settings.mapsUrl || ''}
              onChange={(e) => setSettings((s) => ({ ...s, mapsUrl: e.target.value }))}
              placeholder="https://maps.app.goo.gl/…"
            />
          </div>
        </div>

        <label style={{ fontWeight: 600, fontSize: '0.85rem' }}>Review quotes</label>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Author</th>
              <th style={{ width: 90 }}>Rating</th>
              <th>Text</th>
              <th style={{ width: 140 }}>When (e.g. "2 weeks ago")</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {settings.reviews.map((r, i) => (
              <tr key={i}>
                <td><input aria-label="Author name" value={r.author} onChange={(e) => setReview(i, 'author', e.target.value)} /></td>
                <td>
                  <select aria-label="Rating" value={r.rating} onChange={(e) => setReview(i, 'rating', Number(e.target.value))}>
                    {[5, 4, 3, 2, 1].map((n) => (
                      <option key={n} value={n}>{n} ★</option>
                    ))}
                  </select>
                </td>
                <td><textarea aria-label="Review text" value={r.text} onChange={(e) => setReview(i, 'text', e.target.value)} rows={2} /></td>
                <td>
                  <input
                    aria-label="Relative time (e.g. 2 weeks ago)"
                    value={r.relativeTime}
                    onChange={(e) => setReview(i, 'relativeTime', e.target.value)}
                    placeholder="2 weeks ago"
                  />
                </td>
                <td>
                  <button
                    type="button"
                    className="link-btn danger"
                    onClick={() => setSettings((s) => ({ ...s, reviews: s.reviews.filter((_, idx) => idx !== i) }))}
                  >
                    remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <button
          type="button"
          className="link-btn"
          onClick={() => setSettings((s) => ({ ...s, reviews: [...s.reviews, { ...EMPTY_REVIEW }] }))}
        >
          + add review
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
