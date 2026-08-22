/**
 * The toran hung at the door: a garland across the very top of the site,
 * with a flower or bell bunch at the centre — the decoration a shop
 * actually hangs across its entrance for a festival, not a banner about
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
 * THREE VARIETIES, chosen by the admin (see AdminFestivals.jsx), because
 * one fixed garland forever is what makes a shop's decoration look like it
 * was set once and forgotten:
 *
 *   marigold  orange rounds and gold tassels, mango leaf fans, lotus centre
 *   jasmine   a dense white string, barely any gap, a rose bunch centre
 *   bells     brass bells and mango leaf, no flowers at all
 *
 * None of the three take the festival's own palette — a real garland is
 * whatever colour that flower or metal actually is regardless of which
 * festival it is hung for, the same reasoning FestivalAtmosphere already
 * uses for its cracker colours.
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
const JASMINE = '#FFFDF6';
const JASMINE_SHADE = '#F0E7CE';
const CALYX = '#5E9A4A';
const ROSE = '#E24E7E';
const ROSE_DEEP = '#A82C58';
const BRASS = '#D9A63E';
const BRASS_DEEP = '#A9761F';
const BRASS_DARK = '#7A5314';
const BANANA_STEM = '#93B855';
const BANANA_STEM_DEEP = '#6E8F37';
const BANANA_LEAF = '#4C8C3B';
const BANANA_LEAF_DEEP = '#356028';
const BANANA_MIDRIB = '#C7E6A4';
const BANANA_FLOWER = '#7A3350';
const BANANA_FLOWER_DEEP = '#4E1F35';
const COCONUT_TRUNK = '#B99257';
const COCONUT_TRUNK_DEEP = '#8A6B3B';
const COCONUT_FROND = '#3D8A4E';
const COCONUT_FROND_LIGHT = '#4FA25E';
const COCONUT_FROND_DEEP = '#2C6B3A';
const COCONUT_NUT = '#7A5A34';
const COCONUT_NUT_DEEP = '#54391E';

/* ==========================================================================
 * Shapes shared across more than one variety
 * ======================================================================== */

/** A round flower head built from a rosette of petal-blobs — the same
 *  ring-of-ellipses trick the pookalam rings use, at marigold scale. */
