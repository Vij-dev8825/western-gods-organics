import { useEffect, useState } from 'react';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

const BLANK = { name: '', date: '', note: '', productIds: [], leadDays: 5, active: true };

const fmt = (iso) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

/**
 * The festival calendar, entered by hand.
 *
 * Nothing here is computed from a formula on purpose — most of these follow
 * the lunar calendar and move by weeks each year, so a date this app worked
 * out for itself would be quietly wrong every second year, and wrong here
 * means telling a customer to order for a day that isn't the festival.
 */
export default function AdminFestivals() {
  const { token } = useAuth();
  const { showToast } = useToast();
  const [festivals, setFestivals] = useState([]);
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState(BLANK);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const [f, p] = await Promise.all([api.admin.listFestivals(token), api.getProducts({}, token)]);
      setFestivals(f.festivals);
      setProducts(p.products);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  function reset() {
    setForm(BLANK);
    setEditingId(null);
  }

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingId) {
        await api.admin.updateFestival(token, editingId, form);
        showToast('Festival updated.');
      } else {
        await api.admin.createFestival(token, form);
        showToast('Added to the calendar.');
      }
      reset();
      load();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  function edit(f) {
    setEditingId(f.id);
    setForm({
      name: f.name, date: f.date, note: f.note || '',
      productIds: f.productIds || [], leadDays: f.leadDays ?? 5, active: f.active !== false,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function remove(f) {
    if (!window.confirm(`Remove "${f.name}" from the calendar?`)) return;
    try {
      await api.admin.deleteFestival(token, f.id);
      showToast('Removed.');
      if (editingId === f.id) reset();
      load();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  const toggleProduct = (id) => setForm((f) => ({
    ...f,
    productIds: f.productIds.includes(id) ? f.productIds.filter((x) => x !== id) : [...f.productIds, id],
  }));

  return (
    <div>
      <h2>Festival calendar</h2>
      <p className="muted" style={{ maxWidth: 640 }}>
        The days your customers buy oil for. Each one appears on the public calendar with a
        countdown and — the part nobody works out for themselves — the last day to order so it
        arrives in time.
      </p>
      <p className="muted" style={{ maxWidth: 640, fontSize: '0.85rem' }}>
        Dates are typed in rather than calculated. Most of these follow the Tamil lunar calendar
        and move by weeks each year, so they have to come from your calendar, not from a formula
        that would be wrong every second year. <b>Pongal and Tamil New Year barely move; Aadi,
        Karthigai and Deepavali do.</b>
      </p>

      <form className="card" style={{ padding: 18, margin: '18px 0', maxWidth: 640 }} onSubmit={submit}>
        <h4 style={{ marginTop: 0 }}>{editingId ? 'Edit festival' : 'Add a festival'}</h4>
        <div className="field">
          <label>Name</label>
          <input required maxLength={80} value={form.name} placeholder="e.g. Karthigai Deepam"
            onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div className="field">
          <label>Date this year</label>
          <input type="date" required value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })} />
        </div>
        <div className="field">
          <label>Days needed to deliver</label>
          <input type="number" min={0} max={60} value={form.leadDays}
            onChange={(e) => setForm({ ...form, leadDays: e.target.value })} />
          <p className="muted" style={{ fontSize: '0.8rem', marginTop: 4 }}>
            Counted back from the festival to work out the "order by" date shown to customers.
          </p>
        </div>
        <div className="field">
          <label>What to say about it (optional)</label>
          <textarea rows={2} maxLength={400} value={form.note}
            placeholder="e.g. Lamps are lit with sesame oil through the evening — a litre lasts most households the week."
            onChange={(e) => setForm({ ...form, note: e.target.value })} />
        </div>
        <div className="field">
          <label>What it calls for</label>
          <div className="chip-list">
            {products.map((p) => (
              <button
                type="button"
                key={p.id}
                className={`pill selectable ${form.productIds.includes(p.id) ? 'on' : ''}`}
                onClick={() => toggleProduct(p.id)}
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>
        <label className="check-row">
          <input type="checkbox" checked={form.active}
            onChange={(e) => setForm({ ...form, active: e.target.checked })} />
          Show on the public calendar
        </label>
        <div className="btn-row">
          <button className="btn btn-gold btn-sm" disabled={saving}>
            {saving ? 'Saving…' : editingId ? 'Save changes' : 'Add to calendar'}
          </button>
          {editingId && (
            <button type="button" className="btn btn-outline btn-sm" onClick={reset}>Cancel</button>
          )}
        </div>
      </form>

      {loading ? (
        <p className="muted">Loading…</p>
      ) : festivals.length === 0 ? (
        <p className="muted">Nothing on the calendar yet.</p>
      ) : (
        <div className="table-wrap">
          <table className="admin-table admin-table-stack">
            <thead>
              <tr><th>Festival</th><th>Date</th><th>Order by</th><th>Calls for</th><th /></tr>
            </thead>
            <tbody>
              {festivals.map((f) => (
                <tr key={f.id}>
                  <td data-label="Festival">
                    {f.name}
                    {f.active === false && <><br /><span className="muted">hidden</span></>}
                  </td>
                  <td data-label="Date">
                    {fmt(f.date)}<br />
                    <span className="muted">
                      {f.daysAway >= 0 ? `in ${f.daysAway} days` : `${Math.abs(f.daysAway)} days ago`}
                    </span>
                  </td>
                  <td data-label="Order by">
                    {fmt(f.orderBy)}
                    {f.daysAway >= 0 && f.orderingClosed && (
                      <><br /><span className="proc-soon">passed</span></>
                    )}
                  </td>
                  <td data-label="Calls for">{(f.productIds || []).length || <span className="muted">—</span>}</td>
                  <td className="cell-action">
                    <button type="button" className="link-btn" onClick={() => edit(f)}>edit</button>{' '}
                    <button type="button" className="link-btn danger" onClick={() => remove(f)}>remove</button>
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
