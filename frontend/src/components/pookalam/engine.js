/**
 * The brain of the pookalam editor: pure state, pure geometry, no React, no DOM.
 *
 * Everything the game knows how to do lives here as a reducer over one plain
 * object, so the page can stay a thin shell that only translates pointers and
 * clicks into actions. Three things in here are worth reading before trusting
 * them, because they are where a flower-laying game usually goes wrong:
 *
 *  1. Symmetry dedup. A tap becomes a whole rotational group, and points that
 *     coincide (the centre, or anything sitting on the mirror axis) must yield
 *     ONE flower, not n stacked in the same hole. `symmetryPositions` dedups by
 *     position with an epsilon, so the budget is never quietly eaten by
 *     invisible duplicates.
 *
 *  2. All-or-nothing budget. Copies that fall off the mat are dropped first,
 *     then the surviving group is checked against the remaining budget as a
 *     unit. With 3 flowers left and 8× symmetry you get nothing rather than a
 *     lopsided third of a pattern — a half-laid mandala is worse than no
 *     mandala.
 *
 *  3. History. `past`/`future` are stacks of bloom-array snapshots (never
 *     mutated, so sharing them is safe). A drag fires `move` on every
 *     pointermove and must not fill the stack: the first `move` of a gesture
 *     stashes the pre-drag snapshot in the internal `dragFrom` field, and
 *     `moveCommit` turns the whole gesture into a single undo entry.
 *
 * Which actions push undo history:
 *   PUSH   place, nudge, moveCommit (the pre-drag snapshot, once per gesture),
 *          rotate, resize, duplicate, remove, eraseAt (only when it actually
 *          removes something), swapAll, harmoniseRings, symmetriseSelection,
 *          centrepiece, loadBlooms, reset
 *   NO PUSH  select, deselect, move, setSymmetry, toggleMirror, toggleSnap,
 *          setFamily, every sketch* action, toggleSketch, toggleSketchVisible,
 *          undo, redo (these two move snapshots between the stacks instead)
 *
 * A long eraser sweep is the one deliberately chatty case: each bloom it takes
 * off is its own undo entry, so undo puts flowers back one at a time. That is
 * cheap (history is capped) and it reads as forgiving rather than surprising.
 *
 * Sketch strokes have their own small undo (`sketchUndo`) and are intentionally
 * outside the bloom history — undoing a flower should not eat your drawing.
 */

/* ------------------------------------------------------------------ constants */

export const BUDGET = 200;

/** Mat radius. The canvas viewBox is "-100 -100 200 200"; the mat is r=96. */
export const MAT_R = 96;

/** The three offered sizes, in canvas units of diameter. */
export const SIZES = { small: 9, medium: 13, large: 18 };

export const MIN_SIZE = 6;
export const MAX_SIZE = 26;

/** Undo depth. Enough to rescue a bad idea, small enough to stay cheap. */
const HISTORY_CAP = 60;

/** Two placements closer than this (canvas units) count as the same spot. */
const SAME_SPOT = 0.5;

/** Polar snap grid: rings every 8 units, spokes every 15 degrees. */
const RING_STEP = 8;
const SPOKE_STEP = 15;

const DEG = Math.PI / 180;

/* -------------------------------------------------------------------- helpers */

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

/** Fixed 3-decimal rounding, so repeated symmetry maths cannot drift. */
function r3(v) {
  return Math.round(v * 1000) / 1000;
}

function clampSize(v) {
  const n = Number.isFinite(v) ? v : SIZES.medium;
  return r3(clamp(n, MIN_SIZE, MAX_SIZE));
}

function normRot(deg) {
  const d = ((deg % 360) + 360) % 360;
  return r3(d);
}

/**
 * Containment: a bloom is on the mat when its own circle sits inside r=96,
 * with 1.5 units of grace so a flower is allowed to kiss the rim.
 */
export function insideMat(x, y, size) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
  const s = Number.isFinite(size) ? size : SIZES.medium;
  return Math.hypot(x, y) <= MAT_R - s / 2 + 1.5;
}

/** Flowers still available. */
export function remaining(state) {
  return Math.max(0, BUDGET - state.blooms.length);
}

function sameSpot(a, b) {
  return Math.abs(a.x - b.x) < SAME_SPOT && Math.abs(a.y - b.y) < SAME_SPOT;
}

