/**
 * Lay a pookalam, ring by ring.
 *
 * Onam's flower carpet is the one ritual of the festival everybody takes part
 * in — it is laid on the doorstep over ten days, growing a ring at a time, and
 * it is made by hand out of whatever is in flower. So this is not a spin-wheel
 * with an Onam skin on it: you actually place the petals, in rings, from the
 * outside in, and it takes a minute of attention rather than one click.
 *
 * Deliberately not a full art tool. A shopper on a shop page will give this a
 * minute, so the design does the hard part for them: petals land in fixed
 * rings, and symmetry mirrors every one you place around the circle the way a
 * real pookalam is laid. Twelve taps and it looks like something.
 *
 * The reward is whatever offer the admin has attached to the Onam entry in the
 * festival calendar. If no code is set the pookalam is still worth laying and
 * the page says so — inventing a discount here would be writing a promise the
 * shop has not made.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import SeoMeta from '../components/SeoMeta';
import { useToast } from '../context/ToastContext';

/**
 * The flowers a pookalam is actually laid with, under the names they are
 * called by in Kerala — with the English in tow, because plenty of people
 * buying oil for Onam did not grow up with these names.
 */
const FLOWERS = [
  { id: 'chendumalli', label: 'Chendumalli', gloss: 'marigold', colour: '#F2A20C' },
  { id: 'jamanthi', label: 'Jamanthi', gloss: 'chrysanthemum', colour: '#F6D423' },
  { id: 'chethi', label: 'Chethi', gloss: 'ixora', colour: '#D8324B' },
  { id: 'chembarathi', label: 'Chembarathi', gloss: 'hibiscus', colour: '#E4571B' },
  { id: 'thumba', label: 'Thumba', gloss: 'laid on the first day', colour: '#FBF7EE' },
  { id: 'shankhupushpam', label: 'Shankhupushpam', gloss: 'blue pea', colour: '#5B4B9E' },
  { id: 'vadamalli', label: 'Vadamalli', gloss: 'globe amaranth', colour: '#A8203B' },
  { id: 'thulasi', label: 'Thulasi', gloss: 'holy basil', colour: '#3E7A3A' },
];

/**
 * Outermost first, because that is the order a pookalam is actually laid.
 * Every count is a multiple of 6, so 2×, 3× and 6× symmetry divide all of them
 * exactly — mirrored petals land on real slots instead of being rounded onto a
 * neighbour, which is what would make the pattern drift out of true.
 */
const RINGS = [
  { r: 46, segments: 24 },
  { r: 37, segments: 18 },
  { r: 28, segments: 12 },
  { r: 19, segments: 12 },
  { r: 11, segments: 6 },
];

const TOTAL = RINGS.reduce((n, r) => n + r.segments, 0);

/** 6× is the classic pookalam fold, so it is the one you start on. */
const SYMMETRIES = [
  { n: 1, label: 'Single' },
  { n: 2, label: '2×' },
  { n: 3, label: '3×' },
  { n: 6, label: '6×' },
];

const LAMP = '#C9A227';
const MAT = '#2B1B12';

/** Same format the festival calendar uses, so a customer moving between the
 *  two pages reads the same deadline written the same way. */
const shortDate = (d) =>
  new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

/** A petal as a rounded wedge, positioned by angle. Drawn from the centre so
 *  one transform places it, which keeps the DOM small enough that a phone can
 *  hold 72 of them without complaint. */
function petalPath(inner, outer, halfAngle) {
  const rad = (halfAngle * Math.PI) / 180;
  const x1 = Math.sin(-rad) * inner, y1 = -Math.cos(-rad) * inner;
  const x2 = Math.sin(-rad) * outer, y2 = -Math.cos(-rad) * outer;
  const x3 = Math.sin(rad) * outer, y3 = -Math.cos(rad) * outer;
  const x4 = Math.sin(rad) * inner, y4 = -Math.cos(rad) * inner;
  return `M ${x1} ${y1} L ${x2} ${y2} A ${outer} ${outer} 0 0 1 ${x3} ${y3} L ${x4} ${y4} A ${inner} ${inner} 0 0 0 ${x1} ${y1} Z`;
}

