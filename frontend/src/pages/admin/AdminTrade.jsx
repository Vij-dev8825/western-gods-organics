import { useEffect, useState } from 'react';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

const STAGES = {
  to_visit: 'To visit',
  visited: 'Visited',
  sampling: 'Trying a sample',
  buying: 'Buying',
  not_interested: 'Not interested',
};

const BLANK = { name: '', kind: 'Tiffin centre', area: '', phone: '', stage: 'to_visit', followUpAt: '', notes: '' };
const KINDS = ['Tiffin centre', 'Restaurant', 'Bakery', 'Catering', 'Provision store', 'Hotel', 'Canteen'];

const fmt = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '');

/**
 * Outbound trade.
 *
 * Every lead the shop had until now arrived on its own — a form filled in.
 * Selling a case of oil to a tiffin centre runs the other way: you walk in,
 * leave a sample, and come back on Thursday. This is the list of who and
 * when, and the rate card to leave behind.
 */
export default function AdminTrade() {
  const { token } = useAuth();
  const { showToast } = useToast();
  const [prospects, setProspects] = useState([]);
  const [form, setForm] = useState(BLANK);
  const [editingId, setEditingId] = useState(null);
  const [terms, setTerms] = useState(() => localStorage.getItem('yo_trade_terms')
    || 'Minimum order 5 litres. Delivered free within Udumalpet. Payment on delivery or within 7 days for regular accounts.');
  const [busy, setBusy] = useState(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const d = await api.admin.listProspects(token);
      setProspects(d.prospects);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);
  useEffect(() => { localStorage.setItem('yo_trade_terms', terms); }, [terms]);

  const reset = () => { setForm(BLANK); setEditingId(null); };

  async function submit(e) {
    e.preventDefault();
    setBusy('form');
    try {
      if (editingId) await api.admin.updateProspect(token, editingId, form);
      else await api.admin.createProspect(token, form);
      showToast(editingId ? 'Updated.' : `${form.name} added to the list.`);
      reset();
      load();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setBusy(null);
    }
  }

  async function setStage(p, stage) {
    try {
      await api.admin.updateProspect(token, p.id, { ...p, stage });
      load();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function sendRates(p) {
    setBusy(p.id);
    try {
      const d = await api.admin.sendRateCard(token, p.id, { terms });
      showToast(d.message);
      load();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setBusy(null);
    }
  }

  async function openRateCard() {
    try {
      const url = await api.admin.rateCardPdf(token, terms);
      window.open(url, '_blank', 'noopener');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function remove(p) {
    if (!window.confirm(`Remove ${p.name} from the list?`)) return;
    try {
      await api.admin.deleteProspect(token, p.id);
      if (editingId === p.id) reset();
      load();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  const due = prospects.filter((p) => p.followUpDue);

  return (
    <div>
      <h2>Trade &amp; wholesale</h2>
      <p className="muted" style={{ maxWidth: 640 }}>
        One tiffin centre buying fifteen litres a month is worth thirty retail customers, and it
        reorders without being reminded. This is the list of places to call on, and the rate card
        to leave with them.
      </p>

      <div className="admin-card">
        <h3 style={{ marginTop: 0, fontSize: '1rem' }}>Your rate card</h3>
        <p className="muted" style={{ fontSize: '0.85rem', maxWidth: '62ch' }}>
          Built from the <b>Wholesale ₹</b> you've set on each size in Products — a size without one
          simply doesn't appear, so it can never quote a rate you wouldn't honour.
        </p>
        <div className="field">
          <label htmlFor="trade-terms">Terms printed on it</label>
          <textarea id="trade-terms" rows={2} value={terms} onChange={(e) => setTerms(e.target.value)}
            placeholder="Minimum order, delivery area, payment terms" />
        </div>
        <div className="btn-row">
          <button type="button" className="btn btn-gold btn-sm" onClick={openRateCard}>Open the rate card</button>
        </div>
      </div>

      {due.length > 0 && (
        <div className="alert alert-success" style={{ marginTop: 18 }}>
          <b>{due.length} to call today:</b> {due.map((p) => p.name).join(', ')}
        </div>
      )}

      <form className="card" style={{ padding: 18, margin: '18px 0', maxWidth: 640 }} onSubmit={submit}>
        <h4 style={{ marginTop: 0 }}>{editingId ? 'Edit' : 'Add a place'}</h4>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="trade-name">Name</label>
            <input id="trade-name" required maxLength={120} value={form.name} placeholder="e.g. Sri Krishna Tiffin Centre"
              onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="trade-kind">Kind</label>
            <select id="trade-kind" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
              {KINDS.map((k) => <option key={k}>{k}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="trade-area">Area</label>
            <input id="trade-area" maxLength={80} value={form.area} placeholder="e.g. Udumalpet bus stand"
              onChange={(e) => setForm({ ...form, area: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="trade-phone">Phone</label>
            <input id="trade-phone" maxLength={15} value={form.phone} placeholder="9876543210"
              onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="trade-stage">Where it stands</label>
            <select id="trade-stage" value={form.stage} onChange={(e) => setForm({ ...form, stage: e.target.value })}>
              {Object.entries(STAGES).map(([v, label]) => <option key={v} value={v}>{label}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="trade-followup">Call back on</label>
            <input id="trade-followup" type="date" value={form.followUpAt}
              onChange={(e) => setForm({ ...form, followUpAt: e.target.value })} />
          </div>
        </div>
        <div className="field">
          <label htmlFor="trade-notes">What was said</label>
          <textarea id="trade-notes" rows={2} maxLength={2000} value={form.notes}
            placeholder="e.g. Uses 20L a month, currently buying refined from the market at ₹140/L. Left a 500ml sample."
            onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </div>
        <div className="btn-row">
          <button className="btn btn-gold btn-sm" disabled={busy === 'form'}>
            {busy === 'form' ? 'Saving…' : editingId ? 'Save' : 'Add'}
          </button>
          {editingId && <button type="button" className="btn btn-outline btn-sm" onClick={reset}>Cancel</button>}
        </div>
      </form>

      {loading ? (
        <p className="muted">Loading…</p>
      ) : prospects.length === 0 ? (
        <p className="muted">
          Nobody on the list yet. Add the three places nearest the mill and go and see them.
        </p>
      ) : (
        <div className="table-wrap">
          <table className="admin-table admin-table-stack">
            <thead>
              <tr><th>Place</th><th>Stage</th><th>Call back</th><th>Notes</th><th /></tr>
            </thead>
            <tbody>
              {prospects.map((p) => (
                <tr key={p.id} className={p.followUpDue ? 'row-due' : ''}>
                  <td data-label="Place">
                    <b>{p.name}</b><br />
                    <span className="muted">{[p.kind, p.area].filter(Boolean).join(' · ')}</span>
                    {p.phone && <><br /><a href={`tel:${p.phone}`}>{p.phone}</a></>}
                  </td>
                  <td data-label="Stage">
                    <select className="select" value={p.stage} onChange={(e) => setStage(p, e.target.value)}>
                      {Object.entries(STAGES).map(([v, label]) => <option key={v} value={v}>{label}</option>)}
                    </select>
                  </td>
                  <td data-label="Call back">
                    {p.followUpAt
                      ? <span className={p.followUpDue ? 'proc-soon' : ''}>{fmt(p.followUpAt)}</span>
                      : <span className="muted">—</span>}
                    {p.ratesSentAt && <><br /><span className="muted">rates sent {fmt(p.ratesSentAt)}</span></>}
                  </td>
                  <td data-label="Notes" className="truncate-cell">
                    {p.notes || <span className="muted">—</span>}
                  </td>
                  <td className="cell-action">
                    <div className="row-links">
                      <button type="button" className="link-btn" onClick={() => { setEditingId(p.id); setForm({ ...BLANK, ...p }); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>edit</button>
                      {p.phone && (
                        <button type="button" className="link-btn" disabled={busy === p.id} onClick={() => sendRates(p)}>
                          {busy === p.id ? 'sending…' : 'send rates'}
                        </button>
                      )}
                      <button type="button" className="link-btn danger" onClick={() => remove(p)}>remove</button>
                    </div>
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
