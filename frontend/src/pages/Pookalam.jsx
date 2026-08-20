/**
 * Lay a pookalam, ring by ring.
 *
 * Onam's flower carpet is the one ritual of the festival everybody takes part
 * in — it is laid on the doorstep over ten days, growing a ring at a time, out
 * of whatever is in flower. So this is not a spin-wheel with an Onam skin on
 * it: you place real flowers, in rings, and it takes a minute of attention.
 *
 * The flowers are photographs cut out of their background rather than drawn
 * shapes, so a chendumalli looks like a chendumalli. Every petal you lay is
 * mirrored around the circle the way a pookalam is actually set out, which is
 * what lets a dozen taps produce something that looks laid rather than
 * scattered.
 *
 * The reward is whatever offer the admin has attached to the Onam entry in the
 * festival calendar. If no code is set the pookalam is still worth laying and
 * the page says so — inventing a discount here would be writing a promise the
 * shop has not made.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import SeoMeta from '../components/SeoMeta';
import { useToast } from '../context/ToastContext';

/**
 * The flowers, under the names they are called by in Kerala with the English
 * in tow — plenty of people buying oil for Onam did not grow up with these.
 * `tint` is only used for the palette ring and the loading placeholder; the
 * flower itself is always the photograph.
 */
const FLOWERS = [
  { id: 'chendumalli', label: 'Chendumalli', gloss: 'marigold', tint: '#F2A20C' },
  { id: 'chendumalli-deep', label: 'Chendumalli', gloss: 'deep marigold', tint: '#F08B04' },
  { id: 'jamanthi', label: 'Jamanthi', gloss: 'chrysanthemum', tint: '#F6C90E' },
  { id: 'chethi', label: 'Chethi', gloss: 'red ixora', tint: '#E12B22' },
  { id: 'manja-chethi', label: 'Manja chethi', gloss: 'yellow ixora', tint: '#F4CE1B' },
  { id: 'golden-chethi', label: 'Golden chethi', gloss: 'ixora with leaf', tint: '#F5C518' },
  { id: 'chembarathi', label: 'Chembarathi', gloss: 'hibiscus', tint: '#DC2020' },
  { id: 'manja-chembarathi', label: 'Manja chembarathi', gloss: 'yellow hibiscus', tint: '#F7C50D' },
  { id: 'flame', label: 'Flame bloom', gloss: 'orange', tint: '#F2571C' },
  { id: 'shankhupushpam', label: 'Shankhupushpam', gloss: 'blue pea', tint: '#2A2FC4' },
  { id: 'vadamalli', label: 'Vadamalli', gloss: 'globe amaranth', tint: '#B5199C' },
  { id: 'mulla', label: 'Mulla', gloss: 'jasmine', tint: '#FBF7EE' },
  { id: 'pansy', label: 'Pansy', gloss: 'purple and gold', tint: '#6B2C91' },
  { id: 'sooryakanthi', label: 'Sooryakanthi', gloss: 'sunflower', tint: '#F5B915' },
  { id: 'thulasi', label: 'Thulasi', gloss: 'holy basil', tint: '#3E7A3A' },
];

const srcFor = (id) => `/flowers/${id}.webp`;
const BY_ID = Object.fromEntries(FLOWERS.map((f) => [f.id, f]));

/**
 * Outermost first, because that is the order a pookalam is laid — and because
 * later rings paint over earlier ones, so the inner flowers overlap the outer
 * exactly as they do on a doorstep.
 *
 * Every count divides by 2, 3 and 6, so each mirror setting lands on real
 * slots rather than rounding onto a neighbour and drifting out of true. The
 * single flower at the centre is its own ring.
 */
const RINGS = [
  { r: 44, count: 24, size: 12.6 },
  { r: 33, count: 18, size: 12.6 },
  { r: 23, count: 12, size: 12.6 },
  { r: 13, count: 6, size: 13 },
  { r: 0, count: 1, size: 13 },
];

const TOTAL = RINGS.reduce((n, r) => n + r.count, 0);

