import { useEffect, useState } from 'react';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

const BLANK = { productId: '', size: '', pressDate: '', unitsOffered: 24, note: '' };

const fmtDate = (iso) =>
  new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

/** Schedule upcoming runs of the mill and let customers book a share of them
 * before the seed goes under the press. */
export default function AdminPressings() {
  const { token } = useAuth();
  const { showToast } = useToast();
  const [pressings, setPressings] = useState([]);
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState(BLANK);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const [p, prods] = await Promise.all([api.admin.listPressings(token), api.getProducts({}, token)]);
      setPressings(p.pressings);
      setProducts(prods.products);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const selectedProduct = products.find((p) => p.id === form.productId);

  async function handleCreate(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.admin.createPressing(token, form);
      showToast('Pressing scheduled — customers can reserve from it now.');
      setForm(BLANK);
      load();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handlePressed(pressing) {
    const batchNumber = window.prompt(
      `Batch number for the ${pressing.productName} (${pressing.size}) run?\n\n` +
        `This is stamped onto all ${pressing.reserved} reserved bottle(s) so those customers can look up the batch they bought.`
    );
    if (!batchNumber?.trim()) return;
    try {
      const res = await api.admin.markPressingPressed(token, pressing.id, batchNumber.trim());
      showToast(`Batch ${res.batchNumber} recorded on ${res.stampedOrders} order(s).`);
      load();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function handleCancel(pressing) {
    if (pressing.reserved > 0 &&
      !window.confirm(`${pressing.reserved} bottle(s) are already reserved. Cancelling means refunding those customers by hand. Continue?`)) {
      return;
    }
    try {
      await api.admin.updatePressing(token, pressing.id, { status: 'cancelled' });
      showToast('Pressing cancelled.');
      load();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  return (
    <div>
      <h2>Scheduled pressings</h2>
      <p className="muted" style={{ maxWidth: 640 }}>
        Announce a run before it happens and let customers reserve a share of it. Because
        the bottles don't exist yet, reservations are paid online — which is what funds the
        seed for the run. When the pressing is done, record its batch number and everyone
        who booked it can trace the exact batch they bought.
      </p>

      <form className="card" style={{ padding: 18, margin: '18px 0', maxWidth: 640 }} onSubmit={handleCreate}>
        <h4 style={{ marginTop: 0 }}>Schedule a pressing</h4>
        <div className="field">
          <label>Product</label>
          <select
            required
            value={form.productId}
            onChange={(e) => setForm({ ...form, productId: e.target.value, size: '' })}
          >
            <option value="">Choose a product…</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Size</label>
          <select
            required
            value={form.size}
            disabled={!selectedProduct}
            onChange={(e) => setForm({ ...form, size: e.target.value })}
          >
            <option value="">{selectedProduct ? 'Choose a size…' : 'Pick a product first'}</option>
            {(selectedProduct?.sizes || []).map((s) => (
              <option key={s.label} value={s.label}>{s.label} — ₹{s.price}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Pressing date</label>
          <input
            type="date"
            required
            value={form.pressDate}
            onChange={(e) => setForm({ ...form, pressDate: e.target.value })}
          />
        </div>
        <div className="field">
          <label>Bottles this run will yield</label>
          <input
            type="number"
            min={1}
            required
            value={form.unitsOffered}
            onChange={(e) => setForm({ ...form, unitsOffered: e.target.value })}
          />
        </div>
        <div className="field">
          <label>Note for customers (optional)</label>
          <input
            maxLength={300}
            placeholder="e.g. First cold press of the season, from the Vedapatti groundnut harvest"
            value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
          />
        </div>
        <button className="btn btn-gold" disabled={saving}>
          {saving ? 'Scheduling…' : 'Schedule pressing'}
        </button>
      </form>

      {loading ? (
        <p className="muted">Loading…</p>
      ) : pressings.length === 0 ? (
        <p className="muted">No pressings scheduled yet.</p>
      ) : (
        <div className="table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Pressing date</th>
                <th>Reserved</th>
                <th>Status</th>
                <th>Batch</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {pressings.map((p) => (
                <tr key={p.id}>
                  <td>{p.productName}<br /><span className="muted">{p.size}</span></td>
                  <td>{fmtDate(p.pressDate)}</td>
                  <td>
                    <b>{p.reserved}</b> / {p.unitsOffered}
                    {p.status === 'open' && p.unitsRemaining === 0 && (
                      <><br /><span className="muted">fully booked</span></>
                    )}
                  </td>
                  <td>{p.status}</td>
                  <td>{p.batchNumber || <span className="muted">—</span>}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {p.status === 'open' && (
                      <>
                        <button className="btn btn-gold btn-sm" onClick={() => handlePressed(p)}>
                          Mark pressed
                        </button>{' '}
                        <button className="btn btn-outline btn-sm" onClick={() => handleCancel(p)}>
                          Cancel
                        </button>
                      </>
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