function RoundBloom({ cx, cy, r, colour, dark, n = 8 }) {
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

/** The standard mango leaf fan, five wide with the longest centred — used
 *  under a garland round in every variety that carries leaves at all. */
function LeafFan({ y, len, i0 = 0 }) {
  return (
    <>
      {[[-50, 0.72], [-24, 0.9], [0, 1], [24, 0.9], [50, 0.72]].map(([rot, s], i) => (
        <MangoLeaf
          key={i0 + i}
          x={27}
          y={y}
          rot={rot}
          len={len * s}
          colour={i % 2 ? LEAF_LIGHT : LEAF}
        />
      ))}
    </>
  );
}

/** A flower built from pointed, single-layer petals rather than a round
 *  pom-pom — the shape every variety's centrepiece uses, so "this is the
 *  special one in the middle" reads the same way regardless of which
 *  garland is hanging above it. Colour is the only thing that changes. */
function PetalFanBloom({ r, colour, dark, core, n = 7 }) {
  return (
    <g>
      {Array.from({ length: n }, (_, k) => (
        <path
          key={k}
          transform={`rotate(${(k * 360) / n})`}
          d={`M 0 0 Q ${r * 0.3} ${r * 0.5} 0 ${r} Q ${-r * 0.3} ${r * 0.5} 0 0 Z`}
          fill={k % 2 ? colour : dark}
        />
      ))}
      <path d="M -4 -1 Q 0 -6 4 -1 Z" fill={SEPAL} />
      <circle r={r * 0.2} fill={core} />
    </g>
  );
}

/** Three heads on three threads, the flanking pair shorter than the centre
 *  — the shape every variety's pendant hangs in, only the head differs. */
function ThreeUpPendant({ className, viewBox, Head }) {
  return (
    <svg className={className} viewBox={viewBox} aria-hidden="true">
      <path d="M 20 0 L 20 30" stroke={THREAD} strokeWidth="1.1" />
      <path d="M 76 0 L 76 30" stroke={THREAD} strokeWidth="1.1" />
      <path d="M 48 0 L 48 54" stroke={THREAD} strokeWidth="1.2" />
      <g transform="translate(20, 42)"><Head r={15} /></g>
      <g transform="translate(76, 42)"><Head r={15} /></g>
      <g transform="translate(48, 76)"><Head r={22} /></g>
    </svg>
  );
}

/* ==========================================================================
 * Marigold & mango leaf
 * ======================================================================== */

/** One repeat of the garland: a thread off the cord, a two-tone marigold
 *  pair, and a leaf tuft hanging under it. Every fourth is a little larger,
 *  a real string of hand-tied rounds is never perfectly even. */
function MarigoldUnit({ seed }) {
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
      <RoundBloom cx={27} cy={drop} r={r1} colour={MARIGOLD} dark={MARIGOLD_DEEP} />
      <RoundBloom cx={27} cy={drop + r1 * 0.55} r={r2} colour={GOLD} dark={GOLD_DEEP} />
      {/* A wide fan, longest leaf centred, the way a real hand of mango
          leaves is tied — four leaves this close together at a narrow
          spread once fused into a single dark spike rather than a fan. */}
      <LeafFan y={leafY} len={leafLen} />
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
         except the few pixels where a pendant dips into the hero below. */}
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

const MARIGOLD_COUNT = 14;

/* One flat list, marigold and tassel already interleaved, rather than two
   arrays merged at render time — simplest to get right, and there is
   exactly one place a key could go missing instead of two. */
const MARIGOLD_ITEMS = Array.from({ length: MARIGOLD_COUNT }, (_, i) => i).flatMap((i) => [
  { kind: 'marigold', seed: i },
  { kind: 'tassel', seed: i },
]);

function MarigoldRow() {
  return MARIGOLD_ITEMS.map((it) =>
    it.kind === 'marigold' ? (
      <MarigoldUnit key={`m${it.seed}`} seed={it.seed} />
    ) : (
      <Tassel key={`t${it.seed}`} seed={it.seed} />
    )
  );
}

function LotusHead({ r }) {
  return <PetalFanBloom r={r} colour={LOTUS} dark={LOTUS_DEEP} core={LOTUS_CORE} />;
}

function MarigoldPendant() {
  return <ThreeUpPendant className="fest-toran-lotus" viewBox="0 0 96 118" Head={LotusHead} />;
}

/* ==========================================================================
 * Jasmine string
 *
 * A mullapoo string is dense and nearly leafless — the opposite rhythm from
 * marigold's spaced, leaf-heavy rounds — so the row here is smaller units
 * packed close, and only the odd one in three carries a leaf sprig at all.
 * ======================================================================== */

/** A posy of small overlapping buds rather than one bigger bloom — a single
 *  jasmine flower is tiny, so what a string actually shows is a cluster. */
/** White-on-cream is a colour that is only ever wrong for this site — the
 *  page it hangs over is cream itself, so an unbordered white bud vanishes
 *  into the very ground it is meant to stand on. A green outline (the same
 *  green as its own calyx, not a second colour to introduce) is what a
 *  drop-shadow alone could not give it: a crisp edge regardless of what is
 *  behind it. */
function JasmineBud({ cx, cy, r }) {
  const offsets = [[0, -r * 0.4], [r * 0.55, r * 0.15], [-r * 0.55, r * 0.15], [0, r * 0.55]];
  return (
    <g>
      {offsets.map(([dx, dy], i) => (
        <circle
          key={i}
          cx={cx + dx}
          cy={cy + dy}
          r={r * 0.5}
          fill={i % 2 ? JASMINE_SHADE : JASMINE}
          stroke={CALYX}
          strokeWidth={r * 0.09}
        />
      ))}
      <path d={`M ${cx - 2.4} ${cy - r - 1} Q ${cx} ${cy - r - 4.4} ${cx + 2.4} ${cy - r - 1} Z`} fill={CALYX} />
    </g>
  );
}

function JasmineUnit({ seed }) {
  const drop = 10 + wob(seed) * 2;
  const r1 = 7.6;
  const r2 = 6.2;
  const y2 = drop + r1 * 1.15;
  const hasSprig = seed % 3 === 0;

  return (
    <svg
      className="fest-toran-unit fest-toran-jasmine-unit"
      viewBox="0 0 32 62"
      width="32"
      height="62"
      style={{ '--i': seed, '--delay': `${(wob(seed + 30) * 1.3).toFixed(2)}s` }}
      aria-hidden="true"
    >
      <path d={`M 16 0 L 16 ${drop - r1 * 0.7}`} stroke={THREAD} strokeWidth="0.8" />
      <JasmineBud cx={16} cy={drop} r={r1} />
      <JasmineBud cx={16} cy={y2} r={r2} />
      {hasSprig && (
        <>
          <MangoLeaf x={16} y={y2 + r2 * 0.7} rot={-26} len={13} colour={LEAF} />
          <MangoLeaf x={16} y={y2 + r2 * 0.7} rot={22} len={13} colour={LEAF_LIGHT} />
        </>
      )}
    </svg>
  );
}

const JASMINE_COUNT = 26;

function JasmineRow() {
  return Array.from({ length: JASMINE_COUNT }, (_, i) => <JasmineUnit key={i} seed={i} />);
}

function RoseHead({ r }) {
  return <PetalFanBloom r={r} colour={ROSE} dark={ROSE_DEEP} core={GOLD} n={8} />;
}

function JasminePendant() {
  return <ThreeUpPendant className="fest-toran-lotus" viewBox="0 0 96 118" Head={RoseHead} />;
}

/* ==========================================================================
 * Bells & mango leaf
 *
 * No flowers at all — brass rounds and leaf only, for a shop that wants the
 * doorway dressed without it reading as any one flower's colour.
 * ======================================================================== */

/** A temple bell: a flared skirt, a rim, and a clapper hanging just below
 *  it — not a circle standing in for a bell, which reads as a bauble. */
function Bell({ cx, cy, r }) {
  const top = cy - r;
  const bottom = cy + r * 0.55;
  const w = r * 0.85;
  return (
    <g>
      <path d="M 0 0 Q 0 -3 0 -5" transform={`translate(${cx}, ${top})`} stroke={THREAD} strokeWidth="1" />
      <circle cx={cx} cy={top - 5.5} r="1.6" fill="none" stroke={BRASS_DARK} strokeWidth="1" />
      <path
        d={`M ${cx - w * 0.35} ${top} Q ${cx - w} ${cy} ${cx - w * 0.9} ${bottom}
            Q ${cx} ${bottom + r * 0.22} ${cx + w * 0.9} ${bottom}
            Q ${cx + w} ${cy} ${cx + w * 0.35} ${top} Z`}
        fill={BRASS}
        stroke={BRASS_DARK}
        strokeWidth="0.7"
      />
      <path d={`M ${cx - w * 0.9} ${bottom} Q ${cx} ${bottom + r * 0.22} ${cx + w * 0.9} ${bottom}`} fill={BRASS_DEEP} />
      <ellipse cx={cx - w * 0.25} cy={cy - r * 0.2} rx={w * 0.22} ry={r * 0.5} fill="#fff" opacity="0.28" />
      <path d={`M ${cx} ${bottom} L ${cx} ${bottom + r * 0.5}`} stroke={THREAD} strokeWidth="0.8" />
      <circle cx={cx} cy={bottom + r * 0.6} r={r * 0.16} fill={BRASS_DARK} />
    </g>
  );
}

function BellUnit({ seed }) {
  const big = seed % 4 === 0;
  const drop = 16 + wob(seed) * 3 + (big ? 3 : 0);
  const r = big ? 8.5 : 7;
  const leafLen = big ? 20 : 16;
  const leafY = drop + r * 1.5;

  return (
    <svg
      className="fest-toran-unit"
      viewBox="0 0 46 80"
      width="46"
      height="80"
      style={{ '--i': seed, '--delay': `${(wob(seed + 60) * 1.4).toFixed(2)}s` }}
      aria-hidden="true"
    >
      <path d={`M 23 0 L 23 ${drop - r}`} stroke={THREAD} strokeWidth="1" />
      <Bell cx={23} cy={drop} r={r} />
      <LeafFan y={leafY} len={leafLen} />
    </svg>
  );
}

const BELL_COUNT = 16;

function BellRow() {
  return Array.from({ length: BELL_COUNT }, (_, i) => <BellUnit key={i} seed={i} />);
}

function BigBellHead({ r }) {
  return <Bell cx={0} cy={r * 0.15} r={r * 0.85} />;
}

function BellsPendant() {
  return <ThreeUpPendant className="fest-toran-lotus" viewBox="0 0 96 118" Head={BigBellHead} />;
}

/* ==========================================================================
 * Banana and coconut trees, flanking the garland
 *
 * Not a fourth variety — a real pandal ties a banana stem to each side of
 * the entrance and strings the flowers between them, so these stand at the
 * two ends of every variety rather than replacing any of them. Taller than
 * anything else here on purpose: a flanking tree that stopped at the same
 * height as the garland would read as another round on the string, not a
 * pair of trees the garland is hung between.
 * ======================================================================== */

/** One broad banana leaf, fanned by `rot` from the crown. Wide rather than
 *  lanceolate — the opposite ratio from a mango leaf — with a pale midrib
 *  standing out against the blade, which is what a banana leaf actually
 *  looks like and what tells the two trees apart at a glance. */
function BananaLeaf({ rot, len }) {
  const w = len * 0.34;
  return (
    <g transform={`rotate(${rot})`}>
      <path
        d={`M 0 0 Q ${w} ${len * 0.3} ${w * 0.32} ${len} Q 0 ${len * 1.06} ${-w * 0.32} ${len} Q ${-w} ${len * 0.3} 0 0 Z`}
        fill={BANANA_LEAF}
        stroke={BANANA_LEAF_DEEP}
        strokeWidth="0.7"
      />
      <path d={`M 0 2 Q ${w * 0.1} ${len * 0.5} 0 ${len * 0.97}`} stroke={BANANA_MIDRIB} strokeWidth="1.6" fill="none" opacity="0.85" />
    </g>
  );
}

/** The stem, three leaves fanned up and out from the crown, and the
 *  drooping maroon flower a banana stem is actually recognised by. */
function BananaTree() {
  const trunkTop = 84;
  const trunkBottom = 178;
  return (
    <svg className="fest-toran-tree fest-toran-tree-banana" viewBox="0 0 74 190" aria-hidden="true">
      <path
        d={`M ${37 - 9} ${trunkBottom} Q ${37 - 8} ${(trunkTop + trunkBottom) / 2} ${37 - 6.4} ${trunkTop}
            L ${37 + 6.4} ${trunkTop}
            Q ${37 + 8} ${(trunkTop + trunkBottom) / 2} ${37 + 9} ${trunkBottom} Z`}
        fill={BANANA_STEM}
        stroke={BANANA_STEM_DEEP}
        strokeWidth="0.8"
      />
      {/* Leaf-scar rings, the way a real pseudostem is banded. */}
      {[118, 145, 165].map((y, i) => (
        <path key={i} d={`M ${37 - 8 + i * 0.3} ${y} Q 37 ${y + 4} ${37 + 8 - i * 0.3} ${y}`} stroke={BANANA_STEM_DEEP} strokeWidth="0.8" fill="none" opacity="0.6" />
      ))}
      <g transform={`translate(37, ${trunkTop})`}>
        <BananaLeaf rot={215} len={56} />
        <BananaLeaf rot={180} len={62} />
        <BananaLeaf rot={145} len={56} />
        {/* The inflorescence — a maroon teardrop on its own short stalk,
            the single most recognisable feature of a real banana stem. */}
        <path d="M 0 0 L 3 22" stroke={BANANA_STEM_DEEP} strokeWidth="1.4" />
        <path d="M 3 20 Q 11 26 8 40 Q 3 46 -1 38 Q -3 26 3 20 Z" fill={BANANA_FLOWER} stroke={BANANA_FLOWER_DEEP} strokeWidth="0.7" />
      </g>
    </svg>
  );
}

/** One long, thin coconut frond fanned by `rot` from the crown — a blade a
 *  fraction of a banana leaf's width, which is the whole difference between
 *  the two silhouettes at this scale. */
function CoconutFrond({ rot, len, colour }) {
  const w = len * 0.12;
  return (
    <g transform={`rotate(${rot})`}>
      <path
        d={`M 0 0 Q ${w} ${len * 0.35} ${w * 0.4} ${len} Q 0 ${len * 1.04} ${-w * 0.4} ${len} Q ${-w} ${len * 0.35} 0 0 Z`}
        fill={colour}
        stroke={COCONUT_FROND_DEEP}
        strokeWidth="0.5"
      />
    </g>
  );
}

/** A slender, slightly leaning trunk, a starburst crown of fronds, and a
 *  cluster of nuts tucked under it — the tall, thin silhouette that reads
 *  as a coconut palm next to the banana tree's broad-leaved one. The trunk
 *  is deliberately long: a coconut palm's whole character is height, and a
 *  short one just reads as a shrub with a strange haircut.
 *
 *  The crown sits well clear of the viewBox's own top and side edges —
 *  nested <svg> elements clip to their viewBox by default, and the first
 *  pass put the fronds' own tips a good ten pixels past that edge, which
 *  silently cut every frond off short rather than erroring anywhere. */
function CoconutTree() {
  const bottomX = 46;
  const bottomY = 320;
  const topX = 52;
  const topY = 70;
  return (
    <svg className="fest-toran-tree fest-toran-tree-coconut" viewBox="0 0 104 330" aria-hidden="true">
      <path
        d={`M ${bottomX - 4} ${bottomY} Q ${bottomX - 3} ${(topY + bottomY) / 2} ${topX - 3} ${topY}
            L ${topX + 3} ${topY}
            Q ${bottomX + 3} ${(topY + bottomY) / 2} ${bottomX + 4} ${bottomY} Z`}
        fill={COCONUT_TRUNK}
        stroke={COCONUT_TRUNK_DEEP}
        strokeWidth="0.7"
      />
      {[130, 190, 250].map((y, i) => {
        const t = (y - topY) / (bottomY - topY);
        const x = topX + (bottomX - topX) * t;
        return <path key={i} d={`M ${x - 4} ${y + 3} L ${x + 4} ${y - 3}`} stroke={COCONUT_TRUNK_DEEP} strokeWidth="0.7" opacity="0.55" />;
      })}
      {/* Nuts tucked just under the crown before the fronds start. */}
      <g transform={`translate(${topX}, ${topY + 9})`}>
        <circle cx={-5} cy={4} r="4.4" fill={COCONUT_NUT} stroke={COCONUT_NUT_DEEP} strokeWidth="0.6" />
        <circle cx={4} cy={6} r="4.4" fill={COCONUT_NUT} stroke={COCONUT_NUT_DEEP} strokeWidth="0.6" />
        <circle cx={0} cy={-1} r="4.4" fill={COCONUT_NUT} stroke={COCONUT_NUT_DEEP} strokeWidth="0.6" />
      </g>
      <g transform={`translate(${topX}, ${topY})`}>
        {[[128, 0.82], [155, 0.94], [182, 1], [209, 1], [236, 0.94], [263, 0.82]].map(([rot, s], i) => (
          <CoconutFrond key={i} rot={rot} len={50 * s} colour={i % 2 ? COCONUT_FROND_LIGHT : COCONUT_FROND} />
        ))}
      </g>
    </svg>
  );
}

/* ==========================================================================
 * The three on offer
 * ======================================================================== */

const VARIETIES = {
  marigold: { Row: MarigoldRow, Pendant: MarigoldPendant, rowClass: '' },
  jasmine: { Row: JasmineRow, Pendant: JasminePendant, rowClass: 'fest-toran-row-jasmine' },
  bells: { Row: BellRow, Pendant: BellsPendant, rowClass: 'fest-toran-row-bells' },
};

export default function FestivalToran({ theme, animation, onHome }) {
  if (!theme) return null;
  /* Same switches FestivalAtmosphere already honours — one setting for all
     of the shop's seasonal dressing, not a second toggle to remember. */
  if (animation?.enabled === false) return null;
  if (animation?.scope === 'home' && !onHome) return null;

  const variety = VARIETIES[animation?.toranStyle] || VARIETIES.marigold;
  const { Row, Pendant, rowClass } = variety;

  return (
    <div className="fest-toran" aria-hidden="true">
      <BananaTree />
      <CoconutTree />
      {/* Inset by the width of the two trees, so the row's own edge-to-edge
          spacing does not land its first and last round directly under a
          trunk. */}
      <div className="fest-toran-garland">
        <div className="fest-toran-cord" />
        <div className={`fest-toran-row ${rowClass}`}>
          <Row />
        </div>
        <Pendant />
      </div>
    </div>
  );
}
