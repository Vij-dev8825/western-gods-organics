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
  const [uploading, setUploading] = useState(null);

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

  async function handleVideo(pressing, file) {
    if (!file) return;
    setUploading(pressing.id);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await api.admin.uploadPressingVideo(token, pressing.id, form);
      showToast(
        res.notified
          ? `Video saved — ${res.notified} customer(s) told they can watch their run.`
          : pressing.status === 'pressed'
            ? 'Video saved.'
            : 'Video saved — it goes out when you mark this run pressed.'
      );
      load();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setUploading(null);
    }
  }

  async function handleRemoveVideo(pressing) {
    if (!window.confirm('Remove the video from this pressing?')) return;
    try {
      await api.admin.deletePressingVideo(token, pressing.id);
      showToast('Video removed.');
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
      <p className="muted" style={{ maxWidth: 640 }}>
        Shoot a short clip on your phone while the press is turning and add it below. Everyone
        who reserved that run is told they can watch it, and it goes on the public pressing
        calendar — which is the one thing on this site nobody can copy. Ten to twenty seconds
        is plenty; longer clips are refused for being too heavy to load on a phone.
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
          {/* Stacked into cards on a phone. The whole point of the video column
              is that it gets used standing next to the press, and a wide table
              puts it off the right-hand edge of a phone with no way to reach it. */}
          <table className="admin-table admin-table-stack">
            <thead>
              <tr>
                <th>Product</th>
                <th>Pressing date</th>
                <th>Reserved</th>
                <th>Status</th>
                <th>Batch</th>
                <th>Video</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {pressings.map((p) => (
                <tr key={p.id}>
                  <td data-label="Product">{p.productName}<br /><span className="muted">{p.size}</span></td>
                  <td data-label="Pressing date">{fmtDate(p.pressDate)}</td>
                  <td data-label="Reserved">
                    <b>{p.reserved}</b> / {p.unitsOffered}
                    {p.status === 'open' && p.unitsRemaining === 0 && (
                      <><br /><span className="muted">fully booked</span></>
                    )}
                  </td>
                  <td data-label="Status">{p.status}</td>
                  <td data-label="Batch">{p.batchNumber || <span className="muted">—</span>}</td>
                  <td data-label="Video" style={{ minWidth: 150 }}>
                    {p.videoUrl ? (
                      <>
                        <video src={p.videoUrl} controls playsInline preload="none" style={{ width: 140, borderRadius: 6, display: 'block' }} />
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          style={{ marginTop: 6 }}
                          onClick={() => handleRemoveVideo(p)}
                        >
                          Remove
                        </button>
                      </>
                    ) : p.status === 'cancelled' ? (
                      <span className="muted">—</span>
                    ) : (
                      <label className="btn btn-outline btn-sm" style={{ cursor: 'pointer', marginBottom: 0 }}>
                        {uploading === p.id ? 'Uploading…' : 'Add video'}
                        <input
                          type="file"
                          accept="video/*"
                          hidden
                          disabled={uploading === p.id}
                          onChange={(e) => {
                            handleVideo(p, e.target.files?.[0]);
                            e.target.value = '';
                          }}
                        />
                      </label>
                    )}
                  </td>
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
