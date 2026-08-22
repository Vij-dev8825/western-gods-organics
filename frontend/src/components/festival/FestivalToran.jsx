/**
 * The toran hung at the door: a marigold-and-mango-leaf garland across the
 * very top of the site, with a lotus bunch at the centre — the decoration a
 * shop actually hangs across its entrance for a festival, not a banner about
 * one. The big shopping apps dress their whole header this way for a
 * festival, not just the landing page, so this sits above the nav on every
 * route rather than only in the home hero.
 *
 * It lives in normal document flow at the very top of the app shell, above
 * the sticky nav. That is deliberate: a visitor scrolls under it once, the
 * way they would walk under a real one at a doorway, and the nav takes over
 * the top of the screen from there. Fixing it in place so it followed you
 * around the shop would turn a doorway into wallpaper.
 *
 * Marigold and mango leaf are not brand colours and do not take the festival
 * palette — a real garland is marigold-orange and leaf-green regardless of
 * which festival it is hung for, the same reasoning FestivalAtmosphere
 * already uses for its cracker colours.
 */

/* Deterministic per-unit jitter, so the row is not a mechanical repeat.
   Same hash the motifs and dancers use. */
function rnd(i) {
  let x = Math.imul(i ^ 0x9e3779b9, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}
const wob = (i) => rnd(i) * 2 - 1;

const MARIGOLD = '#F2A20C';
const MARIGOLD_DEEP = '#C97D0A';
const GOLD = '#FFCB3D';
const GOLD_DEEP = '#E0A415';
const LEAF = '#3E7A3B';
const LEAF_LIGHT = '#4F8F4A';
const LEAF_DEEP = '#2A5A28';
const THREAD = '#8A5A2E';
const LOTUS = '#E85D9A';
const LOTUS_DEEP = '#C23D77';
const LOTUS_CORE = '#F2B927';
const SEPAL = '#4E8A3E';

/** A round flower head built from a rosette of petal-blobs — the same
 *  ring-of-ellipses trick the pookalam rings use, at marigold scale. */
function MarigoldBall({ cx, cy, r, colour, dark }) {
  const n = 8;
  return (
    <g>
      {Array.from({ length: n }, (_, k) => {
        const a = ((k * 360) / n - 90) * (Math.PI / 180);
        const px = cx + Math.cos(a) * r * 0.55;
        const py = cy + Math.sin(a) * r * 0.55;
        return (
          <ellipse
            key={k}
            cx={px}
            cy={py}
            rx={r * 0.34}
            ry={r * 0.48}
            fill={colour}
            transform={`rotate(${(k * 360) / n} ${px} ${py})`}
          />
        );
      })}
      <circle cx={cx} cy={cy} r={r * 0.36} fill={dark} />
    </g>
  );
}

/** One slender, pointed mango leaf hanging from (x, y), fanned by `rot`
 *  degrees. Mango leaves are lanceolate — long and narrow — not the round
 *  petal shape a wider leaf collapses into once four are crowded together. */
function MangoLeaf({ x, y, rot, len, colour }) {
  const w = len * 0.2;
  return (
    <g transform={`translate(${x}, ${y}) rotate(${rot})`}>
      <path
        d={`M 0 0 Q ${w} ${len * 0.32} 0 ${len} Q ${-w} ${len * 0.32} 0 0 Z`}
        fill={colour}
        stroke={LEAF_DEEP}
        strokeWidth="0.5"
      />
      <path d={`M 0 3 L 0 ${len - 3}`} stroke={LEAF_DEEP} strokeWidth="0.6" opacity="0.5" />
    </g>
  );
}

/** One repeat of the garland: a thread off the cord, a two-tone marigold
 *  pair, and a leaf tuft hanging under it. Every fourth is a little larger,
 *  a real string of hand-tied rounds is never perfectly even. */
function ToranUnit({ seed }) {
  const big = seed % 4 === 0;
  const drop = 15 + wob(seed) * 3 + (big ? 4 : 0);
  const r1 = big ? 14 : 11.5;
  const r2 = big ? 10 : 8.5;
  const leafLen = big ? 22 : 18;
  const leafY = drop + r1 * 0.6 + r2 * 0.9;

  return (
    <svg
      className="fest-toran-unit"
      viewBox="0 0 54 84"
      width="54"
      height="84"
      style={{ '--i': seed, '--delay': `${(wob(seed + 50) * 1.4).toFixed(2)}s` }}
      aria-hidden="true"
    >
      <path d={`M 27 0 L 27 ${drop - r1 * 0.6}`} stroke={THREAD} strokeWidth="1.1" />
      <MarigoldBall cx={27} cy={drop} r={r1} colour={MARIGOLD} dark={MARIGOLD_DEEP} />
      <MarigoldBall cx={27} cy={drop + r1 * 0.55} r={r2} colour={GOLD} dark={GOLD_DEEP} />
      {/* A wide fan, longest leaf centred, the way a real hand of mango
          leaves is tied — four leaves this close together at a narrow
          spread once fused into a single dark spike rather than a fan. */}
      {[[-50, 0.72], [-24, 0.9], [0, 1], [24, 0.9], [50, 0.72]].map(([rot, s], i) => (
        <MangoLeaf
          key={i}
          x={27}
          y={leafY}
          rot={rot}
          len={leafLen * s}
          colour={i % 2 ? LEAF_LIGHT : LEAF}
        />
      ))}
    </svg>
  );
}

/** A small brass bell/tassel hung between the marigold rounds — the accent
 *  that keeps a long repeating string from reading as one stamp copied down
 *  the row. Three threads and a bead each, the way a real kuchu is tied. */
function Tassel({ seed }) {
  const drop = 9 + wob(seed) * 2;
  const bellY = drop + 4;
  return (
    <svg
      className="fest-toran-unit fest-toran-tassel"
      viewBox="0 0 28 58"
      width="28"
      height="58"
      style={{ '--i': seed, '--delay': `${(wob(seed + 80) * 1.4).toFixed(2)}s` }}
      aria-hidden="true"
    >
      <path d={`M 14 0 L 14 ${drop}`} stroke={THREAD} strokeWidth="1" />
      {/* Outlined in the thread's own brown, not a darker gold — gold-on-gold
         reads fine against a dark hero but almost vanishes against the
         page's own pale ground, which is what this hangs over everywhere
         except the few pixels where the lotus dips into the hero below. */}
      <circle cx="14" cy={bellY} r="4.4" fill={GOLD} stroke={THREAD} strokeWidth="0.9" />
      <circle cx="12.6" cy={bellY - 1.3} r="1.1" fill="#fff" opacity="0.55" />
      {[-3.4, 0, 3.4].map((dx, i) => {
        const len = 15 + (i === 1 ? 5 : 0) + wob(seed * 3 + i) * 2;
        const y0 = bellY + 3.6;
        return (
          <g key={i}>
            <path d={`M ${14 + dx} ${y0} L ${14 + dx} ${y0 + len}`} stroke={THREAD} strokeWidth="0.9" />
            <circle cx={14 + dx} cy={y0 + len} r="1.7" fill={GOLD_DEEP} stroke={THREAD} strokeWidth="0.6" />
          </g>
        );
      })}
    </svg>
  );
}

/** A single lotus head: pointed petals fanned from a point, unlike the
 *  marigold's round pom-pom, so the centrepiece reads as a different
 *  flower rather than a bigger marigold. */
function LotusBloom({ r }) {
  const n = 7;
  return (
    <g>
      {Array.from({ length: n }, (_, k) => (
        <path
          key={k}
          transform={`rotate(${(k * 360) / n})`}
          d={`M 0 0 Q ${r * 0.3} ${r * 0.5} 0 ${r} Q ${-r * 0.3} ${r * 0.5} 0 0 Z`}
          fill={k % 2 ? LOTUS : LOTUS_DEEP}
        />
      ))}
      <path d="M -4 -1 Q 0 -6 4 -1 Z" fill={SEPAL} />
      <circle r={r * 0.2} fill={LOTUS_CORE} />
    </g>
  );
}

/** The centrepiece: three lotus heads hanging lower than the garland either
 *  side of it, the way the flanking rounds in a real toran always hang
 *  shorter than the middle one. */
function LotusPendant() {
  return (
    <svg className="fest-toran-lotus" viewBox="0 0 96 118" aria-hidden="true">
      <path d="M 20 0 L 20 30" stroke={THREAD} strokeWidth="1.1" />
      <path d="M 76 0 L 76 30" stroke={THREAD} strokeWidth="1.1" />
      <path d="M 48 0 L 48 54" stroke={THREAD} strokeWidth="1.2" />
      <g transform="translate(20, 42)"><LotusBloom r={15} /></g>
      <g transform="translate(76, 42)"><LotusBloom r={15} /></g>
      <g transform="translate(48, 76)"><LotusBloom r={22} /></g>
    </svg>
  );
}

const MARIGOLD_COUNT = 14;

/* One flat list, marigold and tassel already interleaved, rather than two
   arrays merged at render time — simplest to get right, and there is
   exactly one place a key could go missing instead of two. */
const GARLAND_ITEMS = Array.from({ length: MARIGOLD_COUNT }, (_, i) => i).flatMap((i) => [
  { kind: 'marigold', seed: i },
  { kind: 'tassel', seed: i },
]);

export default function FestivalToran({ theme, animation, onHome }) {
  if (!theme) return null;
  /* Same switches FestivalAtmosphere already honours — one setting for all
     of the shop's seasonal dressing, not a second toggle to remember. */
  if (animation?.enabled === false) return null;
  if (animation?.scope === 'home' && !onHome) return null;

  return (
    <div className="fest-toran" aria-hidden="true">
      <div className="fest-toran-cord" />
      <div className="fest-toran-row">
        {/* A tassel between every round, not just marigold after marigold —
            the alternation is what keeps a long row from reading as one
            stamp repeated down the page. */}
        {GARLAND_ITEMS.map((it) =>
          it.kind === 'marigold' ? (
            <ToranUnit key={`m${it.seed}`} seed={it.seed} />
          ) : (
            <Tassel key={`t${it.seed}`} seed={it.seed} />
          )
        )}
      </div>
      <LotusPendant />
    </div>
  );
}
