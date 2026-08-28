/**
 * The shop's own festival artwork.
 *
 * The site draws its own dancers and they are a reasonable default, but
 * commissioned or licensed artwork will always beat them. Upload figures for a
 * festival here and they replace the drawn ones for that festival entirely —
 * half drawn and half painted would look like a mistake rather than a choice.
 */
import { useEffect, useRef, useState } from 'react';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { DESIGN_CHOICES } from '../../components/festival/registry';

/** How a figure moves. Blank lets the row choose, alternating so a row of
 *  four does not perform one identical motion four times over. */
const MOTIONS = [
  ['', 'Pick for me'],
  ['dance', 'Dance — bob and lean'],
  ['sway', 'Sway — slower, no lift'],
  ['hop', 'Hop'],
  ['float', 'Float — for things, not people'],
  ['still', 'Stand still'],
];

export default function AdminCharacters() {
  const { token } = useAuth();
  const [characters, setCharacters] = useState([]);
  const [label, setLabel] = useState('');
  const [festival, setFestival] = useState('onam');
  const [motion, setMotion] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const [editing, setEditing] = useState(null); // { id, label, festival }
  const [swapping, setSwapping] = useState(null);
  const fileRef = useRef(null);

  function load() {
    api.admin.getFestivalCharacters(token).then((d) => setCharacters(d.characters || [])).catch(() => {});
  }
  useEffect(load, [token]);

  async function upload(e) {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) { setMessage({ type: 'error', text: 'Choose an image first.' }); return; }
    setBusy(true);
    setMessage(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('label', label);
      fd.append('festival', festival);
      fd.append('motion', motion);
      const d = await api.admin.uploadFestivalCharacter(token, fd);
      setMessage({
        type: 'success',
        text: d.alreadyCut
          ? `${d.character.label} added — it was already cut out, so it was used as it is.`
          : `${d.character.label} added — the background was removed for you.`,
      });
      setLabel('');
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
      await api.admin.updateFestivalCharacter(token, id, body);
      setEditing(null);
      load();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  }

  async function saveEdit() {
    const { id, label: l, festival: f, motion: m } = editing;
    if (!l.trim()) { setMessage({ type: 'error', text: 'A character needs a name.' }); return; }
    await patch(id, { label: l.trim(), festival: f, motion: m });
  }

  async function swapImage(id, file) {
    if (!file) return;
    setSwapping(id);
    setMessage(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const d = await api.admin.replaceFestivalCharacterImage(token, id, fd);
      setMessage({
        type: 'success',
        text: d.alreadyCut
          ? `New picture for ${d.character.label} — it was already cut out.`
          : `New picture for ${d.character.label} — the background was removed for you.`,
      });
      load();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSwapping(null);
    }
  }

  async function remove(c) {
    if (!window.confirm(`Remove ${c.label}? The drawn figures come back if nothing is left for that festival.`)) return;
    try {
      await api.admin.deleteFestivalCharacter(token, c.id);
      load();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  }

  const nameOf = (id) => DESIGN_CHOICES.find((d) => d.id === id)?.label || id;
  const byFestival = characters.reduce((acc, c) => {
    (acc[c.festival] ||= []).push(c);
    return acc;
  }, {});

  return (
    <>
      <div className="admin-head">
        <h1>Festival characters</h1>
      </div>

      <p className="muted" style={{ maxWidth: 680, fontSize: '0.85rem' }}>
        The figures that dance along the foot of the festival band on the home page.
        The site draws its own; anything uploaded here <b>replaces</b> them for that
        festival.
        <br /><br />
        <b>One character per image, standing, facing the front.</b> A transparent PNG is
        used exactly as it is. Anything on a plain flat background — white, or the one
        colour behind a stock cartoon — has that background removed automatically. A
        picture with a scene behind it will be refused rather than cut badly.
        <br /><br />
        A flat picture cannot swing its arms, so an uploaded character <b>bobs, leans
        and sways as a whole figure</b> rather than moving its limbs.
      </p>

      {message && <div className={`alert alert-${message.type}`}>{message.text}</div>}

      <form className="card" style={{ padding: 18, margin: '18px 0', maxWidth: 680 }} onSubmit={upload}>
        <h4 style={{ marginTop: 0 }}>Add a character</h4>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="character-name">Name</label>
            <input id="character-name" value={label} maxLength={40} required placeholder="e.g. Maveli"
              onChange={(e) => setLabel(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="character-festival">Festival</label>
            <select id="character-festival" value={festival} onChange={(e) => setFestival(e.target.value)}>
              {DESIGN_CHOICES.filter((d) => d.id !== 'generic').map((d) => (
                <option key={d.id} value={d.id}>{d.label}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="field">
          <label htmlFor="character-image">Image</label>
          <input id="character-image" type="file" accept="image/jpeg,image/png,image/webp" ref={fileRef} />
        </div>
        <div className="field">
          <label htmlFor="character-motion">How it moves</label>
          <select id="character-motion" value={motion} onChange={(e) => setMotion(e.target.value)} style={{ maxWidth: 280 }}>
            {MOTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <p className="muted" style={{ fontSize: '0.8rem', marginTop: 4 }}>
            Use <b>Float</b> or <b>Stand still</b> for anything that is not a person —
            a sadya on a banana leaf doing a jig looks like a mistake.
          </p>
        </div>
        <div className="btn-row">
          <button className="btn btn-gold btn-sm" disabled={busy}>
            {busy ? 'Preparing…' : 'Add character'}
          </button>
        </div>
      </form>

      {Object.keys(byFestival).length === 0 && (
        <div className="admin-card">
          <p className="muted" style={{ margin: 0 }}>
            Nothing uploaded yet — every festival is using the figures the site draws.
          </p>
        </div>
      )}

      {Object.entries(byFestival).map(([fid, list]) => (
        <div className="admin-card" key={fid}>
          <h4 style={{ marginTop: 0 }}>
            {nameOf(fid)}{' '}
            <span className="muted" style={{ fontWeight: 400, fontSize: '0.82rem' }}>
              — {list.filter((c) => c.active !== false).length
                ? `showing ${Math.min(list.filter((c) => c.active !== false).length, 4)} of these instead of the drawn figures`
                : 'all hidden, so the drawn figures are showing'}
            </span>
          </h4>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            {list.map((c) => (
              <div key={c.id} style={{ width: 150 }}>
                {/* On the band's own pale ground, which is where a bad cut-out
                    shows first. */}
                <div style={{
                  background: '#FDF6E7', borderRadius: 10, padding: 8, height: 130,
                  display: 'grid', placeItems: 'end center',
                  opacity: c.active === false ? 0.42 : 1,
                }}>
                  <img src={c.url} alt="" style={{ maxWidth: '100%', maxHeight: 112, objectFit: 'contain' }} />
                </div>
                {editing?.id === c.id ? (
                  <div style={{ display: 'grid', gap: 6, marginTop: 6 }}>
                    <input
                      autoFocus
                      value={editing.label}
                      maxLength={40}
                      placeholder="Name"
                      aria-label="Character name"
                      onChange={(e) => setEditing({ ...editing, label: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') { e.preventDefault(); saveEdit(); }
                        if (e.key === 'Escape') setEditing(null);
                      }}
                    />
                    {/* Moving a character between festivals used to mean deleting
                        it and uploading the same file again. */}
                    <select
                      value={editing.festival}
                      onChange={(e) => setEditing({ ...editing, festival: e.target.value })}
                    >
                      {DESIGN_CHOICES.filter((d) => d.id !== 'generic').map((d) => (
                        <option key={d.id} value={d.id}>{d.label}</option>
                      ))}
                    </select>
                    <select
                      value={editing.motion}
                      onChange={(e) => setEditing({ ...editing, motion: e.target.value })}
                    >
                      {MOTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                    <div style={{ fontSize: '0.78rem' }}>
                      <button className="link-btn" onClick={saveEdit}>save</button>{' '}
                      <button className="link-btn" onClick={() => setEditing(null)}>cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div style={{ marginTop: 6, fontWeight: 600, fontSize: '0.86rem' }}>{c.label}</div>
                    <div className="muted" style={{ fontSize: '0.74rem' }}>
                      {(MOTIONS.find(([v]) => v === (c.motion || ''))?.[1] || '').split(' —')[0]}
                    </div>
                    <div style={{ marginTop: 2, fontSize: '0.78rem' }}>
                      <button
                        className="link-btn"
                        onClick={() => setEditing({ id: c.id, label: c.label || '', festival: c.festival, motion: c.motion || '' })}
                      >
                        edit
                      </button>{' '}
                      <label className="link-btn" style={{ cursor: 'pointer' }}>
                        {swapping === c.id ? 'preparing…' : 'new image'}
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          hidden
                          onChange={(e) => swapImage(c.id, e.target.files?.[0])}
                        />
                      </label>{' '}
                      <button className="link-btn" onClick={() => patch(c.id, { active: !(c.active !== false) })}>
                        {c.active !== false ? 'hide' : 'show'}
                      </button>{' '}
                      <button className="link-btn danger" onClick={() => remove(c)}>remove</button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
          {list.filter((c) => c.active !== false).length > 4 && (
            <p className="muted" style={{ fontSize: '0.8rem', marginBottom: 0 }}>
              Only the first four are shown on the page — more than that and each one
              is too small to see.
            </p>
          )}
        </div>
      ))}
    </>
  );
}