export default function Pookalam() {
  const { showToast } = useToast();
  const [flower, setFlower] = useState(FLOWERS[0]);
  const [symmetry, setSymmetry] = useState(6);
  const [filled, setFilled] = useState({});
  const [onam, setOnam] = useState(null);
  const [revealed, setRevealed] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .getFestivals()
      .then((d) => {
        const list = d.festivals || [];
        setOnam(list.find((f) => /onam/i.test(f.name)) || null);
      })
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

  const petals = useMemo(() => {
    const out = [];
    RINGS.forEach((ring, ri) => {
      const step = 360 / ring.segments;
      const inner = ri === RINGS.length - 1 ? 0 : RINGS[ri + 1].r;
      for (let s = 0; s < ring.segments; s++) {
        out.push({
          key: `${ri}-${s}`,
          ring: ri,
          seg: s,
          d: petalPath(inner + 1.5, ring.r, step / 2 - 1.2),
          rotate: s * step,
        });
      }
    });
    return out;
  }, []);

  /** Every slot one tap fills: the petal itself plus its mirrors around the
   *  ring. Segment counts are multiples of 6 so this divides exactly. */
  const mirrorsOf = useCallback((ring, seg) => {
    const count = RINGS[ring].segments;
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
        if (next[key] !== flower.colour) { next[key] = flower.colour; changed = true; }
      }
      return changed ? next : prev;
    });
  }, [flower.colour, mirrorsOf]);

  function reset() {
    setFilled({});
    setRevealed(false);
  }

  /** Lays a whole pookalam at once — ring by ring, alternating two flowers so
   *  it comes out looking laid rather than scattered. For anyone who wants the
   *  picture without the minute of tapping. */
  function surpriseMe() {
    const next = {};
    RINGS.forEach((ring, ri) => {
      const a = FLOWERS[Math.floor(Math.random() * FLOWERS.length)];
      let b = FLOWERS[Math.floor(Math.random() * FLOWERS.length)];
      if (b.id === a.id) b = FLOWERS[(FLOWERS.indexOf(a) + 3) % FLOWERS.length];
      for (let s = 0; s < ring.segments; s++) next[`${ri}-${s}`] = (s % 2 ? b : a).colour;
    });
    setFilled(next);
  }

  /**
   * Rebuilds the pookalam as a standalone square image.
   *
   * Drawn fresh from state rather than screenshotting the live SVG: the one on
   * the page is styled by class, and a serialised copy of it would arrive with
   * no stylesheet and come out blank. The wordmark is painted onto the canvas
   * afterwards instead of into the SVG, because a font named inside an SVG
   * being rasterised is not guaranteed to resolve.
   */
  const buildImage = useCallback(async () => {
    const S = 1080;
    const body = petals
      .map((p) => {
        const fill = filled[p.key];
        if (!fill) return '';
        return `<path d="${p.d}" transform="rotate(${p.rotate})" fill="${fill}" stroke="rgba(255,255,255,0.28)" stroke-width="0.35"/>`;
      })
      .join('');
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="-56 -56 112 112">` +
      `<rect x="-56" y="-56" width="112" height="112" fill="${MAT}"/>` +
      `<circle r="50" fill="rgba(255,255,255,0.04)"/>` +
      `<g>${body}</g>` +
      `<circle r="6" fill="${LAMP}"/>` +
      `</svg>`;

    const canvas = document.createElement('canvas');
    canvas.width = S;
    canvas.height = S;
    const ctx = canvas.getContext('2d');

    await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => { ctx.drawImage(img, 0, 0, S, S); resolve(); };
      img.onerror = reject;
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    });

    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.font = '600 34px Georgia, "Times New Roman", serif';
    ctx.fillText('Onam ashamsakal', S / 2, S - 78);
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = '500 22px system-ui, -apple-system, Segoe UI, sans-serif';
    ctx.fillText('westerngodsorganic.com', S / 2, S - 42);

    return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  }, [petals, filled]);

  /** Share sheet where there is one, a download everywhere else. */
  async function saveImage() {
    setSaving(true);
    try {
      const blob = await buildImage();
      if (!blob) throw new Error('no image');
      const file = new File([blob], 'my-pookalam.png', { type: 'image/png' });

      if (navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: 'My pookalam' });
          return;
        } catch (err) {
          // Dismissing the share sheet is a choice, not a failure — fall
          // through to the download rather than showing an error for it.
          if (err?.name === 'AbortError') return;
        }
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'my-pookalam.png';
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
          each day. Pick a flower and tap the circle — every petal you lay is
          mirrored around it, the way a real one is set out.
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
            {/* The mat the carpet is laid on. */}
            <circle r="50" className="pookalam-ground" />
            {petals.map((p) => (
              <path
                key={p.key}
                d={p.d}
                transform={`rotate(${p.rotate})`}
                className={`pookalam-petal${filled[p.key] ? ' is-laid' : ''}`}
                style={filled[p.key] ? { fill: filled[p.key] } : undefined}
                onPointerDown={() => place(p.ring, p.seg)}
                onPointerEnter={(e) => { if (e.buttons === 1) place(p.ring, p.seg); }}
                tabIndex={-1}
              />
            ))}
            <circle r="6" className="pookalam-lamp" />
          </svg>
        </div>

        <div className="pookalam-palette" role="group" aria-label="Choose a flower">
          {FLOWERS.map((f) => (
            <button
              key={f.id}
              type="button"
              className={`pookalam-swatch${flower.id === f.id ? ' is-active' : ''}`}
              style={{ background: f.colour }}
              onClick={() => setFlower(f)}
              aria-pressed={flower.id === f.id}
              aria-label={`${f.label} — ${f.gloss}`}
              title={`${f.label} (${f.gloss})`}
            />
          ))}
        </div>
        <p className="muted" style={{ fontSize: '0.82rem', marginTop: 8, marginBottom: 10 }}>
          <b>{flower.label}</b> <span style={{ opacity: 0.75 }}>· {flower.gloss}</span> — {placed} of {TOTAL} petals laid
        </p>

        <div className="pookalam-folds" role="group" aria-label="How many times each petal is mirrored">
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