function occupied(blooms, x, y) {
  for (let i = 0; i < blooms.length; i++) {
    if (Math.abs(blooms[i].x - x) < SAME_SPOT && Math.abs(blooms[i].y - y) < SAME_SPOT) return true;
  }
  return false;
}

/* ------------------------------------------------------------------- geometry */

/**
 * Every place a single tap should land a flower: the original plus its
 * rotational copies at 360/n about the origin, plus — when `mirror` is on —
 * the reflection of each across the vertical axis.
 *
 * The mirrored copy keeps the reflected orientation as a negated rotation,
 * which is what a viewer reads as "mirrored" for radially drawn petal art.
 *
 * Dedup is by POSITION only, with an epsilon: two flowers at the same point
 * are waste however differently they are turned. That is what makes a tap on
 * the mirror axis, or dead centre, cost one flower instead of n.
 */
export function symmetryPositions({ x, y, symmetry = 1, mirror = false }) {
  const n = Math.max(1, Math.round(symmetry || 1));
  const step = 360 / n;
  const out = [];

  const push = (px, py, prot) => {
    const p = { x: r3(px), y: r3(py), rot: normRot(prot) };
    for (let i = 0; i < out.length; i++) if (sameSpot(out[i], p)) return;
    out.push(p);
  };

  for (let i = 0; i < n; i++) {
    const a = step * i * DEG;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    const rx = x * ca - y * sa;
    const ry = x * sa + y * ca;
    push(rx, ry, step * i);
    if (mirror) push(-rx, ry, -(step * i));
  }
  return out;
}

/**
 * Snap to a POLAR grid — rings every 8 units, spokes every 15 degrees —
 * because a rectangular grid is the wrong guide for a radial artwork: you want
 * petals lining up along rings and spokes, not along rows.
 *
 * Anything that snaps to ring zero collapses to the exact centre.
 */
export function snapPoint(x, y, on) {
  if (!on) return { x, y };
  const r = Math.hypot(x, y);
  const ring = Math.round(r / RING_STEP) * RING_STEP;
  if (ring <= 0) return { x: 0, y: 0 };
  const ang = Math.round((Math.atan2(y, x) / DEG) / SPOKE_STEP) * SPOKE_STEP * DEG;
  return { x: r3(Math.cos(ang) * ring), y: r3(Math.sin(ang) * ring) };
}

/** Topmost bloom (last drawn wins) whose circle contains the point, or null. */
export function hitTest(blooms, x, y) {
  for (let i = blooms.length - 1; i >= 0; i--) {
    const b = blooms[i];
    const rad = Math.max(b.size / 2, 4);
    if (Math.hypot(b.x - x, b.y - y) <= rad) return b.id;
  }
  return null;
}

/* ---------------------------------------------------------------------- score */

/**
 * A playful 0-100 read on the design. Deterministic, no randomness.
 *
 *   effort    40 pts   flowers used / 200, linear.
 *   symmetry  25 pts   best rotational order found in the layout. For each n in
 *                      {2,4,6,8,12} we count blooms that have a partner where
 *                      the layout rotated by 360/n says one should be (within
 *                      3 units), and take the best fraction. Higher orders get
 *                      a small multiplier so 12x reads as more accomplished
 *                      than 2x.
 *   variety   15 pts   distinct flower kinds / 6, capped.
 *   spread    20 pts   how evenly blooms cover the mat by RING, compared with
 *                      what an even spread would give. Rings are 16 units wide
 *                      and outer rings hold more area, so the target share of
 *                      each ring is its share of the mat's area; the penalty is
 *                      total-variation distance from that target. A tidy pile
 *                      in one corner scores near zero here, a mat filled out to
 *                      the rim scores near full.
 *
 * An empty mat scores 0.
 */
