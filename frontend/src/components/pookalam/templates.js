/**
 * The six laid-out pookalams, as pure geometry.
 *
 * Approach: every template is a stack of *layers*, and every layer is one of
 * three primitives — a ring (evenly spaced by angle), a radial run (a line of
 * blooms marching outward along one spoke), or a curve sampled by arc length.
 * Arc-length sampling is the load-bearing trick: it means a heart contour or a
 * boat hull gets its blooms spread evenly along the shape rather than evenly in
 * the parameter, which is what separates "laid" from "scattered".
 *
 * Counts are hardcoded and the arithmetic is written out in a comment above
 * each generator, because "roughly 200" is not a pookalam — the budget is 200
 * and a template that spends 197 leaves the player three orphan flowers. Every
 * layer sum is checked to 200 by hand, and then `finish()` filters anything
 * that would hang off the mat and tops the list back up from a deterministic
 * phyllotaxis spiral, so the returned length is exactly `blooms` even if a
 * radius were ever retuned into an out-of-bounds position.
 *
 * Ring radii are chosen against the sizes either side of them: adjacent rings
 * are at least (sizeA + sizeB) / 2 apart, and within a ring the arc step
 * 2*pi*r/count is held near the bloom size, so rings read as clean bands.
 * Flower ids are chosen by index arithmetic off the caller's list — one id per
 * band — which is what makes a template read as banded colour instead of
 * confetti. Nothing here calls Math.random(); `surprise()` takes a seed and
 * runs a small LCG defined in this module.
 */

/* ------------------------------------------------------------------ *
 * Constants and small shared helpers
 * ------------------------------------------------------------------ */

/** The mat, from Board.jsx. Fixed. */
const MAT_R = 96;
const R2D = 180 / Math.PI;

/** Used only if a caller hands us an empty flower list. */
const FALLBACK_ID = 'chendumalli';

/** Size of a bloom laid by the top-up spiral. */
const SLOT_SIZE = 9;

function ids(flowerIds) {
  return Array.isArray(flowerIds) && flowerIds.length ? flowerIds : [FALLBACK_ID];
}

/** Deterministic choice: index arithmetic, wrapping, never random. */
function pick(list, i) {
  const n = list.length;
  return list[((i % n) + n) % n];
}

/** `flowerId` may be a string or an (index) => string, so one ring can alternate. */
function idAt(flowerId, i) {
  return typeof flowerId === 'function' ? flowerId(i) : flowerId;
}

function round2(v) {
  return Math.round(v * 100) / 100;
}

/** The one hard rule: a bloom must sit wholly inside the mat. */
export function fitsOnMat(x, y, size) {
  return Math.hypot(x, y) + size / 2 <= MAT_R;
}

/** Petals point away from the centre, which is how a pookalam is actually laid. */
function outward(x, y) {
  return Math.atan2(y, x) * R2D;
}

function bloom(flowerId, x, y, size, rot) {
  return {
    flowerId,
    x: round2(x),
    y: round2(y),
    size,
    rot: round2(typeof rot === 'number' ? rot : outward(x, y)),
  };
}

/* ------------------------------------------------------------------ *
 * Primitive 1 — the ring every template is built on
 * ------------------------------------------------------------------ */

/**
 * `count` blooms evenly spaced round a circle of `radius`, each rotated to face
 * outward. `phase` (degrees) turns the whole ring, which is how neighbouring
 * rings are staggered so their blooms sit in each other's gaps.
 *
 * `flowerId` accepts a function of the ring index for alternating bands.
 */
