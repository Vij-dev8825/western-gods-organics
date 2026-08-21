/**
 * The flowers the shop can add itself.
 *
 * Fifteen ship with the site. This is for the sixteenth — a bloom the mill
 * actually has, a local favourite, whatever is in flower this year. Upload a
 * photograph of one flower on a plain pale background and the server cuts it
 * out; nobody should need Photoshop to add a marigold.
 */
import { useEffect, useRef, useState } from 'react';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';

export default function AdminFlowers() {
  const { token } = useAuth();
  const [flowers, setFlowers] = useState([]);
  const [label, setLabel] = useState('');
  const [gloss, setGloss] = useState('');
  const [petal, setPetal] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const fileRef = useRef(null);

  function load() {
    api.admin.getFlowers(token).then((d) => setFlowers(d.flowers || [])).catch(() => {});
  }
  useEffect(load, [token]);

  async function upload(e) {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) { setMessage({ type: 'error', text: 'Choose a photograph first.' }); return; }
    setBusy(true);
    setMessage(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('label', label);
      fd.append('gloss', gloss);
      fd.append('petal', String(petal));
      const d = await api.admin.uploadFlower(token, fd);
      setMessage({
        type: 'success',
        text: `${d.flower.label} added — the flower filled ${d.keptPct}% of the photo.`,
      });
      setLabel(''); setGloss(''); setPetal(true);
      if (fileRef.current) fileRef.current.value = '';
      load();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setBusy(false);
    }
  }

  async function patch(id, body) {
    try {
      await api.admin.updateFlower(token, id, body);
      load();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  }

  async function remove(f) {
    if (!window.confirm(`Remove ${f.label}? It will disappear from the pookalam and the falling petals.`)) return;
    try {
      await api.admin.deleteFlower(token, f.id);
      load();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  }

  return (
    <>
      <div className="admin-head">
        <h1>Flowers</h1>
      </div>

      <p className="muted" style={{ maxWidth: 660, fontSize: '0.85rem' }}>
        Used for the pookalam and for the flowers that drift across the site during Onam.
        Fifteen come with the site already; anything added here joins them.
        <br />
        <b>Upload one flower, photographed straight on, against a plain pale background</b> —
        the kind of picture a seed catalogue uses. The background is removed automatically.
        A photo of a garden, or a flower against a busy scene, will be refused rather than
        cut badly.
      </p>

      {message && <div className={`alert alert-${message.type}`}>{message.text}</div>}

      <form className="card" style={{ padding: 18, margin: '18px 0', maxWidth: 660 }} onSubmit={upload}>
        <h4 style={{ marginTop: 0 }}>Add a flower</h4>
        <div className="form-grid">
          <div className="field">
            <label>Name</label>
            <input value={label} maxLength={40} required placeholder="e.g. Thumba"
              onChange={(e) => setLabel(e.target.value)} />
          </div>
          <div className="field">
            <label>Also called (optional)</label>
            <input value={gloss} maxLength={40} placeholder="e.g. leucas"
              onChange={(e) => setGloss(e.target.value)} />
          </div>
        </div>
        <div className="field">
          <label>Photograph</label>
          <input type="file" accept="image/jpeg,image/png,image/webp" ref={fileRef} />
        </div>
        <label className="check-row">
          <input type="checkbox" checked={petal} onChange={(e) => setPetal(e.target.checked)} />
          Let it fall as a petal too
        </label>
        <p className="muted" style={{ fontSize: '0.8rem', margin: '-6px 0 10px 26px' }}>
          Off keeps it in the pookalam but out of the drifting petals — right for
          anything big or heavy, since a sunflower tumbling past the headline looks
          like a fault rather than a festival.
        </p>
        <div className="btn-row">
          <button className="btn btn-gold btn-sm" disabled={busy}>
            {busy ? 'Cutting it out…' : 'Add flower'}
          </button>
        </div>
      </form>

      <div className="admin-card">
        <table className="admin-table">
          <thead>
            <tr><th>Flower</th><th>Name</th><th>Falls as a petal</th><th>Shown</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {flowers.length === 0 && (
              <tr><td colSpan={5} className="muted">
                None added yet — the site is using the fifteen it ships with.
              </td></tr>
            )}
            {flowers.map((f) => (
              <tr key={f.id}>
                <td>
                  {/* On a dark cell, because that is what a cut-out has to survive —
                      a halo the shop cannot see here would show on the pookalam mat. */}
                  <span style={{
                    display: 'inline-flex', width: 54, height: 54, borderRadius: 8,
                    background: '#2B1B12', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <img src={f.url} alt="" width="46" height="46" style={{ objectFit: 'contain' }} />
                  </span>
                </td>
                <td>
                  <b>{f.label}</b>
                  {f.gloss && <div className="muted" style={{ fontSize: '0.8rem' }}>{f.gloss}</div>}
                </td>
                <td>
                  <button className="link-btn" onClick={() => patch(f.id, { petal: !f.petal })}>
                    {f.petal !== false ? 'yes' : 'no'}
                  </button>
                </td>
                <td>
                  <span className={`pill status-${f.active !== false ? 'placed' : 'cancelled'}`}>
                    {f.active !== false ? 'Shown' : 'Hidden'}
                  </span>
                </td>
                <td>
                  <button className="link-btn" onClick={() => patch(f.id, { active: !(f.active !== false) })}>
                    {f.active !== false ? 'hide' : 'show'}
                  </button>{' '}
                  <button className="link-btn danger" onClick={() => remove(f)}>remove</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