/** 6× is the classic pookalam fold, so it is where you start. */
const SYMMETRIES = [
  { n: 1, label: 'Single' },
  { n: 2, label: '2×' },
  { n: 3, label: '3×' },
  { n: 6, label: '6×' },
];

const MAT = '#2B1B12';

/** Same format the festival calendar uses, so a customer moving between the
 *  two pages reads the same deadline written the same way. */
const shortDate = (d) =>
  new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

export default function Pookalam() {
  const { showToast } = useToast();
  const [flower, setFlower] = useState(FLOWERS[0]);
  const [symmetry, setSymmetry] = useState(6);
  const [filled, setFilled] = useState({});
  const [onam, setOnam] = useState(null);
  const [revealed, setRevealed] = useState(false);
  const [saving, setSaving] = useState(false);
  const imgCache = useRef(new Map());

  useEffect(() => {
    api
      .getFestivals()
      .then((d) => setOnam((d.festivals || []).find((f) => /onam/i.test(f.name)) || null))
      .catch(() => setOnam(null));
  }, []);

  const placed = Object.keys(filled).length;
  const done = placed >= TOTAL;
  const pct = Math.round((placed / TOTAL) * 100);

  useEffect(() => {
    if (done && !revealed) {
      setRevealed(true);
      showToast('Your pookalam is complete. Onam ashamsakal! 🌼');
    }
  }, [done, revealed, showToast]);

  /** Slot geometry, worked out once. Rings run outermost first so the render
   *  order layers inner flowers over outer ones. */
  const slots = useMemo(() => {
    const out = [];
    RINGS.forEach((ring, ri) => {
      for (let s = 0; s < ring.count; s++) {
        const a = ((s * 360) / ring.count - 90) * (Math.PI / 180);
        out.push({
          key: `${ri}-${s}`,
          ring: ri,
          seg: s,
          x: ring.r === 0 ? 0 : Math.cos(a) * ring.r,
          y: ring.r === 0 ? 0 : Math.sin(a) * ring.r,
          size: ring.size,
        });
      }
    });
    return out;
  }, []);

  /** Every slot one tap fills: the flower itself plus its mirrors around the
   *  ring. Counts are multiples of 6, so this divides exactly. */
  const mirrorsOf = useCallback((ring, seg) => {
    const count = RINGS[ring].count;
    const fold = Math.max(1, Math.min(symmetry, count));
    const step = count / fold;
    const keys = [];
    for (let k = 0; k < fold; k++) keys.push(`${ring}-${(seg + Math.round(k * step)) % count}`);
    return keys;
  }, [symmetry]);

  const place = useCallback((ring, seg) => {
    setFilled((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const key of mirrorsOf(ring, seg)) {
        if (next[key] !== flower.id) { next[key] = flower.id; changed = true; }
      }
      return changed ? next : prev;
    });
  }, [flower.id, mirrorsOf]);

  function reset() {
    setFilled({});
    setRevealed(false);
  }

  /** Lays a whole pookalam at once, one or two flowers per ring so it comes
   *  out looking laid rather than scattered. For anyone who wants the picture
   *  without the minute of tapping. */
  function surpriseMe() {
    const pick = () => FLOWERS[Math.floor(Math.random() * FLOWERS.length)];
    const next = {};
    RINGS.forEach((ring, ri) => {
      const a = pick();
      let b = pick();
      if (b.id === a.id) b = FLOWERS[(FLOWERS.indexOf(a) + 5) % FLOWERS.length];
      for (let s = 0; s < ring.count; s++) next[`${ri}-${s}`] = (s % 2 ? b : a).id;
    });
    setFilled(next);
  }

  const loadImage = useCallback((id) => {
    const cached = imgCache.current.get(id);
    if (cached) return Promise.resolve(cached);
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => { imgCache.current.set(id, img); resolve(img); };
      img.onerror = reject;
      img.src = srcFor(id);
    });
  }, []);

  /**
   * Redraws the pookalam as a square image to keep or send on.
   *
   * Painted straight onto a canvas rather than by serialising the live SVG:
   * an SVG turned into a data URL is treated as its own origin and will not
   * load the flower files, so that route would export a picture of empty
   * slots. The sprites are same-origin, so the canvas stays untainted and
   * toBlob works.
   */
  const buildImage = useCallback(async () => {
    const S = 1080;
    const scale = S / 104;              // the SVG viewBox is 104 units across
    const toPx = (u) => (u + 52) * scale;

    const canvas = document.createElement('canvas');
    canvas.width = S;
    canvas.height = S;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = MAT;
    ctx.fillRect(0, 0, S, S);
    ctx.beginPath();
    ctx.arc(S / 2, S / 2, 50 * scale, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fill();

    const used = [...new Set(Object.values(filled))];
    await Promise.all(used.map((id) => loadImage(id).catch(() => null)));

    // Same order as on screen, so the overlaps match what was laid.
    for (const slot of slots) {
      const id = filled[slot.key];
      if (!id) continue;
      const img = imgCache.current.get(id);
      if (!img) continue;
      const px = slot.size * scale;
      ctx.drawImage(img, toPx(slot.x) - px / 2, toPx(slot.y) - px / 2, px, px);
    }

    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.font = '600 34px Georgia, "Times New Roman", serif';
    ctx.fillText('Onam ashamsakal', S / 2, S - 74);
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = '500 22px system-ui, -apple-system, Segoe UI, sans-serif';
    ctx.fillText('westerngodsorganic.com', S / 2, S - 40);

    // JPEG, not PNG. The mat is opaque so there is nothing to keep an alpha
    // channel for, and the same carpet is ~1.9 MB lossless against ~200 KB
    // here — the difference between an image people send on WhatsApp and one
    // they give up on.
    return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
  }, [filled, slots, loadImage]);

  /** Share sheet where there is one, a download everywhere else. */
  async function saveImage() {
    setSaving(true);
    try {
      const blob = await buildImage();
      if (!blob) throw new Error('no image');
      const file = new File([blob], 'my-pookalam.jpg', { type: 'image/jpeg' });

      if (navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: 'My pookalam' });
          return;
        } catch (err) {
          // Dismissing the share sheet is a choice, not a failure.
          if (err?.name === 'AbortError') return;
        }
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'my-pookalam.jpg';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      showToast('Pookalam saved to your device');
    } catch {
      showToast('Could not save the image — try a screenshot instead');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="section">
      <SeoMeta
        title="Lay a Pookalam — Onam at Western Gods Organics"
        description="Lay a flower carpet ring by ring for Onam, the way it is done on the doorstep, and see this season's offer from our family mill in Tamil Nadu."
        path="/onam"
      />
      <div className="container center">
        <span className="eyebrow">Onam</span>
        <h1 style={{ marginBottom: 8 }}>Lay a pookalam</h1>
        <p className="muted" style={{ maxWidth: '52ch', margin: '0 auto 6px' }}>
          A flower carpet is laid on the doorstep through Onam, growing a ring
          each day. Pick a flower and tap the circle — every one you lay is
          mirrored around it, the way a real pookalam is set out.
        </p>

        {onam && (
          <p className="muted" style={{ fontSize: '0.88rem' }}>
            {onam.daysAway > 0
              ? `Onam is ${onam.daysAway} day${onam.daysAway === 1 ? '' : 's'} away.`
              : onam.daysAway === 0
                ? 'Onam is today.'
                : null}
            {onam.orderingClosed === false && onam.orderBy && (
              <> Order by <b>{shortDate(onam.orderBy)}</b> for it to arrive in time.</>
            )}
          </p>
        )}

        <div className="pookalam-wrap">
          <svg viewBox="-52 -52 104 104" className="pookalam" role="img" aria-label={`Pookalam, ${pct}% laid`}>
            <circle r="51" className="pookalam-mat" />
            <circle r="50" className="pookalam-ground" />

            {/* Empty slots, so it reads as a carpet waiting to be laid. */}
            {slots.map((s) => (
              filled[s.key] ? null : (
                <circle key={`e-${s.key}`} cx={s.x} cy={s.y} r={s.size * 0.3} className="pookalam-empty" />
              )
            ))}

            {/* Flowers, outer rings first so inner ones lie over them. */}
            {slots.map((s) => {
              const id = filled[s.key];
              if (!id) return null;
              return (
                <image
                  key={`f-${s.key}`}
                  href={srcFor(id)}
                  x={s.x - s.size / 2}
                  y={s.y - s.size / 2}
                  width={s.size}
                  height={s.size}
                  className="pookalam-bloom"
                />
              );
            })}

            {/* Hit targets last, so every slot stays tappable under the petals
                that overlap it. */}
            {slots.map((s) => (
              <circle
                key={`h-${s.key}`}
                cx={s.x}
                cy={s.y}
                r={s.size * 0.46}
                className="pookalam-hit"
                onPointerDown={() => place(s.ring, s.seg)}
                onPointerEnter={(e) => { if (e.buttons === 1) place(s.ring, s.seg); }}
              />
            ))}
          </svg>
        </div>

        <div className="pookalam-palette" role="group" aria-label="Choose a flower">
          {FLOWERS.map((f) => (
            <button
              key={f.id}
              type="button"
              className={`pookalam-swatch${flower.id === f.id ? ' is-active' : ''}`}
              onClick={() => setFlower(f)}
              aria-pressed={flower.id === f.id}
              aria-label={`${f.label} — ${f.gloss}`}
              title={`${f.label} (${f.gloss})`}
            >
              <img src={srcFor(f.id)} alt="" width="44" height="44" loading="eager" />
            </button>
          ))}
        </div>
        <p className="muted" style={{ fontSize: '0.82rem', marginTop: 8, marginBottom: 10 }}>
          <b>{flower.label}</b> <span style={{ opacity: 0.75 }}>· {flower.gloss}</span> — {placed} of {TOTAL} laid
        </p>

        <div className="pookalam-folds" role="group" aria-label="How many times each flower is mirrored">
          <span className="muted" style={{ fontSize: '0.78rem' }}>Mirror</span>
          {SYMMETRIES.map((s) => (
            <button
              key={s.n}
              type="button"
              className={`pookalam-fold${symmetry === s.n ? ' is-active' : ''}`}
              onClick={() => setSymmetry(s.n)}
              aria-pressed={symmetry === s.n}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="pookalam-actions">
          <button type="button" className="btn btn-outline btn-sm" onClick={surpriseMe}>
            Lay it for me
          </button>
          {placed > 0 && (
            <button type="button" className="btn btn-outline btn-sm" onClick={reset}>
              Start again
            </button>
          )}
          {placed > 0 && (
            <button type="button" className="btn btn-outline btn-sm" onClick={saveImage} disabled={saving}>
              {saving ? 'Saving…' : 'Save or share'}
            </button>
          )}
        </div>

        {done && (
          <div className="pookalam-done">
            <h2 style={{ marginBottom: 6 }}>Onam ashamsakal 🌼</h2>
            {onam?.couponCode ? (
              <>
                <p className="muted" style={{ margin: '0 0 10px' }}>
                  Your pookalam is complete. Use this at checkout:
                </p>
                <button
                  type="button"
                  className="pookalam-code"
                  onClick={() => {
                    navigator.clipboard?.writeText(onam.couponCode).then(
                      () => showToast(`${onam.couponCode} copied`),
                      () => {}
                    );
                  }}
                >
                  {onam.couponCode}
                </button>
                <p className="muted" style={{ fontSize: '0.78rem', marginTop: 8 }}>Tap to copy</p>
              </>
            ) : (
              <p className="muted" style={{ maxWidth: '44ch', margin: '0 auto' }}>
                Beautifully laid. There is no Onam offer running just now — but
                the oils are pressed the same week they are sent, festival or not.
              </p>
            )}
            <div style={{ marginTop: 16, display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link className="btn btn-gold" to="/shop">Shop the season</Link>
              <button type="button" className="btn btn-ghost" onClick={reset}>
                Lay another
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