export function scoreOf(blooms) {
  const n = blooms.length;
  if (!n) return 0;

  const effort = 40 * Math.min(1, n / BUDGET);

  /* --- symmetry --- */
  let best = 0;
  const orders = [2, 4, 6, 8, 12];
  for (let oi = 0; oi < orders.length; oi++) {
    const k = orders[oi];
    const a = (360 / k) * DEG;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    let matched = 0;
    for (let i = 0; i < n; i++) {
      const b = blooms[i];
      const tx = b.x * ca - b.y * sa;
      const ty = b.x * sa + b.y * ca;
      for (let j = 0; j < n; j++) {
        if (Math.hypot(blooms[j].x - tx, blooms[j].y - ty) <= 3) {
          matched++;
          break;
        }
      }
    }
    const boost = 0.7 + 0.3 * Math.min(1, k / 8);
    const s = (matched / n) * boost;
    if (s > best) best = s;
  }
  const symmetry = 25 * Math.min(1, best);

  /* --- variety --- */
  const kinds = {};
  for (let i = 0; i < n; i++) kinds[blooms[i].flowerId] = true;
  const variety = 15 * Math.min(1, Object.keys(kinds).length / 6);

  /* --- spread across rings --- */
  const RING_W = 16;
  const bands = Math.ceil(MAT_R / RING_W);
  const counts = new Array(bands).fill(0);
  for (let i = 0; i < n; i++) {
    const idx = Math.min(bands - 1, Math.floor(Math.hypot(blooms[i].x, blooms[i].y) / RING_W));
    counts[idx]++;
  }
  let tvd = 0;
  for (let k = 0; k < bands; k++) {
    const inner = k * RING_W;
    const outer = Math.min(MAT_R, (k + 1) * RING_W);
    const target = (outer * outer - inner * inner) / (MAT_R * MAT_R);
    tvd += Math.abs(counts[k] / n - target);
  }
  const spread = 20 * Math.max(0, 1 - tvd / 2);

  return Math.round(clamp(effort + symmetry + variety + spread, 0, 100));
}

/* ------------------------------------------------------- sketch -> placements */

function pickFlower(flowerIds, i) {
  const list = Array.isArray(flowerIds) && flowerIds.length ? flowerIds : ['flower'];
  return list[((i % list.length) + list.length) % list.length];
}

/** Radial orientation: petals face out from the centre. */
function radialRot(x, y) {
  return normRot(Math.atan2(y, x) / DEG + 90);
}

/**
 * "Turn Sketch into Pookalam": trace the drawn strokes with flowers.
 *
 * Walks each stroke by arc length dropping a bloom every `STEP` units, skips
 * anything that would land on top of a bloom already emitted, keeps only what
 * fits on the mat, and stops at `budgetLeft`. Flower kinds cycle through
 * `flowerIds` by emission order, so a multi-colour selection banded along the
 * line instead of turning into one flat colour.
 *
 * Returns placement descriptors ({ flowerId, x, y, size, rot }) with no ids —
 * feed them through `loadBlooms`, which assigns ids.
 */
export function fillPolyline(strokes, flowerIds, budgetLeft) {
  const cap = Math.max(0, Math.floor(budgetLeft || 0));
  const out = [];
  if (!cap || !Array.isArray(strokes)) return out;

  const STEP = 7;
  const size = SIZES.small;
  const GAP = 5.5;

  const tryPush = (x, y) => {
    if (out.length >= cap) return;
    if (!insideMat(x, y, size)) return;
    for (let i = 0; i < out.length; i++) {
      if (Math.hypot(out[i].x - x, out[i].y - y) < GAP) return;
    }
    out.push({
      flowerId: pickFlower(flowerIds, out.length),
      x: r3(x),
      y: r3(y),
      size,
      rot: radialRot(x, y),
    });
  };

  for (let s = 0; s < strokes.length && out.length < cap; s++) {
    const pts = strokes[s];
    if (!Array.isArray(pts) || !pts.length) continue;
    tryPush(pts[0].x, pts[0].y);
    let carry = 0;
    for (let i = 1; i < pts.length && out.length < cap; i++) {
      const ax = pts[i - 1].x;
      const ay = pts[i - 1].y;
      const bx = pts[i].x;
      const by = pts[i].y;
      const seg = Math.hypot(bx - ax, by - ay);
      if (seg < 1e-6) continue;
      let t = STEP - carry;
      while (t <= seg && out.length < cap) {
        const f = t / seg;
        tryPush(ax + (bx - ax) * f, ay + (by - ay) * f);
        t += STEP;
      }
      carry = (carry + seg) % STEP;
    }
  }
  return out;
}

