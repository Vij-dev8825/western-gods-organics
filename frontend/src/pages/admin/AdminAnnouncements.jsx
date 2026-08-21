/**
 * The lines that scroll along the top of every page.
 *
 * One message per row, because that is how they are shown — a single textarea
 * split on newlines would make the separator between two promises invisible
 * while you were writing them.
 */
import { useEffect, useState } from 'react';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';

/** Enough to show what the bar is for, on a shop that has never set one. */
const SUGGESTIONS = [
  'Free shipping across Tamil Nadu, Karnataka, Andhra Pradesh, Telangana, Kerala & Pondicherry',
  'Free shipping above ₹1499 for the rest of India',
  'Cash on delivery available',
  'Pressed fresh every week at our own mill in Udumalpet',
];

export default function AdminAnnouncements() {
  const { token } = useAuth();
  const [active, setActive] = useState(true);
  const [messages, setMessages] = useState(['']);
  const [speed, setSpeed] = useState(60);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    api.admin
      .getAnnouncements(token)
      .then((d) => {
        const s = d.settings || {};
        setActive(s.active !== false);
        setMessages(s.messages?.length ? s.messages : ['']);
        setSpeed(s.speed || 60);
      })
      .catch(() => {});
  }, [token]);

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const d = await api.admin.saveAnnouncements(token, {
        active,
        messages: messages.map((m) => m.trim()).filter(Boolean),
        speed: Number(speed) || 60,
      });
      setMessages(d.settings.messages.length ? d.settings.messages : ['']);
      setMessage({ type: 'success', text: 'Saved. The bar updates on the next page load.' });
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  }

  const setAt = (i, v) => setMessages((p) => p.map((m, j) => (j === i ? v : m)));
  const removeAt = (i) => setMessages((p) => (p.length === 1 ? [''] : p.filter((_, j) => j !== i)));

  const live = messages.map((m) => m.trim()).filter(Boolean);

  return (
    <>
      <div className="admin-head">
        <h1>Announcement bar</h1>
      </div>

      <p className="muted" style={{ maxWidth: 640, fontSize: '0.85rem' }}>
        The strip that scrolls along the very top of the shop. Each line is shown in turn,
        over and over. Leave it empty and the site falls back to its built-in line rather
        than showing a blank bar.
      </p>

      {message && <div className={`alert alert-${message.type}`}>{message.text}</div>}

      <form className="card" style={{ padding: 18, margin: '18px 0', maxWidth: 680 }} onSubmit={save}>
        {messages.map((m, i) => (
          <div className="field" key={i}>
            <label>Line {i + 1}</label>
            <div className="flex gap-1" style={{ alignItems: 'center' }}>
              <input
                value={m}
                maxLength={200}
                placeholder={SUGGESTIONS[i] || 'e.g. Cash on delivery available'}
                onChange={(e) => setAt(i, e.target.value)}
                style={{ flex: 1 }}
              />
              <button type="button" className="link-btn danger" onClick={() => removeAt(i)}>
                remove
              </button>
            </div>
          </div>
        ))}

        {messages.length < 12 && (
          <button type="button" className="btn btn-outline btn-sm" onClick={() => setMessages((p) => [...p, ''])}>
            + Add a line
          </button>
        )}

        <div className="field" style={{ marginTop: 16 }}>
          <label>Speed</label>
          <input
            type="number"
            min={10}
            max={200}
            value={speed}
            onChange={(e) => setSpeed(e.target.value)}
            style={{ maxWidth: 140 }}
          />
          <p className="muted" style={{ fontSize: '0.8rem', marginTop: 4 }}>
            Pixels a second. 60 is an easy reading pace; below 30 it drags and above
            120 it is hard to finish a line before it leaves.
          </p>
        </div>

        <label className="check-row">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          Show the bar
        </label>

        <div className="btn-row">
          <button className="btn btn-gold btn-sm" disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>

      {live.length > 0 && (
        <div style={{ maxWidth: 680 }}>
          <p className="muted" style={{ fontSize: '0.85rem', marginBottom: 6 }}>
            How it will read, in order:
          </p>
          <div
            style={{
              background: 'var(--forest-deep, #14261b)',
              color: 'rgba(250,246,236,0.9)',
              borderRadius: 8,
              padding: '10px 14px',
              fontSize: '0.78rem',
              overflowX: 'auto',
              whiteSpace: 'nowrap',
            }}
          >
            {live.join('   ·   ')}
          </div>
        </div>
      )}
    </>
  );
}