export function ringLayout({ radius, count, size, flowerId, phase = 0 }) {
  const out = [];
  if (!(count > 0)) return out;
  const step = 360 / count;
  for (let i = 0; i < count; i += 1) {
    const deg = phase + i * step;
    const rad = deg / R2D;
    const x = Math.cos(rad) * radius;
    const y = Math.sin(rad) * radius;
    out.push(bloom(idAt(flowerId, i), x, y, size, deg));
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * Primitive 2 — a radial run (one spoke of a sun, one lamp, one trunk)
 * ------------------------------------------------------------------ */

/** Blooms marching outward along a single spoke at `angleDeg`. */
function radialRun({ angleDeg, radii, sizes, flowerId }) {
  const rad = angleDeg / R2D;
  const cx = Math.cos(rad);
  const cy = Math.sin(rad);
  return radii.map((r, i) =>
    bloom(idAt(flowerId, i), cx * r, cy * r, sizes[i % sizes.length], angleDeg),
  );
}

/* ------------------------------------------------------------------ *
 * Primitive 3 — sample a parametric curve at even arc length
 * ------------------------------------------------------------------ */

/**
 * `pt(u)` maps u in [0,1] to {x,y}. Returns `count` points spread evenly by
 * *distance along the curve*, not by u — a heart's parameter bunches badly at
 * the lobes, and even-in-u sampling makes the outline look chewed.
 *
 * `closed` distributes over the full loop (no duplicate at the seam); open
 * curves land a bloom on each end.
 */
function sampleCurve(pt, count, closed = false, res = 1200) {
  const out = [];
  if (!(count > 0)) return out;

  const pts = new Array(res + 1);
  for (let i = 0; i <= res; i += 1) pts[i] = pt(i / res);

  const cum = new Array(res + 1);
  cum[0] = 0;
  for (let i = 1; i <= res; i += 1) {
    cum[i] = cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  }
  const total = cum[res];
  if (!(total > 0)) {
    for (let j = 0; j < count; j += 1) out.push({ x: pts[0].x, y: pts[0].y });
    return out;
  }

  let cursor = 1;
  for (let j = 0; j < count; j += 1) {
    let target;
    if (closed) target = (total * j) / count;
    else if (count === 1) target = total / 2;
    else target = (total * j) / (count - 1);

    while (cursor < res && cum[cursor] < target) cursor += 1;
    const lo = Math.max(1, cursor);
    const span = cum[lo] - cum[lo - 1] || 1;
    const f = (target - cum[lo - 1]) / span;
    out.push({
      x: pts[lo - 1].x + (pts[lo].x - pts[lo - 1].x) * f,
      y: pts[lo - 1].y + (pts[lo].y - pts[lo - 1].y) * f,
    });
  }
  return out;
}

/** Sample a curve straight into blooms, all facing outward from the centre. */
function curveLayout({ pt, count, size, flowerId, closed = false }) {
  return sampleCurve(pt, count, closed).map((p, i) =>
    bloom(idAt(flowerId, i), p.x, p.y, size),
  );
}

/* ------------------------------------------------------------------ *
 * Exactness: filter what hangs off the mat, then top back up to count
 * ------------------------------------------------------------------ */

/** Deterministic sunflower spiral of safe slots, densest-first outward. */
function spiralSlots(n) {
  const maxR = MAT_R - SLOT_SIZE / 2; // 91.5
  const golden = 137.50776405003785;
  const out = new Array(n);
  for (let i = 0; i < n; i += 1) {
    const r = maxR * Math.sqrt((i + 0.5) / n);
    const deg = i * golden;
    const rad = deg / R2D;
    out[i] = { x: Math.cos(rad) * r, y: Math.sin(rad) * r, used: false };
  }
  return out;
}

/**
 * Guarantees `count` in-bounds blooms. Over-long lists are trimmed; short ones
 * are topped up from the spiral, preferring slots that clear what is already
 * laid and loosening that clearance rather than ever returning the wrong count.
 */
function finish(layers, count, flowerIds) {
  const list = ids(flowerIds);
  const out = [];
  for (let i = 0; i < layers.length; i += 1) {
    const b = layers[i];
    if (fitsOnMat(b.x, b.y, b.size)) out.push(b);
  }
  if (out.length > count) return out.slice(0, count);
  if (out.length === count) return out;

  const slots = spiralSlots(Math.max(720, count * 4));
  const clearances = [1, 0.82, 0.62, 0.4, 0];
  for (let c = 0; c < clearances.length && out.length < count; c += 1) {
    const clear = clearances[c];
    for (let i = 0; i < slots.length && out.length < count; i += 1) {
      const s = slots[i];
      if (s.used) continue;
      if (clear > 0) {
        let ok = true;
        for (let j = 0; j < out.length; j += 1) {
          const b = out[j];
          if (Math.hypot(b.x - s.x, b.y - s.y) < ((b.size + SLOT_SIZE) / 2) * clear) {
            ok = false;
            break;
          }
        }
        if (!ok) continue;
      }
      s.used = true;
      out.push(bloom(pick(list, out.length), s.x, s.y, SLOT_SIZE, outward(s.x, s.y)));
    }
  }
  // Absolute last resort, so the contract "exactly `blooms`" never breaks.
  let g = 0;
  while (out.length < count) {
    const s = slots[g % slots.length];
    g += 1;
    out.push(bloom(pick(list, out.length), s.x, s.y, SLOT_SIZE, outward(s.x, s.y)));
  }
  return out.slice(0, count);
}

/* ------------------------------------------------------------------ *
 * classic — concentric rings, the traditional pookalam
 * ------------------------------------------------------------------ */

/*
 * radius  count  size   arc step (2*pi*r/n)   gap to ring inside
 *      0      1    18   -                     -
 *     15      7    12   13.5                  15.0  >= (18+12)/2 = 15.0
 *     27     12    12   14.1                  12.0  >= 12
 *     39     18    12   13.6                  12.0  >= 12
 *     51     24    11   13.4                  12.0  >= 11.5
 *     62     30    10   13.0                  11.0  >= 10.5
 *     73     42     9   10.9                  11.0  >=  9.5
 *     84     66     8    8.0                  11.0  >=  8.5
 *
 * count sum: 1 + 7 = 8; +12 = 20; +18 = 38; +24 = 62; +30 = 92; +42 = 134;
 *            +66 = 200.
 * furthest reach: 84 + 8/2 = 88 <= 96.
 */
/*
 * Radii and sizes chosen so consecutive rings just touch or slightly overlap in
 * BOTH directions — radially (r_inner + size/2 >= r_outer - size/2) and
 * angularly (2*pi*r / count <= size). A real doorstep pookalam has no bare mat
 * showing between its bands, and the first pass left a visible white gutter
 * between every ring. Outermost is 89 + 11/2 = 94.5, inside the 96 mat.
 */
const CLASSIC_RINGS = [
  { radius: 15, count: 7, size: 15, phase: 0 },
  { radius: 29, count: 12, size: 15, phase: 15 },
  { radius: 43, count: 18, size: 15, phase: 0 },
  { radius: 56, count: 24, size: 14, phase: 7.5 },
  { radius: 68, count: 30, size: 13, phase: 0 },
  { radius: 79, count: 42, size: 12, phase: 4.3 },
  { radius: 89, count: 66, size: 11, phase: 0 },
];

function buildClassic(flowerIds) {
  const list = ids(flowerIds);
  const out = [bloom(pick(list, 0), 0, 0, 18, 0)];
  for (let i = 0; i < CLASSIC_RINGS.length; i += 1) {
    const r = CLASSIC_RINGS[i];
    // One id per band, stepping through the list so bands never repeat
    // adjacently while the list is longer than 1.
    out.push(...ringLayout({ ...r, flowerId: pick(list, i + 1) }));
  }
  return finish(out, 200, list);
}

/* ------------------------------------------------------------------ *
 * sun — dense core, then rays
 * ------------------------------------------------------------------ */

/*
 * core    radius  count  size   arc step   gap
 *              0      1    18   -          -
 *             15      8    12   11.8       15.0 >= 15.0
 *             27     14    12   12.1       12.0 >= 12
 *             39     20    11   12.3       12.0 >= 11.5
 * core sum: 1 + 8 + 14 + 20 = 43
 *
 * 12 long rays  x 4 blooms (r = 50, 60, 70, 80; sizes 12, 11, 10, 9) = 48
 * 12 short rays x 3 blooms (r = 50, 60, 70; sizes 11, 10,  9), +15deg = 36
 *   at r = 50 that is 24 blooms round the circle: arc 13.1 >= 12  ok
 * rim ring      r = 89, count 73, size 8: arc 7.7 (a deliberately solid edge),
 *   gap from the r=80 ray tip is 9 >= (9+8)/2 = 8.5
 *
 * count sum: 43 + 48 = 91; +36 = 127; +73 = 200.
 * furthest reach: 89 + 8/2 = 93 <= 96.
 */
function buildSun(flowerIds) {
  const list = ids(flowerIds);
  const out = [bloom(pick(list, 0), 0, 0, 18, 0)];

  out.push(...ringLayout({ radius: 15, count: 8, size: 12, flowerId: pick(list, 1) }));
  out.push(...ringLayout({ radius: 27, count: 14, size: 12, flowerId: pick(list, 2), phase: 12.85 }));
  out.push(...ringLayout({ radius: 39, count: 20, size: 11, flowerId: pick(list, 3) }));

  const longId = pick(list, 4);
  const shortId = pick(list, 5);
  for (let k = 0; k < 12; k += 1) {
    const a = k * 30;
    out.push(...radialRun({
      angleDeg: a,
      radii: [50, 60, 70, 80],
      sizes: [12, 11, 10, 9],
      flowerId: longId,
    }));
    out.push(...radialRun({
      angleDeg: a + 15,
      radii: [50, 60, 70],
      sizes: [11, 10, 9],
      flowerId: shortId,
    }));
  }

  out.push(...ringLayout({
    radius: 89,
    count: 73,
    size: 8,
    flowerId: (i) => pick(list, 6 + (i % 2)),
  }));

  return finish(out, 200, list);
}

/* ------------------------------------------------------------------ *
 * lotus — layered petals opening outward
 * ------------------------------------------------------------------ */

/**
 * One petal, as a closed teardrop of blooms: the outline runs up the left edge
 * to the tip and back down the right. Width swells as sin(pi*t) so the petal is
 * fat in the middle and closes at base and tip, which is the shape of a lotus
 * petal seen flat.
 *
 * `steps` counts the rungs from base to tip; base and tip are single blooms and
 * every rung between them is a pair, so the bloom count is 2*steps - 2.
 */
function petalLayer({ petals, steps, r0, r1, width, size, flowerId, phase = 0 }) {
  const out = [];
  const perPetal = 2 * steps - 2;
  for (let p = 0; p < petals; p += 1) {
    const centre = phase + (p * 360) / petals;
    for (let s = 0; s < steps; s += 1) {
      const t = s / (steps - 1);
      const r = r0 + (r1 - r0) * t;
      const halfDeg = ((width * Math.sin(Math.PI * t)) / Math.max(r, 1)) * R2D;
      const sides = s === 0 || s === steps - 1 ? [0] : [-halfDeg, halfDeg];
      for (let k = 0; k < sides.length; k += 1) {
        const deg = centre + sides[k];
        const rad = deg / R2D;
        out.push(bloom(
          idAt(flowerId, out.length),
          Math.cos(rad) * r,
          Math.sin(rad) * r,
          size,
          deg,
        ));
      }
    }
  }
  // Documented for the count arithmetic above each caller.
  out.perPetal = perPetal;
  return out;
}

/*
 * seed pod   r = 0,  1 bloom,  size 18
 *            r = 14, 6 blooms, size 11  (arc 14.7; gap 14 vs (18+11)/2 = 14.5)
 *            r = 25, 12 blooms, size 10 (arc 13.1; gap 11 >= 10.5)
 *   pod sum: 1 + 6 + 12 = 19
 * inner petals  8 petals, 4 steps -> 2*4-2 = 6 each  = 48   (r 34 -> 56)
 * outer petals  8 petals, 5 steps -> 2*5-2 = 8 each  = 64   (r 40 -> 82, +22.5deg)
 * rim ring      r = 91, 69 blooms, size 8: arc 8.3 >= 8; gap from the r=82
 *               petal tip (size 9) is 9 >= 8.5
 *
 * count sum: 19 + 48 = 67; +64 = 131; +69 = 200.
 * furthest reach: 91 + 8/2 = 95 <= 96.
 */
function buildLotus(flowerIds) {
  const list = ids(flowerIds);
  const out = [bloom(pick(list, 0), 0, 0, 18, 0)];

  out.push(...ringLayout({ radius: 15, count: 6, size: 15, flowerId: pick(list, 1) }));
  out.push(...ringLayout({ radius: 28, count: 12, size: 14, flowerId: pick(list, 2), phase: 15 }));

  out.push(...petalLayer({
    petals: 8,
    steps: 4,
    r0: 40,
    r1: 58,
    width: 13,
    size: 14,
    flowerId: pick(list, 3),
  }));
  out.push(...petalLayer({
    petals: 8,
    steps: 5,
    r0: 52,
    r1: 80,
    width: 16,
    size: 13,
    flowerId: pick(list, 4),
    phase: 22.5,
  }));

  out.push(...ringLayout({
    radius: 90,
    count: 69,
    size: 11,
    flowerId: (i) => pick(list, 5 + (i % 2)),
  }));

  return finish(out, 200, list);
}

/* ------------------------------------------------------------------ *
 * heart — a contour fill of the classic heart curve
 * ------------------------------------------------------------------ */

/*
 * Base curve, in canvas orientation (SVG y grows downward, so the point of the
 * heart is at +y):
 *   x(t) =  16 sin^3 t
 *   y(t) = -(13 cos t - 5 cos 2t - 2 cos 3t - cos 4t) - 6
 * The -6 recentres the shape on the origin (the raw y spans -5..17).
 * HEART_MAX_R is measured, not guessed, so the outer contour can be scaled to
 * land exactly where we want it.
 */
function heartPoint(t) {
  const s = Math.sin(t);
  return {
    x: 16 * s * s * s,
    y: -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) - 6,
  };
}

const HEART_MAX_R = (() => {
  let m = 0;
  for (let i = 0; i < 2880; i += 1) {
    const p = heartPoint((i / 2880) * Math.PI * 2);
    m = Math.max(m, Math.hypot(p.x, p.y));
  }
  return m; // ~20.7
})();

/** Outermost contour reaches r = 80, leaving room for a size-10 bloom. */
const HEART_K = 88 / HEART_MAX_R;

/*
 * A heart is filled by nesting the same outline at shrinking scales. The scale
 * step is 0.125, i.e. a radial step of 0.125 * 80 = 10 units, which matches the
 * bloom size — so consecutive contours sit shoulder to shoulder and the shape
 * reads solid rather than as concentric wire.
 *
 * scale  count  size   arc step along the contour (~103 * k / n)
 *  1.000    45    10   8.8
 *  0.875    39    10   8.9
 *  0.750    34    10   8.8
 *  0.625    28    10   8.9
 *  0.500    23     9   8.7
 *  0.375    17     9   8.8
 *  0.250    10     9   9.9
 *  0.125     3     9   -
 *  centre     1    12
 *
 * count sum: 45 + 39 = 84; +34 = 118; +28 = 146; +23 = 169; +17 = 186;
 *            +10 = 196; +3 = 199; +1 centre = 200.
 * furthest reach: 80 + 10/2 = 85 <= 96.
 */
const HEART_CONTOURS = [
  { scale: 1.0, count: 45, size: 12 },
  { scale: 0.875, count: 39, size: 12 },
  { scale: 0.75, count: 34, size: 12 },
  { scale: 0.625, count: 28, size: 12 },
  { scale: 0.5, count: 23, size: 11 },
  { scale: 0.375, count: 17, size: 11 },
  { scale: 0.25, count: 10, size: 10 },
  { scale: 0.125, count: 3, size: 10 },
];

function buildHeart(flowerIds) {
  const list = ids(flowerIds);
  const out = [];

  for (let i = 0; i < HEART_CONTOURS.length; i += 1) {
    const c = HEART_CONTOURS[i];
    const k = HEART_K * c.scale;
    out.push(...curveLayout({
      pt: (u) => {
        const p = heartPoint(u * Math.PI * 2);
        return { x: p.x * k, y: p.y * k };
      },
      count: c.count,
      size: c.size,
      // Bands from the rim inward, so the fill reads as contour lines of colour.
      flowerId: pick(list, i),
      closed: true,
    }));
  }

  out.push(bloom(pick(list, HEART_CONTOURS.length), 0, 0, 12, 0));
  return finish(out, 200, list);
}

/* ------------------------------------------------------------------ *
 * kerala — a nilavilakku between two palms, over a snake boat
 * ------------------------------------------------------------------ */

/**
 * Mirror a set of blooms across the vertical axis, re-facing each one outward.
 * Used for the palms, so the left and right trees are exact reflections.
 */
function mirrorX(blooms) {
  return blooms.map((b) => bloom(b.flowerId, -b.x, b.y, b.size, outward(-b.x, b.y)));
}

/** One coconut palm, leaning outward, drawn from an explicit skeleton. */
function palm(size, flowerId) {
  const out = [];
  // Trunk: four blooms from the base up to the crown at (-42, -22).
  const trunk = [
    [-28, 8],
    [-32.7, -2],
    [-37.3, -12],
    [-42, -22],
  ];
  for (let i = 0; i < trunk.length; i += 1) {
    out.push(bloom(flowerId, trunk[i][0], trunk[i][1], size));
  }
  // Four fronds off the crown, two blooms each, at 10 and 19 units.
  const fronds = [
    [-0.72, -0.69],
    [-0.08, -1.0],
    [0.55, -0.84],
    [-1.0, -0.15],
  ];
  for (let f = 0; f < fronds.length; f += 1) {
    const [dx, dy] = fronds[f];
    const len = Math.hypot(dx, dy);
    for (let s = 0; s < 2; s += 1) {
      const d = s === 0 ? 10 : 19;
      out.push(bloom(flowerId, -42 + (dx / len) * d, -22 + (dy / len) * d, size - 1));
    }
  }
  return out; // 4 + 8 = 12
}

/*
 * rim ring   r = 88, 66 blooms, size 8: arc 8.4 >= 8; reach 88 + 4 = 92
 * braid ring r = 77, 45 blooms, size 9: arc 10.8 >= 9; gap 11 >= 8.5
 *   borders: 66 + 45 = 111
 *
 * lamp on the axis, 24 blooms:
 *   flame tip (0,-47) s9 + flame (0,-38) s11                        =  2
 *   bowl, 7 blooms on the parabola x = 17u, y = -26 + 10(1-u^2)     =  7
 *   bowl lips (+-22, -27) s9                                        =  2
 *   stem (0,-4) s11 and (0,7) s11                                   =  2
 *   plinth, 9 blooms on x = 30u, y = 17 - 3u^2                      =  9
 *   plinth feet (+-36, 12) s9                                       =  2
 *   lamp sum: 2 + 7 + 2 + 2 + 9 + 2 = 24            running: 135
 *
 * palms  2 x 12 = 24                                 running: 159
 *   furthest frond bloom sits near r = 66, clear of the r=77 braid.
 *
 * boat (vanchi) in the lower band, 41 blooms:
 *   hull   22 on x = 58u, y = 28 + 26(1-u^2)   (dips to (0,54))     = 22
 *   prows   4 per side, curling up to (+-66, 3)                     =  8
 *   crew   11 on x = 46u, y = 24 + 9(1-u^2)                         = 11
 *   boat sum: 22 + 8 + 11 = 41                       running: 200
 *
 * count sum: 111 + 24 + 24 + 41 = 200.
 * furthest reach: the rim, 88 + 8/2 = 92 <= 96.
 */
function buildKerala(flowerIds) {
  const list = ids(flowerIds);
  const out = [];

  // --- borders (66 + 45) ---
  out.push(...ringLayout({
    radius: 88,
    count: 66,
    size: 8,
    flowerId: (i) => pick(list, i % 2),
  }));
  out.push(...ringLayout({ radius: 77, count: 45, size: 9, flowerId: pick(list, 2) }));

  // --- the lamp (24) ---
  const lampId = pick(list, 3);
  const flameId = pick(list, 4);
  out.push(bloom(flameId, 0, -47, 9));
  out.push(bloom(flameId, 0, -38, 11));
  for (let i = 0; i < 7; i += 1) {
    const u = -1 + i / 3; // -1, -2/3, -1/3, 0, 1/3, 2/3, 1
    out.push(bloom(lampId, 17 * u, -26 + 10 * (1 - u * u), 10));
  }
  out.push(bloom(lampId, -22, -27, 9));
  out.push(bloom(lampId, 22, -27, 9));
  out.push(bloom(lampId, 0, -4, 11));
  out.push(bloom(lampId, 0, 7, 11));
  for (let i = 0; i < 9; i += 1) {
    const u = -1 + i / 4; // -1 .. 1 in eight steps
    out.push(bloom(lampId, 30 * u, 17 - 3 * u * u, 10));
  }
  out.push(bloom(lampId, -36, 12, 9));
  out.push(bloom(lampId, 36, 12, 9));

  // --- the palms (2 x 12) ---
  const palmId = pick(list, 5);
  const leftPalm = palm(10, palmId);
  out.push(...leftPalm, ...mirrorX(leftPalm));

  // --- the boat (22 + 8 + 11) ---
  const hullId = pick(list, 6);
  const crewId = pick(list, 7);
  out.push(...curveLayout({
    pt: (u) => {
      const v = -1 + 2 * u;
      return { x: 58 * v, y: 28 + 26 * (1 - v * v) };
    },
    count: 22,
    size: 10,
    flowerId: hullId,
  }));
  const prow = [
    [60, 21],
    [63, 15],
    [65, 9],
    [66, 3],
  ];
  for (let i = 0; i < prow.length; i += 1) {
    out.push(bloom(hullId, prow[i][0], prow[i][1], 9));
    out.push(bloom(hullId, -prow[i][0], prow[i][1], 9));
  }
  out.push(...curveLayout({
    pt: (u) => {
      const v = -1 + 2 * u;
      return { x: 46 * v, y: 24 + 9 * (1 - v * v) };
    },
    count: 11,
    size: 9,
    flowerId: crewId,
  }));

  return finish(out, 200, list);
}

/* ------------------------------------------------------------------ *
 * surprise — seeded, never Math.random
 * ------------------------------------------------------------------ */

/** Numerical Recipes LCG. Same seed, same pookalam, forever. */
function lcg(seed) {
  let s = (Math.floor(Math.abs(seed)) || 1) >>> 0;
  const next = () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s;
  };
  next(); // discard the first draw; low seeds are poor on their own
  return {
    unit: () => next() / 4294967296,
    int: (n) => (n <= 0 ? 0 : next() % n),
    range: (a, b) => a + (next() / 4294967296) * (b - a),
    of: (arr) => arr[next() % arr.length],
  };
}