/** Even-odd point-in-polygon. */
function pointInPolygon(pts, x, y) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i].x;
    const yi = pts[i].y;
    const xj = pts[j].x;
    const yj = pts[j].y;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/**
 * "Fill inside shape": the first stroke is read as a closed polygon (the
 * closing edge is implied) and its interior is packed on a hex lattice — rows
 * 0.866 * spacing apart with alternate rows offset by half a step, which packs
 * rounder and denser than a square grid.
 *
 * Candidates are ordered by distance from the centre so that a budget cap trims
 * the outside of the shape rather than lopping off its bottom. Ties break on y
 * then x, which keeps the result deterministic.
 *
 * Flower kind comes from the candidate's ring index, giving concentric bands.
 */
export function fillInside(strokes, flowerIds, budgetLeft) {
  const cap = Math.max(0, Math.floor(budgetLeft || 0));
  const out = [];
  if (!cap || !Array.isArray(strokes) || !strokes.length) return out;
  const poly = strokes[0];
  if (!Array.isArray(poly) || poly.length < 3) return out;

  const size = SIZES.small;
  const SP = 9;
  const ROW = SP * 0.866;

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < poly.length; i++) {
    if (poly[i].x < minX) minX = poly[i].x;
    if (poly[i].x > maxX) maxX = poly[i].x;
    if (poly[i].y < minY) minY = poly[i].y;
    if (poly[i].y > maxY) maxY = poly[i].y;
  }

  const cand = [];
  let row = 0;
  for (let y = minY; y <= maxY + 1e-9; y += ROW, row++) {
    const shift = row % 2 ? SP / 2 : 0;
    const start = Math.ceil((minX - shift) / SP) * SP + shift;
    for (let x = start; x <= maxX + 1e-9; x += SP) {
      if (!insideMat(x, y, size)) continue;
      if (!pointInPolygon(poly, x, y)) continue;
      cand.push({ x: r3(x), y: r3(y), d: Math.hypot(x, y) });
    }
  }

  cand.sort((a, b) => a.d - b.d || a.y - b.y || a.x - b.x);

  const take = Math.min(cap, cand.length);
  for (let i = 0; i < take; i++) {
    const c = cand[i];
    out.push({
      flowerId: pickFlower(flowerIds, Math.floor(c.d / SP)),
      x: c.x,
      y: c.y,
      size,
      rot: radialRot(c.x, c.y),
    });
  }
  return out;
}

/* -------------------------------------------------------------------- reducer */

export function initialState() {
  return {
    blooms: [],
    selectedId: null,
    nextId: 1,
    symmetry: 1,
    mirror: false,
    snap: false,
    family: 'all',
    sketch: [],
    sketchOn: false,
    sketchVisible: true,
    past: [],
    future: [],
    /* Internal: the pre-drag bloom snapshot held open while a drag gesture is
       in flight, so `moveCommit` can push exactly one undo entry. */
    dragFrom: null,
  };
}

/** Append a snapshot, trimming the oldest beyond the cap. */
function pushPast(past, snapshot) {
  const next = past.concat([snapshot]);
  return next.length > HISTORY_CAP ? next.slice(next.length - HISTORY_CAP) : next;
}

/**
 * Structural change: new blooms array, old one banked for undo, redo dropped,
 * and any half-open drag gesture forgotten.
 */
function commit(state, blooms, extra) {
  return {
    ...state,
    ...extra,
    blooms,
    past: pushPast(state.past, state.blooms),
    future: [],
    dragFrom: null,
  };
}

/** Non-structural change: no history involvement at all. */
function quiet(state, extra) {
  return { ...state, ...extra };
}

function makeBloom(id, flowerId, x, y, size, rot) {
  return { id, flowerId, x: r3(x), y: r3(y), size: clampSize(size), rot: normRot(rot) };
}

function replaceBloom(blooms, id, patch) {
  let hit = false;
  const next = blooms.map((b) => {
    if (b.id !== id) return b;
    hit = true;
    return { ...b, ...patch };
  });
  return hit ? next : null;
}

function selectionOf(state, id) {
  return state.blooms.some((b) => b.id === id) ? id : null;
}

/**
 * Lay a group of placements as one all-or-nothing transaction: off-mat copies
 * are dropped first, then what remains must fit the budget entirely or nothing
 * is placed. Positions already occupied are skipped so patterns never stack.
 */
