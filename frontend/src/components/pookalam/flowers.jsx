/**
 * The fifteen flowers a pookalam is laid with, drawn as botanical SVG.
 *
 * The first version of this file made every bloom the same way — a ring of
 * identical ellipses in one flat colour with a dark outline round each — and it
 * came out looking like clip art. Four things were wrong, and all four are what
 * this file now does differently:
 *
 *   1. SILHOUETTE. A petal is a bezier outline with its own waist, belly, tip
 *      and lean, not an ellipse. A marigold ray floret, a hibiscus petal and a
 *      jasmine petal are genuinely different shapes, so they are generated from
 *      genuinely different parameters.
 *   2. TONE. Every whorl is filled with a radial gradient centred on the
 *      flower's own centre, so petals are deep and shadowed where they emerge
 *      and light at the tip — the way a real one catches the sun. Flat fill is
 *      the single loudest cartoon tell.
 *   3. IRREGULARITY. Real petals do not sit at exactly 360/n degrees all the
 *      same length. Each gets a small deterministic wobble in angle, length and
 *      width, hashed from its index so the art never changes between renders.
 *   4. NO INK OUTLINE. Petals are separated by a hairline stroke in a darker
 *      tone of their own colour at low opacity, not by a black keyline.
 *
 * The species are drawn as themselves rather than as recoloured rosettes:
 * shankhupushpam is a pea flower with a standard, wings and a keel; chembarathi
 * carries its long staminal column and stigma knobs; sunflower has a real seed
 * disc on a golden-angle spiral; tulsi is a leaf sprig, because it is a sprig;
 * the three chethis are corymbs of four-lobed florets at three different
 * densities; vadamalli is a globe of papery bracts.
 *
 * PERFORMANCE. Two hundred blooms can be on the mat at once, so a whole whorl
 * of petals is emitted as ONE <path> with one subpath per petal — the rotation
 * is baked into the coordinates instead of costing a node each. A typical bloom
 * is 5–8 elements rather than 50. That is also why the gradients are radial and
 * centred on the origin: one gradient serves every petal in the whorl.
 *
 * EXPORT. `bloomChildren` returns plain descriptor objects, never React
 * elements, so `exporter.js` can serialise the identical art into a standalone
 * SVG for the PNG. Screen and downloaded image cannot drift apart because they
 * are built from the same call. `flowerDefs` hands out the gradient
 * definitions, which the board and the exporter each place once in a <defs>
 * rather than repeating per bloom.
 */

/* ==========================================================================
 * Colour helpers
 * ======================================================================== */

function hex2rgb(hex) {
  const h = hex.replace('#', '');
  const s = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
}

