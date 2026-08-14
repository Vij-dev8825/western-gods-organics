/**
 * What customers said privately after their parcel arrived.
 *
 * Sorted so anything still needing a person is at the top and stays there
 * until it's marked dealt with. A feedback screen that reads as a scoreboard
 * gets glanced at; one that reads as a queue gets worked.
 */
import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

const FACE = { 1: '😞', 2: '🙁', 3: '😐', 4: '🙂', 5: '😄' };

const when = (iso) =>
  new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

export default function AdminFeedback() {
  const { token } = useAuth();
  const { showToast } = useToast();
  const [data, setData] = useState(null);
  const [busyId, setBusyId] = useState('');

  const load = useCallback(() => {
    api.admin.getFeedback(token).then(setData).catch(() => {});
  }, [token]);

  useEffect(load, [load]);

  async function handled(id) {
    setBusyId(id);
    try {
      await api.admin.markFeedbackHandled(token, id);
      showToast('Marked as dealt with.');
      load();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setBusyId('');
    }
  }

  if (!data) {
    return (
      <div>
        <div className="section-head"><div><span className="eyebrow">Customers</span><h2>Feedback</h2></div></div>
        <p className="muted">Loading…</p>
      </div>
    );
  }

  const { feedback, summary } = data;

  return (
    <div>
      <div className="section-head">
        <div><span className="eyebrow">Customers</span><h2>Feedback</h2></div>
      </div>
      <p className="muted" style={{ marginTop: -8, maxWidth: '62ch' }}>
        Sent privately by customers the day after their parcel arrived. It is not published
        anywhere — the public review request goes out separately, a week later, to everyone.
      </p>

      {summary.count === 0 ? (
        <div className="form-card" style={{ maxWidth: 620, marginTop: 18 }}>
          <p style={{ margin: 0 }}>Nothing yet.</p>
          <p className="muted" style={{ fontSize: '0.86rem', marginBottom: 0 }}>
            The ask goes out automatically a few hours after you mark an order delivered,
            by WhatsApp and in the app. Nothing to switch on.
          </p>
        </div>
      ) : (
        <>
          <div className="stat-grid" style={{ marginTop: 18 }}>
            <div className="stat-card">
              <span className="stat-label">Average</span>
              <b className="stat-value">{summary.average} / 5</b>
            </div>
            <div className="stat-card">
              <span className="stat-label">Replies</span>
              <b className="stat-value">{summary.count}</b>
            </div>
            <div className="stat-card">
              <span className="stat-label">Needing a person</span>
              <b className="stat-value">{summary.open}</b>
            </div>
          </div>

          <div className="table-wrap" style={{ marginTop: 20, overflowX: 'auto' }}>
            <table className="admin-table admin-table-stack">
              <thead>
                <tr>
                  <th>Rating</th><th>Customer</th><th>What they said</th><th>When</th><th />
                </tr>
              </thead>
              <tbody>
                {feedback.map((f) => {
                  const open = f.needsAttention && !f.handledAt;
                  return (
                    <tr key={f.id} style={open ? { background: 'rgba(168,70,43,0.06)' } : undefined}>
                      <td data-label="Rating">
                        <span style={{ fontSize: '1.3rem' }} aria-hidden="true">{FACE[f.rating]}</span>{' '}
                        <b>{f.rating}/5</b>
                      </td>
                      <td data-label="Customer">
                        {f.customerName || '—'}
                        <div className="muted" style={{ fontSize: '0.75rem' }}>
                          {f.customerPhone}<br />{f.orderNumber}
                        </div>
                      </td>
                      <td data-label="What they said">
                        {f.issues.length > 0 && (
                          <div style={{ fontSize: '0.8rem', marginBottom: 4 }}>
                            {f.issues.map((i) => (
                              <span key={i} className="pill pill-warn" style={{ marginRight: 4 }}>{i}</span>
                            ))}
                          </div>
                        )}
                        {f.comment ? <span style={{ fontSize: '0.86rem' }}>{f.comment}</span>
                          : <span className="muted" style={{ fontSize: '0.82rem' }}><i>No comment left</i></span>}
                      </td>
                      <td data-label="When"><span className="muted" style={{ fontSize: '0.8rem' }}>{when(f.createdAt)}</span></td>
                      <td>
                        {open ? (
                          <button
                            type="button" className="btn btn-outline btn-sm"
                            disabled={busyId === f.id} onClick={() => handled(f.id)}
                          >
                            {busyId === f.id ? 'Saving…' : 'Dealt with'}
                          </button>
                        ) : f.handledAt ? (
                          <span className="muted" style={{ fontSize: '0.78rem' }}>Dealt with</span>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
