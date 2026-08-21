import { useEffect, useState } from 'react';
import { DESIGN_CHOICES } from '../../components/festival/registry';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

const BLANK = {
  name: '', date: '', note: '', productIds: [], leadDays: 5, couponCode: '',
  startsDaysBefore: 0, endsDaysAfter: 0, effect: '',
  celebrate: true, theme: '', active: true,
};

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
  const [anim, setAnim] = useState({ enabled: true, scope: 'all', intensity: 'normal' });
  const [savingAnim, setSavingAnim] = useState(false);
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

  useEffect(() => {
    api.admin
      .getFestivalAnimation(token)
      .then((d) => setAnim({
        enabled: d.settings?.enabled !== false,
        scope: d.settings?.scope || 'all',
        intensity: d.settings?.intensity || 'normal',
      }))
      .catch(() => {});
  }, [token]);

  async function saveAnim() {
    setSavingAnim(true);
    setMessage(null);
    try {
      await api.admin.saveFestivalAnimation(token, anim);
      setMessage({ type: 'success', text: 'Animation settings saved.' });
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSavingAnim(false);
    }
  }

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
      productIds: f.productIds || [], leadDays: f.leadDays ?? 5,
      couponCode: f.couponCode || '',
      startsDaysBefore: f.startsDaysBefore ?? 0, endsDaysAfter: f.endsDaysAfter ?? 0,
      effect: f.effect || '',
      celebrate: f.celebrate !== false, theme: f.theme || '',
      active: f.active !== false,
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

      <div className="card" style={{ padding: 18, margin: '18px 0', maxWidth: 640 }}>
        <h4 style={{ marginTop: 0 }}>Animation</h4>
        <p className="muted" style={{ fontSize: '0.85rem', marginTop: -4 }}>
          The flowers, crackers and sparks that drift across the site while a festival
          is on. Nothing shows outside a festival, and nothing shows for a visitor whose
          device asks for reduced motion — that is their choice, not a setting here.
        </p>
        <div className="form-grid">
          <div className="field">
            <label>Where it shows</label>
            <select value={anim.scope} onChange={(e) => setAnim({ ...anim, scope: e.target.value })}>
              <option value="all">Every page</option>
              <option value="home">Home page only</option>
            </select>
          </div>
          <div className="field">
            <label>How much</label>
            <select value={anim.intensity} onChange={(e) => setAnim({ ...anim, intensity: e.target.value })}>
              <option value="subtle">Subtle</option>
              <option value="normal">Normal</option>
              <option value="lively">Lively</option>
            </select>
          </div>
        </div>
        <label className="check-row">
          <input type="checkbox" checked={anim.enabled}
            onChange={(e) => setAnim({ ...anim, enabled: e.target.checked })} />
          Show the animation
        </label>
        <div className="btn-row">
          <button type="button" className="btn btn-gold btn-sm" disabled={savingAnim} onClick={saveAnim}>
            {savingAnim ? 'Saving…' : 'Save animation settings'}
          </button>
        </div>
      </div>

      <form className="card" style={{ padding: 18, margin: '18px 0', maxWidth: 640 }} onSubmit={submit}>
        <h4 style={{ marginTop: 0 }}>{editingId ? 'Edit festival' : 'Add a festival'}</h4>
        {!editingId && (
          <div className="field">
            <label>Start from a known festival</label>
            <div className="chip-list">
              {DESIGN_CHOICES.filter((d) => d.id !== 'generic').map((d) => (
                <button
                  type="button"
                  key={d.id}
                  className="pill selectable"
                  onClick={() => setForm({ ...form, name: d.label, theme: d.id })}
                >
                  {d.label}
                </button>
              ))}
            </div>
            <p className="muted" style={{ fontSize: '0.8rem', marginTop: 4 }}>
              Fills in the name and picks the matching home page design. You still
              set the date — see the note above about why these are not calculated.
            </p>
          </div>
        )}
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
          <label>How long it runs</label>
          <div className="flex gap-1" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
            <input type="number" min={0} max={30} value={form.startsDaysBefore} style={{ width: 90 }}
              onChange={(e) => setForm({ ...form, startsDaysBefore: e.target.value })} />
            <span className="muted" style={{ fontSize: '0.85rem' }}>days before,</span>
            <input type="number" min={0} max={30} value={form.endsDaysAfter} style={{ width: 90 }}
              onChange={(e) => setForm({ ...form, endsDaysAfter: e.target.value })} />
            <span className="muted" style={{ fontSize: '0.85rem' }}>days after</span>
          </div>
          <p className="muted" style={{ fontSize: '0.8rem', marginTop: 4 }}>
            The date above is the day the festival is <b>named</b> for — Thiruvonam,
            Deepavali, Thai Pongal. Onam is <b>9 before, 0 after</b>. Pongal is
            <b> 0 before, 3 after</b>. Navaratri is <b>0 before, 8 after</b>. Leave both
            at 0 for a single day. The shop stays dressed for the whole run.
          </p>
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
          <label>Offer code for this festival (optional)</label>
          <input type="text" maxLength={24} value={form.couponCode}
            placeholder="e.g. ONAM10"
            onChange={(e) => setForm({ ...form, couponCode: e.target.value.toUpperCase() })} />
          <p className="muted" style={{ fontSize: '0.8rem', marginTop: 4 }}>
            Must be a code you have already created under Coupons — this only hands it
            out, it does not create it or set a discount. Leave blank if there is no offer.
          </p>
        </div>
        <div className="field">
          <label>Home page design</label>
          <select value={form.theme} onChange={(e) => setForm({ ...form, theme: e.target.value })}>
            <option value="">Match the name automatically</option>
            {DESIGN_CHOICES.map((d) => (
              <option key={d.id} value={d.id}>{d.label}</option>
            ))}
          </select>
          <p className="muted" style={{ fontSize: '0.8rem', marginTop: 4 }}>
            Leave on automatic unless the name will not be recognised — calling
            Deepavali "Festival of Lights" would otherwise get the plain kolam.
          </p>
        </div>
        <div className="field">
          <label>Animation</label>
          <select value={form.effect} onChange={(e) => setForm({ ...form, effect: e.target.value })}>
            <option value="">Match the design automatically</option>
            <option value="petals">Falling flowers</option>
            <option value="crackers">Crackers</option>
            <option value="embers">Rising sparks</option>
            <option value="colour">Drifting colour</option>
            <option value="sparkle">Slow glints</option>
            <option value="none">Nothing</option>
          </select>
          <p className="muted" style={{ fontSize: '0.8rem', marginTop: 4 }}>
            Automatic is nearly always right — flowers for Onam, crackers for Deepavali,
            sparks for Karthigai. Change it for a day you want treated differently.
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
          <input type="checkbox" checked={form.celebrate}
            onChange={(e) => setForm({ ...form, celebrate: e.target.checked })} />
          Dress the home page for it
        </label>
        <p className="muted" style={{ fontSize: '0.8rem', margin: '-6px 0 10px 26px' }}>
          Off keeps it on the calendar with its order-by date, but leaves the home
          page alone — useful for a day you want listed but not celebrated.
        </p>
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