function rgb2hex([r, g, b]) {
  const c = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** Blend two colours. t=0 gives a, t=1 gives b. */
export function mix(a, b, t) {
  const A = hex2rgb(a);
  const B = hex2rgb(b);
  return rgb2hex([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t]);
}

/** Darken (amount < 0) or lighten (amount > 0) towards black/white. */
export function shade(hex, amount) {
  return amount < 0 ? mix(hex, '#000000', -amount) : mix(hex, '#ffffff', amount);
}

/* ==========================================================================
 * Geometry
 * ======================================================================== */

/** Two decimals is plenty at this scale and keeps the path strings short. */
const n = (v) => {
  const r = Math.round(v * 100) / 100;
  return Object.is(r, -0) ? 0 : r;
};

/** Deterministic pseudo-random in [0,1) from an integer. No Math.random, so
 *  the same flower is byte-identical on every render and in the export. */
function rnd(i) {
  let x = Math.imul(i ^ 0x9e3779b9, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

/** Signed wobble in [-1,1). */
const wob = (i) => rnd(i) * 2 - 1;

function rotate([x, y], deg) {
  const a = (deg * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [x * c - y * s, x * s + y * c];
}

/** Serialise a command list, rotating every point by `deg` about the origin. */
function emit(cmds, deg = 0, dx = 0, dy = 0) {
  let out = '';
  for (const { c, p } of cmds) {
    out += c;
    if (p) {
      for (const pt of p) {
        const [x, y] = deg ? rotate(pt, deg) : pt;
        out += ` ${n(x + dx)} ${n(y + dy)}`;
      }
    }
    out += ' ';
  }
  return out;
}

/**
 * One petal, pointing up (negative y), as a command list so it can be rotated
 * into a whorl without a transform.
 *
 *   b        how far from the centre the petal starts
 *   len      distance from centre to tip
 *   wid      half-width at the widest point
 *   belly    where along the petal it is widest — .35 near the base (lanceolate),
 *            .70 near the tip (spatulate)
 *   waist    how pinched it is where it joins the centre
 *   scallops 1 = a smooth round tip, 2-3 = a wavy or frilled edge
 *   pointed  converge to a sharp apex instead
 *   curl     lean to one side, which is what stops a whorl looking stamped
 */
function petalCmds({
  b = 5,
  len = 44,
  wid = 11,
  belly = 0.55,
  waist = 0.34,
  scallops = 1,
  pointed = false,
  curl = 0,
}) {
  const yB = -b;
  const yT = -len;
  const span = len - b;
  const yW = -(b + span * belly);
  const xW = wid;
  const xB = wid * waist;
  const lean = curl * wid;
  const yS = yT + span * (pointed ? 0.2 : 0.13);
  const xS = xW * (pointed ? 0.4 : 0.56);

  const cmds = [{ c: 'M', p: [[0, yB]] }];

  /* Left flank: base out to the widest point, then in to the shoulder. */
  cmds.push({
    c: 'C',
    p: [
      [-xB + lean * 0.35, yB],
      [-xW + lean * 0.5, yW + span * 0.2],
      [-xS, yS],
    ],
  });

  /* The tip. */
  if (pointed) {
    cmds.push({ c: 'Q', p: [[-xS * 0.42 + lean, yT + span * 0.03], [lean * 0.6, yT]] });
    cmds.push({ c: 'Q', p: [[xS * 0.42 + lean, yT + span * 0.03], [xS, yS]] });
  } else {
    const steps = 2 * Math.max(1, scallops);
    const pts = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const env = Math.sin(Math.PI * t);
      pts.push([-xS + 2 * xS * t + lean * 0.7 * env, yS + (yT - yS) * env]);
    }
    const bulge = span * (steps === 2 ? 0.07 : 0.028);
    for (let i = 0; i < steps; i++) {
      const [x0, y0] = pts[i];
      const [x1, y1] = pts[i + 1];
      cmds.push({ c: 'Q', p: [[(x0 + x1) / 2, (y0 + y1) / 2 - bulge], [x1, y1]] });
    }
  }

  /* Right flank back to the base. */
  cmds.push({
    c: 'C',
    p: [
      [xW + lean * 0.5, yW + span * 0.2],
      [xB + lean * 0.35, yB],
      [0, yB],
    ],
  });
  cmds.push({ c: 'Z' });
  return cmds;
}

/**
 * A ring of petals as a single path. Each petal gets a small hashed wobble in
 * angle, length and width — this is what separates a flower from a cog.
 */
function whorl({ count, phase = 0, seed = 1, jitAngle = 2.6, jitLen = 0.07, jitWid = 0.09, ...petal }) {
  const step = 360 / count;
  let d = '';
  for (let i = 0; i < count; i++) {
    const k = seed * 131 + i * 7;
    d += emit(
      petalCmds({
        ...petal,
        len: petal.len * (1 + wob(k + 1) * jitLen),
        wid: (petal.wid ?? 11) * (1 + wob(k + 2) * jitWid),
        curl: (petal.curl ?? 0) + wob(k + 3) * 0.06,
      }),
      phase + i * step + wob(k + 4) * jitAngle
    );
  }
  return d.trim();
}

/** Many small circles as one path, so a seed disc or a floret cluster costs a
 *  single node instead of forty. */
function dots(list, radius) {
  let d = '';
  for (const [x, y, rr] of list) {
    const r = rr ?? radius;
    d += `M ${n(x - r)} ${n(y)} a ${n(r)} ${n(r)} 0 1 0 ${n(r * 2)} 0 a ${n(r)} ${n(r)} 0 1 0 ${n(-r * 2)} 0 `;
  }
  return d.trim();
}

/** Straight strokes as one path — petal midribs, veins, stamens. */
function lines(list) {
  let d = '';
  for (const [x1, y1, x2, y2] of list) d += `M ${n(x1)} ${n(y1)} L ${n(x2)} ${n(y2)} `;
  return d.trim();
}

/* ==========================================================================
 * Colour families
 * ======================================================================== */

export const FAMILIES = [
  { id: 'all', label: 'All colours', swatch: '#5b6651' },
  { id: 'orange', label: 'Orange', swatch: '#e8721a' },
  { id: 'red', label: 'Red', swatch: '#bf3d2e' },
  { id: 'yellow', label: 'Yellow', swatch: '#e4a52b' },
  { id: 'magenta', label: 'Magenta', swatch: '#c0347e' },
  { id: 'purple', label: 'Purple', swatch: '#7b4b9c' },
  { id: 'blue', label: 'Blue', swatch: '#3f5fbf' },
  { id: 'white', label: 'White', swatch: '#fffdf6' },
  { id: 'green', label: 'Green', swatch: '#608d51' },
];

/* ==========================================================================
 * The flowers
 *
 * `c` is the species palette: deep is the shadowed base, light the sunlit tip,
 * ctr the centre, and accent whatever the species actually shows off — pollen,
 * stigma, a throat blotch. Hand-picked rather than computed, because a real
 * marigold shifts hue from orange at the base to gold at the tip and a
 * lightened orange does not.
 * ======================================================================== */

export const FLOWERS = [
  {
    id: 'chendumalli',
    label: 'Chendumalli',
    gloss: 'African marigold',
    family: 'orange',
    kind: 'pompon',
    c: { deep: '#a83c04', mid: '#e2700c', light: '#f9ac2b', ctr: '#c85a06', accent: '#ffd166' },
  },
  {
    id: 'red-chethi',
    label: 'Red Chethi',
    gloss: 'ixora',
    family: 'red',
    kind: 'corymb',
    corymb: { lobe: 11, rings: [[0, 1], [12, 7], [22, 10], [32, 12]] },   // 30 florets
    c: { deep: '#7d1410', mid: '#c22a20', light: '#e8564a', ctr: '#8f1d16', accent: '#ffe9c9' },
  },
  {
    id: 'marigold',
    label: 'Marigold',
    gloss: 'French marigold',
    family: 'orange',
    kind: 'pompon',
    crested: true,
    c: { deep: '#b35b02', mid: '#eb9a10', light: '#fbd martial', ctr: '#d47a04', accent: '#fff0b8' },
  },
  {
    id: 'chembarathi',
    label: 'Chembarathi',
    gloss: 'hibiscus',
    family: 'red',
    kind: 'trumpet',
    c: { deep: '#8a1112', mid: '#cf2225', light: '#ec5f52', ctr: '#5e0a10', accent: '#f7d24a' },
  },
  {
    id: 'flame',
    label: 'Flame Bloom',
    gloss: 'ixora javanica',
    family: 'orange',
    kind: 'star',
    c: { deep: '#a52a05', mid: '#e2540c', light: '#f79235', ctr: '#c03a06', accent: '#ffd98a' },
  },
  {
    id: 'shankhupushpam',
    label: 'Shankhupushpam',
    gloss: 'blue pea',
    family: 'blue',
    kind: 'pea',
    c: { deep: '#1d2f7a', mid: '#3452ad', light: '#6d8ede', ctr: '#fdf6e0', accent: '#f2c53d' },
  },
  {
    id: 'jamanthi',
    label: 'Jamanthi',
    gloss: 'chrysanthemum',
    family: 'yellow',
    kind: 'pompon',
    narrow: true,
    c: { deep: '#c08606', mid: '#eeb81a', light: '#fbe270', ctr: '#a9720a', accent: '#fff6c2' },
  },
  {
    id: 'sunflower',
    label: 'Sunflower',
    gloss: 'sunflower',
    family: 'yellow',
    kind: 'ray',
    c: { deep: '#c98505', mid: '#f0b81c', light: '#fbdc55', ctr: '#4a2c10', accent: '#7a4c18' },
  },
  {
    id: 'tulsi',
    label: 'Tulsi Sprig',
    gloss: 'holy basil',
    family: 'green',
    kind: 'sprig',
    c: { deep: '#1f4a26', mid: '#37703a', light: '#6ea45a', ctr: '#284f2b', accent: '#b39ad6' },
  },
  {
    id: 'yellow-chethi',
    label: 'Yellow Chethi',
    gloss: 'ixora',
    family: 'yellow',
    kind: 'corymb',
    corymb: { lobe: 13, rings: [[0, 1], [15, 6], [31, 15]] },            // 22 florets
    c: { deep: '#b07a05', mid: '#e8b119', light: '#f8da5e', ctr: '#8d6a12', accent: '#fffbe0' },
  },
  {
    id: 'golden-chethi',
    label: 'Golden Chethi',
    gloss: 'ixora',
    family: 'yellow',
    kind: 'corymb',
    corymb: { lobe: 16.5, rings: [[0, 1], [16, 5], [30, 8]] },           // 14 florets
    c: { deep: '#8f5c04', mid: '#c98d0d', light: '#eeba3c', ctr: '#7a4f08', accent: '#fff2c4' },
  },
  {
    id: 'golden-hibiscus',
    label: 'Golden Hibiscus',
    gloss: 'hibiscus',
    family: 'yellow',
    kind: 'trumpet',
    cupped: true,
    c: { deep: '#a86a05', mid: '#dfa019', light: '#f4c556', ctr: '#8d2410', accent: '#f7e08a' },
  },
  {
    id: 'pansy',
    label: 'Pansy',
    gloss: 'pansy',
    family: 'purple',
    kind: 'face',
    c: { deep: '#452a70', mid: '#6f47a8', light: '#a884d6', ctr: '#2a1748', accent: '#f4d34a' },
  },
  {
    id: 'vadamalli',
    label: 'Vadamalli',
    gloss: 'globe amaranth',
    family: 'magenta',
    kind: 'globe',
    c: { deep: '#7d0f45', mid: '#b8236f', light: '#dd63a0', ctr: '#8e1552', accent: '#fdeaf3' },
  },
  {
    id: 'mulla',
    label: 'Mulla',
    gloss: 'jasmine',
    family: 'white',
    kind: 'salver',
    soft: true,
    c: { deep: '#e9e2cd', mid: '#faf7ec', light: '#ffffff', ctr: '#e7d98f', accent: '#a8a48d' },
  },
];

/* One typo guard: `light` above must be a colour. Fixing in place keeps the
   table readable rather than hiding a correction in a helper. */
FLOWERS.find((f) => f.id === 'marigold').c.light = '#fbd45a';

const BY_ID = new Map(FLOWERS.map((f) => [f.id, f]));

export function flowerById(id) {
  return BY_ID.get(id) || null;
}

/* ==========================================================================
 * Gradients
 *
 * Placed once in a <defs> by whoever is drawing — the board for the mat, the
 * <Bloom> component for a single card, the exporter for the PNG. Ids are
 * namespaced per flower, so a duplicate definition is always identical to the
 * one already in the document and the browser picking the first is harmless.
 * ======================================================================== */

const gid = (flower, part) => `pk-${flower.id}-${part}`;

function radial({ id, r, stops, cx = 0, cy = 0 }) {
  return {
    tag: 'radialGradient',
    id,
    gradientUnits: 'userSpaceOnUse',
    cx,
    cy,
    r,
    children: stops.map(([offset, color, opacity]) => ({
      tag: 'stop',
      offset,
      stopColor: color,
      ...(opacity == null ? {} : { stopOpacity: opacity }),
    })),
  };
}

/** The gradient set for one flower. */
export function flowerDefs(flower) {
  if (!flower) return [];
  const { c } = flower;
  const reach = flower.kind === 'sprig' || flower.kind === 'pea' ? 52 : 47;
  /* A near-white flower cannot take the same darkening as a red one — jasmine
     shaded like hibiscus comes out grey, and grey on cream paper reads as dirt
     rather than as a white petal. */
  const k = flower.soft ? 0.34 : 1;

  return [
    /* Front petals: shadowed where they leave the centre, sunlit at the tip. */
    radial({
      id: gid(flower, 'p'),
      r: reach,
      stops: [
        [0.06, shade(c.deep, -0.12 * k)],
        [0.3, c.deep],
        [0.62, c.mid],
        [0.9, c.light],
        [1, mix(c.light, '#ffffff', 0.22)],
      ],
    }),
    /* Back petals sit in the shade of the front ones. */
    radial({
      id: gid(flower, 'pb'),
      r: reach,
      stops: [
        [0.06, shade(c.deep, -0.34 * k)],
        [0.45, shade(c.deep, -0.14 * k)],
        [1, shade(c.mid, -0.06 * k)],
      ],
    }),
    /* The centre. */
    radial({
      id: gid(flower, 'c'),
      r: 18,
      stops: [
        [0, mix(c.ctr, '#ffffff', 0.24)],
        [0.5, c.ctr],
        [1, shade(c.ctr, -0.28)],
      ],
    }),
    /* A throat, for the species that have one. */
    radial({
      id: gid(flower, 't'),
      r: 26,
      stops: [
        [0, shade(c.ctr, -0.2)],
        [0.55, c.ctr, 0.85],
        [1, c.ctr, 0],
      ],
    }),
    /* A corymb's florets are lit the other way round from a single flower: it is
       a dome, so the top of it — the middle, from above — catches the light and
       the rim falls away. Using the petal gradient here made the head read as a
       dish rather than a mound. */
    radial({
      id: gid(flower, 'cor'),
      r: 46,
      stops: [
        [0, mix(c.light, '#ffffff', 0.16)],
        [0.4, c.mid],
        [0.78, c.deep],
        [1, shade(c.deep, -0.22)],
      ],
    }),
  ];
}

/* What shows between an ixora's florets is dark foliage and the peduncles, not
   a darker version of the flower. Shared by all three chethis. */
const CORYMB_SHADOW = '#2c3a22';

/** Every gradient in the set, for a board that may hold any flower. */
export function allFlowerDefs() {
  return FLOWERS.flatMap(flowerDefs);
}

/* ==========================================================================
 * The species
 * ======================================================================== */

/* A hairline in the petal's own darker tone. This is what gives petal-to-petal
   separation without the black keyline that made the old art look drawn. */
const seam = (c, w = 0.55, o = 0.34) => ({
  stroke: shade(c.deep, -0.3),
  strokeWidth: w,
  strokeOpacity: o,
});

/** Marigolds and chrysanthemums: whorls of short cupped ray florets, no disc. */
function pompon(f) {
  const { c } = f;
  const narrow = !!f.narrow;
  const rings = narrow
    ? [
        { count: 21, len: 46, wid: 4.6, belly: 0.6, seed: 3 },
        { count: 18, len: 38, wid: 4.4, belly: 0.62, seed: 5, phase: 9 },
        { count: 14, len: 30, wid: 4.2, belly: 0.64, seed: 7, phase: 4 },
        { count: 10, len: 21, wid: 4.0, belly: 0.66, seed: 11, phase: 12 },
      ]
    : [
        { count: 15, len: 47, wid: 7.4, belly: 0.62, seed: 3 },
        { count: 13, len: 38, wid: 7.0, belly: 0.64, seed: 5, phase: 12 },
        { count: 11, len: 29, wid: 6.6, belly: 0.66, seed: 7, phase: 6 },
        { count: 8, len: 20, wid: 6.0, belly: 0.68, seed: 11, phase: 14 },
      ];

  const out = [];
  rings.forEach((r, i) => {
    out.push({
      tag: 'path',
      d: whorl({ b: 3.5, waist: 0.42, scallops: f.crested ? 2 : 1, ...r }),
      fill: `url(#${gid(f, i === 0 ? 'pb' : 'p')})`,
      ...seam(c, 0.5, i === 0 ? 0.22 : 0.3),
    });
  });

  /* The still-furled florets at the very middle. One clean dome rather than the
     ring of outlined blobs the first version drew, which read as grey clumping
     at any size below about forty pixels. */
  out.push({ tag: 'circle', r: 7.5, fill: `url(#${gid(f, 'c')})` });
  out.push({
    tag: 'path',
    d: dots(
      Array.from({ length: 7 }, (_, i) => {
        const a = i * 137.508 * (Math.PI / 180);
        const rr = 5.4 * Math.sqrt(i / 6);
        return [Math.cos(a) * rr, Math.sin(a) * rr, 1.5];
      }),
      1.5
    ),
    fill: c.accent,
    fillOpacity: 0.8,
  });
  return out;
}

/** Sunflower: pointed ray florets round a real seed disc. */
function ray(f) {
  const { c } = f;
  const discR = 17.5;
  const out = [
    {
      tag: 'path',
      d: whorl({
        count: 19,
        len: 48,
        wid: 6.6,
        belly: 0.42,
        waist: 0.5,
        b: 13,
        pointed: true,
        seed: 4,
        phase: 9,
        jitAngle: 2.2,
      }),
      fill: `url(#${gid(f, 'pb')})`,
      ...seam(c, 0.5, 0.2),
    },
    {
      tag: 'path',
      d: whorl({
        count: 19,
        len: 45,
        wid: 6.2,
        belly: 0.44,
        waist: 0.5,
        b: 13,
        pointed: true,
        seed: 6,
        jitAngle: 2.4,
      }),
      fill: `url(#${gid(f, 'p')})`,
      ...seam(c, 0.5, 0.3),
    },
    /* Midribs, all in one path. */
    {
      tag: 'path',
      d: lines(
        Array.from({ length: 19 }, (_, i) => {
          const a = ((i * 360) / 19) * (Math.PI / 180) - Math.PI / 2;
          return [Math.cos(a) * 17, Math.sin(a) * 17, Math.cos(a) * 39, Math.sin(a) * 39];
        })
      ),
      stroke: shade(c.deep, -0.1),
      strokeWidth: 0.45,
      strokeOpacity: 0.3,
      fill: 'none',
    },
    { tag: 'circle', r: discR, fill: `url(#${gid(f, 'c')})` },
  ];

  /* Seeds on a golden-angle spiral, which is how they really pack. Fourteen is
     as many as read at the size a bloom is actually drawn. */
  const seeds = [];
  for (let i = 1; i <= 14; i++) {
    const a = i * 137.508 * (Math.PI / 180);
    const rr = discR * 0.78 * Math.sqrt(i / 14);
    seeds.push([Math.cos(a) * rr, Math.sin(a) * rr, 1.7]);
  }
  out.push({ tag: 'path', d: dots(seeds, 1.7), fill: shade(c.ctr, -0.3), fillOpacity: 0.8 });
  out.push({
    tag: 'circle',
    r: discR - 1.6,
    fill: 'none',
    stroke: c.accent,
    strokeWidth: 2.4,
    strokeOpacity: 0.55,
  });
  return out;
}

/** Hibiscus: five broad wavy petals, radiating veins, and the staminal column
 *  that is the whole reason a hibiscus is recognisable at a glance. */
function trumpet(f) {
  const { c } = f;
  const cupped = !!f.cupped;
  const out = [
    {
      tag: 'path',
      d: whorl({
        count: 5,
        len: 47,
        wid: cupped ? 24 : 22,
        belly: cupped ? 0.6 : 0.64,
        waist: 0.3,
        b: 3,
        scallops: cupped ? 2 : 3,
        curl: 0.16,
        seed: 8,
        phase: 36,
        jitAngle: 2,
        jitLen: 0.05,
      }),
      fill: `url(#${gid(f, 'pb')})`,
      ...seam(c, 0.5, 0.24),
    },
    {
      tag: 'path',
      d: whorl({
        count: 5,
        len: 45,
        wid: cupped ? 23 : 21,
        belly: cupped ? 0.6 : 0.64,
        waist: 0.3,
        b: 3,
        scallops: cupped ? 2 : 3,
        curl: 0.14,
        seed: 9,
        jitAngle: 2,
        jitLen: 0.05,
      }),
      fill: `url(#${gid(f, 'p')})`,
      ...seam(c, 0.6, 0.34),
    },
  ];

  /* Veins fanning from the throat — three per petal, one path. */
  const veins = [];
  for (let i = 0; i < 5; i++) {
    const base = (i * 360) / 5 - 90;
    for (const off of [-11, 0, 11]) {
      const a = (base + off) * (Math.PI / 180);
      veins.push([Math.cos(a) * 6, Math.sin(a) * 6, Math.cos(a) * 38, Math.sin(a) * 38]);
    }
  }
  out.push({
    tag: 'path',
    d: lines(veins),
    stroke: shade(c.deep, -0.32),
    strokeWidth: 0.5,
    strokeOpacity: 0.34,
    fill: 'none',
  });

  /* The dark throat, faded out so it sits under the petals. */
  out.push({ tag: 'circle', r: 24, fill: `url(#${gid(f, 't')})` });

  /* Staminal column: a pale style out to one side, five stigma knobs at its
     end, and anthers dusted along it. */
  const ang = 62 * (Math.PI / 180);
  const ex = Math.cos(ang) * 34;
  const ey = Math.sin(ang) * 34;
  out.push({
    tag: 'path',
    d: `M 0 0 L ${n(ex)} ${n(ey)}`,
    stroke: mix(c.accent, '#ffffff', 0.45),
    strokeWidth: 2.6,
    strokeLinecap: 'round',
    fill: 'none',
  });
  const knobs = [];
  for (let i = 0; i < 5; i++) {
    const a = ang + (i - 2) * 0.2;
    knobs.push([Math.cos(a) * 37.5, Math.sin(a) * 37.5, 2.5]);
  }
  out.push({
    tag: 'path',
    d: dots(knobs, 2.5),
    fill: shade(c.deep, -0.1),
    stroke: shade(c.deep, -0.4),
    strokeWidth: 0.4,
    strokeOpacity: 0.5,
  });
  const anthers = [];
  for (let i = 3; i <= 8; i++) {
    const t = i / 9;
    anthers.push([ex * t + wob(i) * 1.6, ey * t + wob(i + 40) * 1.6, 1.5]);
  }
  out.push({ tag: 'path', d: dots(anthers, 1.5), fill: c.accent });
  out.push({ tag: 'circle', r: 3, fill: shade(c.ctr, -0.3) });
  return out;
}

/** Ixora: a corymb — dozens of small four-lobed salverform florets packed into
 *  a dome. Three of these are in the set, so density and floret size are what
 *  tell them apart. */
function corymb(f) {
  const { c } = f;
  const { rings, lobe } = f.corymb;

  /* Sized to sit just inside the floret envelope. A golden-angle spiral was
     tried first and left a bare rim: it distributes area evenly but leaves the
     outermost circle sparse, so the shadow disc showed through as a dark
     annulus. Explicit rings guarantee the edge closes — which is also how a
     corymb is actually built. */
  const outer = rings[rings.length - 1][0];
  const out = [
    /* Only the gaps between florets show of this, so it is foliage shadow. */
    { tag: 'circle', r: outer + lobe * 0.5, fill: CORYMB_SHADOW },
  ];

  const spots = [];
  rings.forEach(([rr, count], ri) => {
    /* Florets shrink towards the rim, which is what makes a flat arrangement
       read as a mound. */
    const k = 1 - 0.2 * (rr / outer);
    if (rr === 0) {
      spots.push([0, 0, k]);
      return;
    }
    for (let i = 0; i < count; i++) {
      const a =
        ((i * 360) / count + ri * 13 + wob(ri * 31 + i) * 5) * (Math.PI / 180) - Math.PI / 2;
      const jr = rr * (1 + wob(ri * 17 + i) * 0.05);
      spots.push([Math.cos(a) * jr, Math.sin(a) * jr, k * (1 + wob(ri * 47 + i) * 0.07)]);
    }
  });

  /* Every floret's four lobes in one path — a whole corymb for one node. */
  let petals = '';
  const throats = [];
  spots.forEach(([x, y, k], i) => {
    const L = lobe * k;
    for (let q = 0; q < 4; q++) {
      petals += emit(
        petalCmds({
          b: L * 0.16,
          len: L,
          wid: L * 0.4,
          belly: 0.56,
          waist: 0.34,
          pointed: true,
        }),
        q * 90 + i * 23,
        x,
        y
      );
    }
    throats.push([x, y, Math.max(1, L * 0.2)]);
  });

  out.push({
    tag: 'path',
    d: petals.trim(),
    fill: `url(#${gid(f, 'cor')})`,
    stroke: CORYMB_SHADOW,
    strokeWidth: 0.5,
    strokeOpacity: 0.5,
  });
  out.push({ tag: 'path', d: dots(throats, 1.2), fill: c.accent, fillOpacity: 0.92 });
  return out;
}

/** Clitoria ternatea. A pea flower, not a rosette: one big standard petal with
 *  a cream throat and a yellow blotch, two small wings, a keel, a green calyx. */
function pea(f) {
  const { c } = f;
  return [
    /* A slim calyx and stalk, tucked under. Drawn narrow on purpose: fattened up
       it stops reading as a sepal and starts reading as a green thumb. */
    {
      tag: 'path',
      d: 'M -4.5 28 C -6 38 -2.5 46 0 46 C 2.5 46 6 38 4.5 28 Z',
      fill: '#3d6b34',
      stroke: '#2a4d24',
      strokeWidth: 0.55,
      strokeOpacity: 0.55,
    },
    /* Wings, tucked behind and to the sides. */
    {
      tag: 'path',
      d:
        emit(petalCmds({ b: 6, len: 34, wid: 13, belly: 0.6, waist: 0.4, curl: 0.3 }), 128) +
        emit(petalCmds({ b: 6, len: 34, wid: 13, belly: 0.6, waist: 0.4, curl: -0.3 }), -128),
      fill: `url(#${gid(f, 'pb')})`,
      ...seam(c, 0.5, 0.3),
    },
    /* The standard: the broad rounded fan that is most of a blue pea, notched at
       the top where the two halves of the petal meet. */
    {
      tag: 'path',
      d:
        'M 0 27 C -24 24 -42 8 -43 -14 C -44 -33 -26 -45 -11 -44 ' +
        'C -4 -43.4 -1.5 -40 0 -36 C 1.5 -40 4 -43.4 11 -44 ' +
        'C 26 -45 44 -33 43 -14 C 42 8 24 24 0 27 Z',
      fill: `url(#${gid(f, 'p')})`,
      ...seam(c, 0.7, 0.4),
    },
    /* Veins fanning up the standard. */
    {
      tag: 'path',
      d: lines([
        [0, 22, -26, -30],
        [0, 22, -13, -38],
        [0, 22, 0, -42],
        [0, 22, 13, -38],
        [0, 22, 26, -30],
      ]),
      stroke: shade(c.deep, -0.25),
      strokeWidth: 0.5,
      strokeOpacity: 0.3,
      fill: 'none',
    },
    /* The pale throat and its yellow eye — the giveaway of the species. */
    {
      tag: 'path',
      d: 'M 0 22 C -13 16 -18 0 -14 -12 C -10 -22 -5 -26 0 -26 C 5 -26 10 -22 14 -12 C 18 0 13 16 0 22 Z',
      fill: c.ctr,
      fillOpacity: 0.94,
      stroke: shade(c.ctr, -0.2),
      strokeWidth: 0.5,
      strokeOpacity: 0.5,
    },
    {
      tag: 'path',
      d: 'M 0 14 C -7 10 -9 -2 -7 -9 C -4 -15 -2 -17 0 -17 C 2 -17 4 -15 7 -9 C 9 -2 7 10 0 14 Z',
      fill: c.accent,
      fillOpacity: 0.9,
    },
    /* The keel poking out at the base. */
    {
      tag: 'path',
      d: 'M -5 24 C -3 33 3 33 5 24 C 3 28 -3 28 -5 24 Z',
      fill: mix(c.ctr, c.mid, 0.35),
    },
  ];
}

/** Holy basil. A sprig, because that is what gets laid — paired leaves up a
 *  stem with a spike of tiny mauve whorls at the top. */
function sprig(f) {
  const { c } = f;
  const leaf = (len, wid) =>
    petalCmds({ b: 1, len, wid, belly: 0.46, waist: 0.16, pointed: true, scallops: 1 });

  /* Opposite pairs up the stem, angled out and slightly up. `turn` is the
     rotation applied to a leaf that points up by default: +90 is due right, so
     anything under 90 leans upward. */
  const pairs = [
    { y: 27, len: 25, wid: 10, turn: 74 },
    { y: 7, len: 30, wid: 12, turn: 66 },
    { y: -12, len: 25, wid: 10, turn: 58 },
  ];

  let blades = '';
  const ribs = [];
  pairs.forEach((p, i) => {
    for (const turn of [p.turn, -p.turn]) {
      const len = p.len * (1 + wob(i * 7 + (turn > 0 ? 1 : 2)) * 0.06);
      blades += emit(leaf(len, p.wid), turn, 0, p.y);
      /* The midrib runs along the leaf's own axis. Deriving the tip with the
         same rotate() the blade used is what stops it drifting off the leaf —
         the first version hand-rolled the trigonometry and drew two hairlines
         out into empty space. */
      const [tx, ty] = rotate([0, -len * 0.8], turn);
      ribs.push([0, p.y, tx, p.y + ty]);
    }
  });

  return [
    {
      tag: 'path',
      d: 'M 0 46 L 0 -28',
      stroke: shade(c.deep, -0.1),
      strokeWidth: 2.4,
      strokeLinecap: 'round',
      fill: 'none',
    },
    {
      tag: 'path',
      d: blades.trim(),
      fill: `url(#${gid(f, 'p')})`,
      ...seam(c, 0.55, 0.42),
    },
    {
      tag: 'path',
      d: lines(ribs),
      stroke: shade(c.deep, -0.25),
      strokeWidth: 0.5,
      strokeOpacity: 0.4,
      fill: 'none',
    },
    /* The inflorescence: four whorls of tiny florets up the tip. */
    {
      tag: 'path',
      d: dots(
        [
          [0, -30, 2.3],
          [-4.2, -33, 1.9],
          [4.2, -33, 1.9],
          [0, -37, 2.1],
          [-3.6, -40, 1.7],
          [3.6, -40, 1.7],
          [0, -44, 1.8],
        ],
        2
      ),
      fill: c.accent,
      stroke: shade(c.accent, -0.3),
      strokeWidth: 0.4,
      strokeOpacity: 0.55,
    },
  ];
}

/** Gomphrena globosa. A papery globe of overlapping bracts, so it is built from
 *  rings of small pointed scales rather than petals. */
function globe(f) {
  const { c } = f;
  const out = [{ tag: 'circle', r: 44, fill: `url(#${gid(f, 'pb')})` }];

  const rings = [
    { count: 13, r: 35, len: 15, wid: 7.2, seed: 2 },
    { count: 11, r: 25, len: 14, wid: 7.0, seed: 4, phase: 15 },
    { count: 9, r: 15, len: 13, wid: 6.6, seed: 6, phase: 8 },
    { count: 6, r: 6, len: 12, wid: 6.2, seed: 8, phase: 22 },
  ];

  let scales = '';
  rings.forEach((rg) => {
    const step = 360 / rg.count;
    for (let i = 0; i < rg.count; i++) {
      const a = ((rg.phase ?? 0) + i * step + wob(rg.seed * 31 + i) * 3) * (Math.PI / 180) - Math.PI / 2;
      scales += emit(
        petalCmds({
          b: 0.5,
          len: rg.len * (1 + wob(rg.seed * 17 + i) * 0.08),
          wid: rg.wid,
          belly: 0.52,
          waist: 0.34,
          pointed: true,
        }),
        (Math.atan2(Math.sin(a), Math.cos(a)) * 180) / Math.PI + 90,
        Math.cos(a) * rg.r,
        Math.sin(a) * rg.r
      );
    }
  });

  out.push({
    tag: 'path',
    d: scales.trim(),
    fill: `url(#${gid(f, 'p')})`,
    ...seam(c, 0.45, 0.4),
  });
  /* The tiny white florets that show between the bracts. */
  out.push({
    tag: 'path',
    d: dots([[-9, -14, 1.5], [11, -9, 1.4], [-3, 13, 1.5], [15, 12, 1.3], [-16, 5, 1.3]], 1.4),
    fill: c.accent,
    fillOpacity: 0.85,
  });
  return out;
}

/** Ixora javanica: a six-pointed star with recurved tips. */
function star(f) {
  const { c } = f;
  return [
    {
      tag: 'path',
      d: whorl({ count: 6, len: 47, wid: 11, belly: 0.34, waist: 0.34, b: 4, pointed: true, seed: 5, phase: 30 }),
      fill: `url(#${gid(f, 'pb')})`,
      ...seam(c, 0.5, 0.24),
    },
    {
      tag: 'path',
      d: whorl({ count: 6, len: 44, wid: 10, belly: 0.36, waist: 0.34, b: 4, pointed: true, seed: 7, curl: 0.12 }),
      fill: `url(#${gid(f, 'p')})`,
      ...seam(c, 0.55, 0.34),
    },
    {
      tag: 'path',
      d: lines(
        Array.from({ length: 6 }, (_, i) => {
          const a = (i * 60 - 90) * (Math.PI / 180);
          return [Math.cos(a) * 6, Math.sin(a) * 6, Math.cos(a) * 36, Math.sin(a) * 36];
        })
      ),
      stroke: shade(c.deep, -0.25),
      strokeWidth: 0.55,
      strokeOpacity: 0.36,
      fill: 'none',
    },
    { tag: 'circle', r: 8.5, fill: `url(#${gid(f, 'c')})` },
    { tag: 'circle', r: 3.4, fill: c.accent, fillOpacity: 0.9 },
  ];
}

/** Pansy: five unequal petals, a dark face blotch, radiating whiskers, a small
 *  yellow eye. The unequal petals are the point — five equal ones would be a
 *  buttercup. */
function face(f) {
  const { c } = f;
  /* Two upper petals, two laterals, one broad lower. */
  const plan = [
    { rot: -32, len: 44, wid: 21, back: true },
    { rot: 32, len: 44, wid: 21, back: true },
    { rot: -104, len: 42, wid: 20 },
    { rot: 104, len: 42, wid: 20 },
    { rot: 180, len: 46, wid: 26 },
  ];

  let back = '';
  let front = '';
  plan.forEach((p, i) => {
    const d = emit(
      petalCmds({
        b: 3,
        len: p.len * (1 + wob(i * 5) * 0.04),
        wid: p.wid,
        belly: 0.66,
        waist: 0.26,
        scallops: 2,
        curl: wob(i * 5 + 1) * 0.08,
      }),
      p.rot
    );
    if (p.back) back += d;
    else front += d;
  });

  return [
    { tag: 'path', d: back.trim(), fill: `url(#${gid(f, 'pb')})`, ...seam(c, 0.55, 0.28) },
    { tag: 'path', d: front.trim(), fill: `url(#${gid(f, 'p')})`, ...seam(c, 0.6, 0.36) },
    /* The dark face. Kept to the middle third — blown up to the full width it
       swallows the petals and the flower stops reading as a pansy at all. */
    {
      tag: 'path',
      d: 'M 0 -3 C -9 -3 -15 5 -14 12 C -13 19 -6 22 0 22 C 6 22 13 19 14 12 C 15 5 9 -3 0 -3 Z',
      fill: shade(c.ctr, -0.12),
      fillOpacity: 0.92,
    },
    { tag: 'circle', r: 13, fill: `url(#${gid(f, 't')})` },
    /* Whiskers, radiating well past the face onto the petals — that is where
       they are actually visible, and where a real pansy carries them. */
    {
      tag: 'path',
      d: lines(
        [-64, -38, -14, 10, 34, 58, 90, 122, 152, 208, 244].map((deg) => {
          const a = (deg + 90) * (Math.PI / 180);
          return [Math.cos(a) * 4, Math.sin(a) * 4, Math.cos(a) * 34, Math.sin(a) * 34];
        })
      ),
      stroke: shade(c.deep, -0.42),
      strokeWidth: 1.15,
      strokeOpacity: 0.82,
      strokeLinecap: 'round',
      fill: 'none',
    },
    { tag: 'circle', r: 5, fill: c.accent },
    { tag: 'circle', cy: -0.8, r: 2.2, fill: shade(c.accent, -0.4), fillOpacity: 0.85 },
  ];
}

/** Jasmine: narrow, well-separated spatulate petals and a green-gold throat.
 *  Nearly the colour of the paper it lies on, so it needs a cool edge. */
function salver(f) {
  const { c } = f;
  return [
    {
      tag: 'path',
      d: whorl({
        count: 8,
        len: 47,
        wid: 9.5,
        belly: 0.72,
        waist: 0.2,
        b: 5,
        seed: 3,
        phase: 22,
        jitAngle: 3.2,
        jitLen: 0.08,
      }),
      fill: `url(#${gid(f, 'pb')})`,
      stroke: c.accent,
      strokeWidth: 0.6,
      strokeOpacity: 0.5,
    },
    {
      tag: 'path',
      d: whorl({
        count: 8,
        len: 44,
        wid: 9,
        belly: 0.72,
        waist: 0.2,
        b: 5,
        seed: 6,
        jitAngle: 3.2,
        jitLen: 0.08,
      }),
      fill: `url(#${gid(f, 'p')})`,
      stroke: c.accent,
      strokeWidth: 0.65,
      strokeOpacity: 0.62,
    },
    {
      tag: 'path',
      d: lines(
        Array.from({ length: 8 }, (_, i) => {
          const a = (i * 45 - 90) * (Math.PI / 180);
          return [Math.cos(a) * 7, Math.sin(a) * 7, Math.cos(a) * 34, Math.sin(a) * 34];
        })
      ),
      stroke: c.accent,
      strokeWidth: 0.45,
      strokeOpacity: 0.4,
      fill: 'none',
    },
    { tag: 'circle', r: 8, fill: `url(#${gid(f, 'c')})` },
    { tag: 'circle', r: 3.2, fill: shade(c.ctr, -0.25), fillOpacity: 0.85 },
  ];
}

const BUILDERS = { pompon, ray, trumpet, corymb, pea, sprig, globe, star, face, salver };

/**
 * The shapes for one flower, as plain descriptors.
 *
 * Never React elements: `exporter.js` serialises this exact array into the
 * standalone SVG it rasterises for the PNG, so the picture you download is
 * drawn from the same call as the one on screen.
 */
export function bloomChildren(flower) {
  const f = typeof flower === 'string' ? flowerById(flower) : flower;
  if (!f) return [];
  const build = BUILDERS[f.kind];
  return build ? build(f) : [];
}

/* ==========================================================================
 * React
 * ======================================================================== */

/** Descriptors to elements, handling the nested children a <defs> needs. */
export function shapesToElements(shapes, keyPrefix = 's') {
  if (!Array.isArray(shapes)) return null;
  return shapes.map((s, i) => {
    if (!s || typeof s !== 'object') return null;
    const { tag: Tag, children, ...attrs } = s;
    if (!Tag) return null;
    return (
      <Tag key={`${keyPrefix}${i}`} {...attrs}>
        {children ? shapesToElements(children, `${keyPrefix}${i}-`) : undefined}
      </Tag>
    );
  });
}

/** One flower on its own, for the picker and the brand mark. */
export function Bloom({ flowerId, size = 40, className, title }) {
  const flower = flowerById(flowerId);
  if (!flower) return null;
  return (
    <svg
      viewBox="-50 -50 100 100"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label={title || `${flower.label} (${flower.gloss})`}
    >
      <defs>{shapesToElements(flowerDefs(flower), 'd')}</defs>
      {shapesToElements(bloomChildren(flower), 'b')}
    </svg>
  );
}
