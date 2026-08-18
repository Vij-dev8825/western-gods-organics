/**
 * Who changed what, and when.
 *
 * Until now nothing recorded it. If a price moved or a stock count went to
 * zero, there was no way to tell whether it was you last Tuesday, a mistake in
 * a form, or something else — and "I don't know who did that" is a bad answer
 * to have available when the shop has more than one pair of hands on it.
 *
 * Reads rather than reconstructs: it records that a product was edited at
 * 14:02 by this account, not the whole row before and after. That is what
 * answers the question people actually ask.
 */
import { useEffect, useState } from 'react';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';

/** Turns /products/castor-oil-1l into something readable at a glance without
 *  losing the identifier, which is usually the bit you are looking for. */
function describe(entry) {
  const verb = { POST: 'Created', PUT: 'Replaced', PATCH: 'Changed', DELETE: 'Deleted' }[entry.method] || entry.method;
  const path = String(entry.path || '').split('?')[0];
  const parts = path.split('/').filter(Boolean);
  if (!parts.length) return `${verb} something`;
  const area = parts[0].replace(/-/g, ' ');
  const rest = parts.slice(1).join(' / ');
  return rest ? `${verb} ${area} — ${rest}` : `${verb} ${area}`;
}

function when(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

export default function AdminAudit() {
  const { token } = useAuth();
  const [entries, setEntries] = useState(null);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(null);

  useEffect(() => {
    api.admin
      .auditLog(token)
      .then((d) => setEntries(d.entries || []))
      .catch((err) => setError(err.message));
  }, [token]);

  if (error) return <div className="alert alert-error">{error}</div>;

  return (
    <div>
      <div className="section-head">
        <div>
          <span className="eyebrow">Records</span>
          <h2>Activity log</h2>
        </div>
      </div>
      <p className="muted" style={{ marginTop: -8, maxWidth: '64ch' }}>
        Every change made through the admin, newest first. Passwords, one-time
        codes and payment signatures are never recorded, and uploads are noted
        rather than stored.
      </p>

      {!entries && <p className="muted">Loading…</p>}

      {entries && entries.length === 0 && (
        <p className="muted">
          Nothing recorded yet. Entries appear here from the next change you make —
          this only sees what happens after it was switched on, so it will look
          empty until you edit something.
        </p>
      )}

      {entries && entries.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>When</th>
                <th>What</th>
                <th>Who</th>
                <th>Result</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id}>
                  <td style={{ whiteSpace: 'nowrap' }}>{when(e.at)}</td>
                  <td>{describe(e)}</td>
                  <td className="muted">{e.actorPhone || e.actorId || '—'}</td>
                  <td>
                    {e.ok ? (
                      <span style={{ color: 'var(--leaf-1)' }}>ok</span>
                    ) : (
                      <span style={{ color: 'var(--danger, #b3261e)' }}>failed ({e.status})</span>
                    )}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="link-btn"
                      onClick={() => setOpen(open === e.id ? null : e.id)}
                    >
                      {open === e.id ? 'hide' : 'details'}
                    </button>
                    {open === e.id && (
                      <pre
                        style={{
                          marginTop: 8, padding: 10, background: 'var(--rail, #f2f5f0)',
                          borderRadius: 6, fontSize: '0.75rem', maxWidth: 460,
                          whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                        }}
                      >
                        {JSON.stringify(e.body, null, 2)}
                      </pre>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