/**
 * Which of a symmetry group's positions would actually take a flower: the ones
 * on the mat, not already occupied, and not duplicates of each other.
 *
 * Split out of `layGroup` so the UI can ask the same question before dispatching
 * and explain a refusal. A tap that quietly does nothing — because the budget is
 * short, or because every mirrored copy landed on a flower that is already
 * there — reads as a broken game, and a second implementation of this filter in
 * the view layer would drift out of step with this one.
 */
export function planGroup(state, group, size) {
  const s = clampSize(size);
  const fitted = [];
  for (let i = 0; i < group.length; i++) {
    const p = group[i];
    if (!insideMat(p.x, p.y, s)) continue;
    if (occupied(state.blooms, p.x, p.y)) continue;
    let dup = false;
    for (let j = 0; j < fitted.length; j++) if (sameSpot(fitted[j], p)) dup = true;
    if (!dup) fitted.push(p);
  }
  return fitted;
}

/** What a tap at (x,y) would lay, without laying it. */
export function planPlacement(state, { x, y, size }) {
  const group = symmetryPositions({
    x,
    y,
    symmetry: state.symmetry,
    mirror: state.mirror,
  });
  const fitted = planGroup(state, group, size);
  return {
    group: group.length,
    cost: fitted.length,
    left: remaining(state),
    /* Mirrors layGroup's own two refusal conditions. */
    blocked: fitted.length === 0,
    tooMany: fitted.length > remaining(state),
  };
}

function layGroup(state, group, flowerId, size) {
  const fitted = planGroup(state, group, size);
  if (!fitted.length) return null;
  if (fitted.length > remaining(state)) return null;

  let id = state.nextId;
  const added = fitted.map((p) => makeBloom(id++, flowerId, p.x, p.y, size, p.rot));
  return { blooms: state.blooms.concat(added), nextId: id, firstId: added[0].id };
}