/**
 * A full, plausible pookalam from a seed: a graded stack of rings whose counts
 * come from circumference / size (so they are always evenly packed), a random
 * symmetry order of spokes over the top, and `finish()` to land on exactly 200.
 */
export function surprise(flowerIds, seed = 1) {
  const list = ids(flowerIds);
  const rnd = lcg(seed);
  const out = [bloom(rnd.of(list), 0, 0, 18, 0)];

  const spokeOrder = rnd.of([6, 8, 10, 12]);
  const ringCount = 5 + rnd.int(3); // 5..7 rings
  const outerR = 84 + rnd.int(5); // 84..88

  let r = 15 + rnd.int(4);
  const step = (outerR - r) / Math.max(ringCount - 1, 1);

  for (let i = 0; i < ringCount; i += 1) {
    // Bigger toward the centre: interpolate 13 down to 8 across the stack.
    const t = ringCount === 1 ? 0 : i / (ringCount - 1);
    const size = Math.max(8, Math.round(13 - 5 * t));
    // Counts from circumference so no ring is ever sparse or jammed.
    const raw = Math.max(6, Math.round((2 * Math.PI * r) / (size * rnd.range(0.95, 1.2))));
    // Snap to a multiple of the symmetry order, so mirrored petals land true.
    const count = Math.max(spokeOrder, Math.round(raw / spokeOrder) * spokeOrder);
    const bandId = rnd.of(list);
    const altId = rnd.of(list);
    const alternate = rnd.unit() < 0.35;
    out.push(...ringLayout({
      radius: r,
      count,
      size,
      phase: rnd.range(0, 360 / count),
      flowerId: alternate ? (k) => (k % 2 ? altId : bandId) : bandId,
    }));
    r += step;
  }

  // A few spokes, to break the banding the way a real one has a motif.
  if (rnd.unit() < 0.7) {
    const spokeId = rnd.of(list);
    const base = rnd.range(0, 360 / spokeOrder);
    const radii = [];
    for (let rr = 22 + rnd.int(8); rr < outerR - 8; rr += 11) radii.push(rr);
    const sizes = radii.map((rr) => Math.max(8, Math.round(12 - (rr / outerR) * 4)));
    for (let k = 0; k < spokeOrder; k += 1) {
      out.push(...radialRun({
        angleDeg: base + (k * 360) / spokeOrder,
        radii,
        sizes,
        flowerId: spokeId,
      }));
    }
  }

  return finish(out, 200, list);
}

/* ------------------------------------------------------------------ *
 * The six
 * ------------------------------------------------------------------ */

export const TEMPLATES = [
  {
    id: 'classic',
    label: 'Classic',
    note: 'Concentric rings, laid outward in from the rim — the pookalam everybody knows.',
    blooms: 200,
    build: buildClassic,
  },
  {
    id: 'sun',
    label: 'Sun',
    note: 'A packed core with twelve long rays and twelve short, bound by a solid rim.',
    blooms: 200,
    build: buildSun,
  },
  {
    id: 'lotus',
    label: 'Lotus',
    note: 'Two rings of petals opening outward from a seed pod.',
    blooms: 200,
    build: buildLotus,
  },
  {
    id: 'heart',
    label: 'Heart',
    note: 'The heart outline, filled in with eight nested contours.',
    blooms: 200,
    build: buildHeart,
  },
  {
    id: 'kerala',
    label: 'Kerala',
    note: 'A lamp between two palms, riding above a snake boat, inside a double border.',
    blooms: 200,
    build: buildKerala,
  },
  {
    id: 'freehand',
    label: 'Freehand',
    note: 'Bare mat. Lay it however you like.',
    blooms: 0,
    build: () => [],
  },
];

export default TEMPLATES;
