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
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);

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

  // Date/yield/note only — product and size aren't editable once scheduled,
  // since customers may have already reserved against this exact listing.
  function startEdit(pressing) {
    setEditingId(pressing.id);
    setEditForm({
      pressDate: pressing.pressDate.slice(0, 10),
      unitsOffered: pressing.unitsOffered,
      note: pressing.note || '',
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditForm(null);
  }

  async function handleUpdate(pressing) {
    setSavingEdit(true);
    try {
      await api.admin.updatePressing(token, pressing.id, {
        pressDate: editForm.pressDate,
        unitsOffered: Number(editForm.unitsOffered),
        note: editForm.note,
      });
      showToast('Pressing updated.');
      cancelEdit();
      load();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSavingEdit(false);
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
          <label htmlFor="pressing-product">Product</label>
          <select
            id="pressing-product"
            required
            value={form.productId}
            onChange={(e) => setForm({ ...form, productId: e.target.value, size: '' })}
          >
            <option value="">Choose a product…</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="pressing-size">Size</label>
          <select
            id="pressing-size"
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
          <label htmlFor="pressing-date">Pressing date</label>
          <input
            id="pressing-date"
            type="date"
            required
            value={form.pressDate}
            onChange={(e) => setForm({ ...form, pressDate: e.target.value })}
          />
        </div>
        <div className="field">
          <label htmlFor="pressing-units-offered">Bottles this run will yield</label>
          <input
            id="pressing-units-offered"
            type="number"
            min={1}
            required
            value={form.unitsOffered}
            onChange={(e) => setForm({ ...form, unitsOffered: e.target.value })}
          />
        </div>
        <div className="field">
          <label htmlFor="pressing-note">Note for customers (optional)</label>
          <input
            id="pressing-note"
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
                  <td data-label="Product">
                    {p.productName}<br /><span className="muted">{p.size}</span>
                    {editingId !== p.id && p.note && <><br /><span className="muted">"{p.note}"</span></>}
                  </td>
                  <td data-label="Pressing date">
                    {editingId === p.id ? (
                      <input
                        type="date"
                        aria-label="Pressing date"
                        value={editForm.pressDate}
                        onChange={(e) => setEditForm({ ...editForm, pressDate: e.target.value })}
                        style={{ minWidth: 132 }}
                      />
                    ) : (
                      fmtDate(p.pressDate)
                    )}
                  </td>
                  <td data-label="Reserved">
                    {editingId === p.id ? (
                      <>
                        <b>{p.reserved}</b> /{' '}
                        <input
                          type="number"
                          aria-label="Bottles this run will yield"
                          min={p.reserved || 1}
                          value={editForm.unitsOffered}
                          onChange={(e) => setEditForm({ ...editForm, unitsOffered: e.target.value })}
                          style={{ width: 64 }}
                        />
                      </>
                    ) : (
                      <>
                        <b>{p.reserved}</b> / {p.unitsOffered}
                        {p.status === 'open' && p.unitsRemaining === 0 && (
                          <><br /><span className="muted">fully booked</span></>
                        )}
                      </>
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
                    {editingId === p.id ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 200 }}>
                        <input
                          placeholder="Note for customers (optional)"
                          aria-label="Note for customers"
                          maxLength={300}
                          value={editForm.note}
                          onChange={(e) => setEditForm({ ...editForm, note: e.target.value })}
                        />
                        <div>
                          <button className="btn btn-gold btn-sm" disabled={savingEdit} onClick={() => handleUpdate(p)}>
                            {savingEdit ? 'Saving…' : 'Save'}
                          </button>{' '}
                          <button type="button" className="btn btn-outline btn-sm" onClick={cancelEdit}>
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : p.status === 'open' ? (
                      <>
                        <button className="btn btn-gold btn-sm" onClick={() => handlePressed(p)}>
                          Mark pressed
                        </button>{' '}
                        <button className="btn btn-outline btn-sm" onClick={() => startEdit(p)}>
                          Edit
                        </button>{' '}
                        <button className="btn btn-outline btn-sm" onClick={() => handleCancel(p)}>
                          Cancel
                        </button>
                      </>
                    ) : null}
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