export function reducer(state, action) {
  switch (action.type) {
    /* ------------------------------------------------------------- placing */

    case 'place': {
      const size = clampSize(action.size);
      const group = symmetryPositions({
        x: action.x,
        y: action.y,
        symmetry: state.symmetry,
        mirror: state.mirror,
      });
      const laid = layGroup(state, group, action.flowerId, size);
      if (!laid) return state;
      return commit(state, laid.blooms, { nextId: laid.nextId, selectedId: laid.firstId });
    }

    case 'symmetriseSelection': {
      const b = state.blooms.find((x) => x.id === state.selectedId);
      if (!b) return state;
      const group = symmetryPositions({
        x: b.x,
        y: b.y,
        symmetry: state.symmetry,
        mirror: state.mirror,
      }).filter((p) => !sameSpot(p, b));
      /* Same all-or-nothing rule as `place`: a partial ring is not a ring. */
      const laid = layGroup(state, group, b.flowerId, b.size);
      if (!laid) return state;
      return commit(state, laid.blooms, { nextId: laid.nextId });
    }

    case 'centrepiece': {
      /* A nilavilakku-ish cluster: one big bloom, then two staggered rings. */
      const spec = [{ r: 0, n: 1, size: SIZES.large, off: 0 }];
      spec.push({ r: 13, n: 8, size: SIZES.small, off: 0 });
      spec.push({ r: 24, n: 8, size: SIZES.small, off: 22.5 });

      const wanted = [];
      for (let s = 0; s < spec.length; s++) {
        const ring = spec[s];
        for (let i = 0; i < ring.n; i++) {
          const a = (ring.off + (360 / ring.n) * i) * DEG;
          const x = r3(Math.cos(a) * ring.r);
          const y = r3(Math.sin(a) * ring.r);
          if (!insideMat(x, y, ring.size)) continue;
          if (occupied(state.blooms, x, y)) continue;
          wanted.push({ x, y, size: ring.size, rot: radialRot(x, y) });
        }
      }
      if (!wanted.length) return state;
      /* All or nothing again — half a lamp is just clutter in the middle. */
      if (wanted.length > remaining(state)) return state;

      let id = state.nextId;
      const added = wanted.map((p) => makeBloom(id++, action.flowerId, p.x, p.y, p.size, p.rot));
      return commit(state, state.blooms.concat(added), { nextId: id, selectedId: null });
    }

    case 'duplicate': {
      const b = state.blooms.find((x) => x.id === action.id);
      if (!b) return state;
      if (remaining(state) < 1) return state;
      let x = b.x + 5;
      let y = b.y + 5;
      if (!insideMat(x, y, b.size)) {
        x = b.x - 5;
        y = b.y - 5;
      }
      if (!insideMat(x, y, b.size)) return state;
      const copy = makeBloom(state.nextId, b.flowerId, x, y, b.size, b.rot);
      return commit(state, state.blooms.concat([copy]), {
        nextId: state.nextId + 1,
        selectedId: copy.id,
      });
    }

    /* ------------------------------------------------------------ selecting */

    case 'select':
      return quiet(state, { selectedId: selectionOf(state, action.id) });

    case 'deselect':
      return state.selectedId === null ? state : quiet(state, { selectedId: null });

    /* -------------------------------------------------------------- editing */

    case 'move': {
      /* Fires on every pointermove: NO history push. The first move of the
         gesture stashes the pre-drag snapshot for `moveCommit` to bank. */
      const b = state.blooms.find((x) => x.id === action.id);
      if (!b) return state;
      const x = clamp(action.x, -MAT_R, MAT_R);
      const y = clamp(action.y, -MAT_R, MAT_R);
      if (!insideMat(x, y, b.size)) return state;
      const blooms = replaceBloom(state.blooms, action.id, { x: r3(x), y: r3(y) });
      if (!blooms) return state;
      return {
        ...state,
        blooms,
        selectedId: action.id,
        dragFrom: state.dragFrom || state.blooms,
      };
    }

    case 'moveCommit': {
      /* Close the gesture: one undo entry for the whole drag. */
      if (!state.dragFrom) return state;
      if (state.dragFrom === state.blooms) return { ...state, dragFrom: null };
      return {
        ...state,
        past: pushPast(state.past, state.dragFrom),
        future: [],
        dragFrom: null,
      };
    }

    case 'nudge': {
      const b = state.blooms.find((x) => x.id === action.id);
      if (!b) return state;
      const x = b.x + (action.dx || 0);
      const y = b.y + (action.dy || 0);
      if (!insideMat(x, y, b.size)) return state;
      const blooms = replaceBloom(state.blooms, action.id, { x: r3(x), y: r3(y) });
      return blooms ? commit(state, blooms) : state;
    }

    case 'rotate': {
      const b = state.blooms.find((x) => x.id === action.id);
      if (!b) return state;
      const blooms = replaceBloom(state.blooms, action.id, {
        rot: normRot(b.rot + (action.delta || 0)),
      });
      return blooms ? commit(state, blooms) : state;
    }

    case 'resize': {
      const b = state.blooms.find((x) => x.id === action.id);
      if (!b) return state;
      const size = clampSize(b.size + (action.delta || 0));
      if (size === b.size) return state;
      if (!insideMat(b.x, b.y, size)) return state;
      const blooms = replaceBloom(state.blooms, action.id, { size });
      return blooms ? commit(state, blooms) : state;
    }

    case 'remove': {
      if (!state.blooms.some((b) => b.id === action.id)) return state;
      const blooms = state.blooms.filter((b) => b.id !== action.id);
      return commit(state, blooms, {
        selectedId: state.selectedId === action.id ? null : state.selectedId,
      });
    }

    case 'eraseAt': {
      const radius = Number.isFinite(action.radius) ? action.radius : 9;
      const blooms = state.blooms.filter(
        (b) => Math.hypot(b.x - action.x, b.y - action.y) > radius + b.size * 0.35
      );
      if (blooms.length === state.blooms.length) return state;
      return commit(state, blooms, {
        selectedId: blooms.some((b) => b.id === state.selectedId) ? state.selectedId : null,
      });
    }

    /* --------------------------------------------------------- recolouring */

    case 'swapAll': {
      if (!state.blooms.length) return state;
      if (state.blooms.every((b) => b.flowerId === action.flowerId)) return state;
      const blooms = state.blooms.map((b) => ({ ...b, flowerId: action.flowerId }));
      return commit(state, blooms);
    }

    case 'harmoniseRings': {
      const ids = Array.isArray(action.flowerIds) ? action.flowerIds.filter(Boolean) : [];
      if (!ids.length || !state.blooms.length) return state;
      /* One kind per 16-unit ring, so the mat reads as concentric bands. */
      const RING_W = 16;
      const blooms = state.blooms.map((b) => {
        const ring = Math.floor(Math.hypot(b.x, b.y) / RING_W);
        return { ...b, flowerId: pickFlower(ids, ring) };
      });
      let changed = false;
      for (let i = 0; i < blooms.length; i++) {
        if (blooms[i].flowerId !== state.blooms[i].flowerId) changed = true;
      }
      return changed ? commit(state, blooms) : state;
    }

    /* -------------------------------------------------------------- toggles */

    case 'setSymmetry':
      return quiet(state, { symmetry: Math.max(1, Math.round(action.n || 1)) });

    case 'toggleMirror':
      return quiet(state, { mirror: !state.mirror });

    case 'toggleSnap':
      return quiet(state, { snap: !state.snap });

    case 'setFamily':
      return quiet(state, { family: action.id || 'all' });

    /* -------------------------------------------------------- bulk loading */

    case 'loadBlooms': {
      const list = Array.isArray(action.blooms) ? action.blooms : [];
      let id = 1;
      const blooms = [];
      for (let i = 0; i < list.length && blooms.length < BUDGET; i++) {
        const b = list[i];
        if (!b || !Number.isFinite(b.x) || !Number.isFinite(b.y)) continue;
        const size = clampSize(b.size);
        if (!insideMat(b.x, b.y, size)) continue;
        blooms.push(makeBloom(id++, b.flowerId, b.x, b.y, size, b.rot || 0));
      }
      return commit(state, blooms, { nextId: id, selectedId: null });
    }

    /* --------------------------------------------------------------- sketch */

    case 'sketchStart':
      return quiet(state, {
        sketch: state.sketch.concat([[{ x: r3(action.x), y: r3(action.y) }]]),
        sketchVisible: true,
        selectedId: null,
      });

    case 'sketchPoint': {
      if (!state.sketch.length) return state;
      const last = state.sketch[state.sketch.length - 1];
      const tip = last[last.length - 1];
      /* Thin the stream: sub-unit jitter would bloat the stroke for nothing. */
      if (tip && Math.hypot(tip.x - action.x, tip.y - action.y) < 1) return state;
      const sketch = state.sketch.slice(0, -1);
      sketch.push(last.concat([{ x: r3(action.x), y: r3(action.y) }]));
      return quiet(state, { sketch });
    }

    case 'sketchEnd': {
      if (!state.sketch.length) return state;
      const last = state.sketch[state.sketch.length - 1];
      if (last.length >= 2) return state;
      return quiet(state, { sketch: state.sketch.slice(0, -1) });
    }

    case 'sketchUndo':
      return state.sketch.length ? quiet(state, { sketch: state.sketch.slice(0, -1) }) : state;

    case 'sketchClear':
      return state.sketch.length ? quiet(state, { sketch: [] }) : state;

    case 'toggleSketch':
      return quiet(state, {
        sketchOn: !state.sketchOn,
        sketchVisible: true,
        selectedId: null,
      });

    case 'toggleSketchVisible':
      return quiet(state, { sketchVisible: !state.sketchVisible });

    /* -------------------------------------------------------------- history */

    case 'undo': {
      if (!state.past.length) return state;
      const blooms = state.past[state.past.length - 1];
      const future = [state.blooms].concat(state.future).slice(0, HISTORY_CAP);
      return {
        ...state,
        blooms,
        past: state.past.slice(0, -1),
        future,
        selectedId: blooms.some((b) => b.id === state.selectedId) ? state.selectedId : null,
        dragFrom: null,
      };
    }

    case 'redo': {
      if (!state.future.length) return state;
      const blooms = state.future[0];
      return {
        ...state,
        blooms,
        past: pushPast(state.past, state.blooms),
        future: state.future.slice(1),
        selectedId: blooms.some((b) => b.id === state.selectedId) ? state.selectedId : null,
        dragFrom: null,
      };
    }

    case 'reset': {
      /* Clears the mat and the sketch but keeps your tool settings, and stays
         undoable — resetting by accident should not be fatal. */
      if (!state.blooms.length && !state.sketch.length) return state;
      return commit(state, [], { selectedId: null, nextId: 1, sketch: [] });
    }

    default:
      return state;
  }
}
