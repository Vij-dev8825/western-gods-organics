/**
 * Lay a pookalam, ring by ring.
 *
 * Onam's flower carpet is the one ritual of the festival everybody takes part
 * in — it is laid on the doorstep over ten days, growing a ring at a time, and
 * it is made by hand out of whatever is in flower. So this is not a spin-wheel
 * with an Onam skin on it: you actually place the petals, in rings, from the
 * outside in, and it takes a minute of attention rather than one click.
 *
 * The reward is whatever offer the admin has attached to the Onam entry in the
 * festival calendar. If no code is set the pookalam is still worth laying and
 * the page says so — inventing a discount here would be writing a promise the
 * shop has not made.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import SeoMeta from '../components/SeoMeta';
import { useToast } from '../context/ToastContext';

/** Real pookalam flowers, in the colours they actually come in. Thumba is the
 *  small white flower traditionally laid on the first day. */
const FLOWERS = [
  { id: 'marigold', label: 'Marigold', colour: '#F2A20C' },
  { id: 'chrysanth', label: 'Chrysanthemum', colour: '#F6D423' },
  { id: 'rose', label: 'Rose', colour: '#D8324B' },
  { id: 'thumba', label: 'Thumba', colour: '#FBF7EE' },
  { id: 'jamanthi', label: 'Jamanthi', colour: '#E4571B' },
  { id: 'aparajita', label: 'Aparajita', colour: '#5B4B9E' },
  { id: 'leaf', label: 'Green leaf', colour: '#3E7A3A' },
];

/** Outermost first, because that is the order a pookalam is actually laid.
 *  Segment counts rise with circumference so every petal is roughly the same
 *  size to the eye. */
const RINGS = [
  { r: 46, segments: 24 },
  { r: 37, segments: 18 },
  { r: 28, segments: 14 },
  { r: 19, segments: 10 },
  { r: 11, segments: 6 },
];

const TOTAL = RINGS.reduce((n, r) => n + r.segments, 0);

/** Same format the festival calendar uses, so a customer moving between the
 *  two pages reads the same deadline written the same way. */
const shortDate = (d) =>
  new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

/** A petal as a rounded wedge, positioned by angle. Drawn from the centre so
 *  one transform places it, which keeps the DOM small enough that a phone can
 *  hold ~72 of them without complaint. */
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
  const [filled, setFilled] = useState({});
  const [onam, setOnam] = useState(null);
  const [revealed, setRevealed] = useState(false);

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
          d: petalPath(inner + 1.5, ring.r, step / 2 - 1.2),
          rotate: s * step,
        });
      }
    });
    return out;
  }, []);

  function place(key) {
    setFilled((prev) => (prev[key] === flower.colour ? prev : { ...prev, [key]: flower.colour }));
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
          each day. Choose a flower, then place the petals from the outside in.
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
            {/* The lamp the carpet is laid around. */}
            <circle r="50" className="pookalam-ground" />
            {petals.map((p) => (
              <path
                key={p.key}
                d={p.d}
                transform={`rotate(${p.rotate})`}
                className={`pookalam-petal${filled[p.key] ? ' is-laid' : ''}`}
                style={filled[p.key] ? { fill: filled[p.key] } : undefined}
                onPointerDown={() => place(p.key)}
                onPointerEnter={(e) => { if (e.buttons === 1) place(p.key); }}
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
              aria-label={f.label}
              title={f.label}
            />
          ))}
        </div>
        <p className="muted" style={{ fontSize: '0.82rem', marginTop: 6 }}>
          {flower.label} · {placed} of {TOTAL} petals laid
        </p>

        {placed > 0 && !done && (
          <button type="button" className="link-btn" onClick={() => { setFilled({}); setRevealed(false); }}>
            Start again
          </button>
        )}

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
              <button type="button" className="btn btn-ghost" onClick={() => { setFilled({}); setRevealed(false); }}>
                Lay another
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
