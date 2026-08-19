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

/** Shortens a browser string to the part that identifies the device, which is
 *  the part that matters when a fault turns out to be one version of one
 *  browser missing an API. */
function device(ua) {
  if (!ua) return '—';
  const os = ua.match(/iPhone OS (\d+[._]\d+)|Android (\d+)|Windows NT ([\d.]+)|Mac OS X (\d+[._]\d+)/);
  const br = ua.match(/(Chrome|CriOS|Firefox|Edg|Version)\/(\d+)/);
  const osName = os
    ? os[1] ? `iOS ${os[1].replace('_', '.')}`
      : os[2] ? `Android ${os[2]}`
      : os[3] ? 'Windows' : `macOS ${String(os[4]).replace('_', '.')}`
    : '';
  const brName = br ? `${br[1] === 'Version' ? 'Safari' : br[1] === 'CriOS' ? 'Chrome' : br[1]} ${br[2]}` : '';
  return [osName, brName].filter(Boolean).join(' · ') || ua.slice(0, 40);
}

export default function AdminAudit() {
  const { token } = useAuth();
  const [entries, setEntries] = useState(null);
  const [errors, setErrors] = useState(null);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(null);

  useEffect(() => {
    api.admin
      .auditLog(token)
      .then((d) => setEntries(d.entries || []))
      .catch((err) => setError(err.message));
    api.admin
      .clientErrors(token)
      .then((d) => setErrors(d.errors || []))
      .catch(() => setErrors([])); // never let this hide the activity log
  }, [token]);

  if (error) return <div className="alert alert-error">{error}</div>;

  return (
    <div>
      <div className="section-head">
        <div>
          <span className="eyebrow">Health</span>
          <h2>What broke for customers</h2>
        </div>
      </div>
      <p className="muted" style={{ marginTop: -8, maxWidth: '64ch' }}>
        Script errors caught in real browsers, grouped so the same fault is one
        row however often it happens. An empty table is the good outcome.
      </p>

      {!errors && <p className="muted">Loading…</p>}
      {errors && errors.length === 0 && (
        <p className="muted">
          Nothing reported. This only sees faults that happen after it was
          switched on, so it will read empty until something actually breaks.
        </p>
      )}
      {errors && errors.length > 0 && (
        <div style={{ overflowX: 'auto', marginBottom: 32 }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Last seen</th>
                <th>Error</th>
                <th>Page</th>
                <th>Device</th>
                <th>Times</th>
              </tr>
            </thead>
            <tbody>
              {errors.map((e) => (
                <tr key={e.id}>
                  <td style={{ whiteSpace: 'nowrap' }}>{when(e.lastSeen)}</td>
                  <td style={{ maxWidth: 380 }}>
                    <div>{e.message}</div>
                    {e.source && (
                      <div className="muted" style={{ fontSize: '0.75rem' }}>
                        {e.source}{e.line ? `:${e.line}` : ''}
                      </div>
                    )}
                  </td>
                  <td className="muted">{e.path || '—'}</td>
                  <td className="muted" style={{ fontSize: '0.8rem' }}>{device(e.userAgent)}</td>
                  <td style={{ fontVariantNumeric: 'tabular-nums' }}>{e.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

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
