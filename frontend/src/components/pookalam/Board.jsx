/**
 * The mat you actually play on.
 *
 * One SVG, one pointer handler, and a viewBox that does the zooming. Screen
 * pixels are converted to canvas units through the SVG's own
 * `getScreenCTM().inverse()` rather than by hand from the bounding rect,
 * because that matrix already accounts for the viewBox, the aspect ratio and
 * any CSS transform on an ancestor — recomputing it manually is where
 * click-lands-in-the-wrong-place bugs come from.
 *
 * Gesture rules, chosen so nothing costs a flower by accident:
 *   tap empty mat      → lay a flower (plus its symmetry copies)
 *   tap a flower       → select it
 *   drag a flower      → move it (one undo entry for the whole drag)
 *   drag empty mat     → pan, but only when zoomed in; otherwise it does
 *                        nothing, because a drag that quietly spent thirty
 *                        flowers would be a cruel thing to do to a budget
 *   wheel / pinch-ish  → zoom about the pointer
 *
 * A mouse also gets a live ghost of where the symmetry copies will land, which
 * turns "what does 12× do" from a question into something you can see before
 * you spend anything.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { bloomChildren, flowerById, flowerDefs, shapesToElements } from './flowers';
import { hitTest, planPlacement, snapPoint, symmetryPositions } from './engine';

const MAT_R = 96;
/* The art box is -50..50, i.e. 100 units across, so a bloom drawn at `size`
   units wants this scale factor. */
const ART_SPAN = 100;

/** Descriptor objects to SVG elements. The same descriptors are serialised to
 *  a string for the PNG export, which is what keeps screen and file identical. */
function Shapes({ flower }) {
  return shapesToElements(bloomChildren(flower), `f${flower.id}-`);
}

/** A polar grid, because a rectangular one is the wrong guide for a radial
 *  artwork — you want to line petals up on rings and spokes. */
function PolarGrid() {
  const rings = [];
  for (let r = 12; r <= MAT_R; r += 12) rings.push(r);
  const spokes = [];
  for (let a = 0; a < 180; a += 15) spokes.push(a);
  return (
    <g className="onam-grid">
      {rings.map((r) => (
        <circle key={r} r={r} />
      ))}
      {spokes.map((a) => {
        const rad = (a * Math.PI) / 180;
        const x = Math.cos(rad) * MAT_R;
        const y = Math.sin(rad) * MAT_R;
        return <line key={a} x1={-x} y1={-y} x2={x} y2={y} />;
      })}
    </g>
  );
}

export default function Board({
  state,
  dispatch,
  activeFlower,
  activeSize,
  tool,
  zoom,
  pan,
  onView,
  newIds,
  onCue,
  onRefuse,
  ariaLabel,
}) {
  const svgRef = useRef(null);
  const gesture = useRef(null);
  const [hover, setHover] = useState(null);

  const half = 100 / zoom;
  const viewBox = `${pan.x - half} ${pan.y - half} ${half * 2} ${half * 2}`;

  /** Screen point to canvas units. */
  const toCanvas = useCallback((evt) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = evt.clientX;
    pt.y = evt.clientY;
    const p = pt.matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  }, []);

  const clampPan = useCallback((x, y, z) => {
    const h = 100 / z;
    const limit = Math.max(0, 100 - h);
    const d = Math.hypot(x, y);
    if (d <= limit || d === 0) return { x, y };
    const k = limit / d;
    return { x: x * k, y: y * k };
  }, []);

  /* --- pointer -------------------------------------------------------- */

  function onPointerDown(evt) {
    // Ignore secondary buttons; a right-click should open the browser menu.
    if (evt.button !== 0 && evt.pointerType === 'mouse') return;
    const svg = svgRef.current;
    if (svg && evt.pointerId != null) {
      try { svg.setPointerCapture(evt.pointerId); } catch { /* not fatal */ }
    }
    const p = toCanvas(evt);

    if (state.sketchOn) {
      gesture.current = { kind: 'sketch' };
      dispatch({ type: 'sketchStart', x: p.x, y: p.y });
      return;
    }

    if (tool === 'erase') {
      gesture.current = { kind: 'erase' };
      dispatch({ type: 'eraseAt', x: p.x, y: p.y, radius: 9 });
      return;
    }

    const hitId = hitTest(state.blooms, p.x, p.y);
    if (hitId) {
      const bloom = state.blooms.find((b) => b.id === hitId);
      gesture.current = {
        kind: 'drag',
        id: hitId,
        // Grab offset, so a flower does not jump its centre to the finger.
        dx: bloom.x - p.x,
        dy: bloom.y - p.y,
        moved: false,
      };
      if (state.selectedId !== hitId) {
        dispatch({ type: 'select', id: hitId });
        onCue?.('select');
      }
      return;
    }

    // Empty mat. Zoomed in, a drag is a pan; either way a tap lays a flower,
    // decided on pointerup by how far the pointer travelled.
    gesture.current = {
      kind: 'mat',
      startX: evt.clientX,
      startY: evt.clientY,
      panFrom: { ...pan },
      moved: false,
    };
  }

  function onPointerMove(evt) {
    const g = gesture.current;
    const p = toCanvas(evt);

    if (!g) {
      // Ghost preview is a mouse affordance; on touch the finger covers it.
      if (evt.pointerType === 'mouse' && !state.sketchOn && tool !== 'erase' && activeFlower) {
        setHover(Math.hypot(p.x, p.y) <= MAT_R ? p : null);
      }
      return;
    }

    if (g.kind === 'sketch') {
      dispatch({ type: 'sketchPoint', x: p.x, y: p.y });
      return;
    }

    if (g.kind === 'erase') {
      dispatch({ type: 'eraseAt', x: p.x, y: p.y, radius: 9 });
      return;
    }

    if (g.kind === 'drag') {
      const snapped = snapPoint(p.x + g.dx, p.y + g.dy, state.snap);
      g.moved = true;
      dispatch({ type: 'move', id: g.id, x: snapped.x, y: snapped.y });
      return;
    }

    if (g.kind === 'mat') {
      const dxPx = evt.clientX - g.startX;
      const dyPx = evt.clientY - g.startY;
      if (!g.moved && Math.hypot(dxPx, dyPx) < 5) return;
      g.moved = true;
      if (zoom <= 1) return;
      // Pixels to canvas units: the visible span is half*2 units wide.
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect || !rect.width) return;
      const perPx = (half * 2) / rect.width;
      const next = clampPan(g.panFrom.x - dxPx * perPx, g.panFrom.y - dyPx * perPx, zoom);
      onView({ zoom, pan: next });
    }
  }

  function onPointerUp(evt) {
    const g = gesture.current;
    gesture.current = null;
    const svg = svgRef.current;
    if (svg && evt.pointerId != null) {
      try { svg.releasePointerCapture(evt.pointerId); } catch { /* already gone */ }
    }
    if (!g) return;

    if (g.kind === 'sketch') {
      dispatch({ type: 'sketchEnd' });
      return;
    }

    if (g.kind === 'drag') {
      if (g.moved) dispatch({ type: 'moveCommit' });
      return;
    }

    if (g.kind === 'mat') {
      if (g.moved) return; // that was a pan, not a tap
      if (!activeFlower) {
        // Nothing chosen to lay — treat the tap as "put the tools down".
        if (state.selectedId) dispatch({ type: 'deselect' });
        return;
      }
      const raw = toCanvas(evt);
      const p = snapPoint(raw.x, raw.y, state.snap);
      const group = symmetryPositions({
        x: p.x,
        y: p.y,
        symmetry: state.symmetry,
        mirror: state.mirror,
      });
      /* The engine refuses a group it cannot lay in full and skips copies that
         fall off the mat or onto a flower already there. All three are right,
         but done silently they read as a broken tap. Ask the engine what it
         would do first, so a refusal can be explained instead of ignored. */
      const plan = planPlacement(state, { x: p.x, y: p.y, size: activeSize });
      if (plan.blocked || plan.tooMany) {
        onRefuse?.(plan);
        return;
      }
      dispatch({ type: 'place', flowerId: activeFlower, x: p.x, y: p.y, size: activeSize });
      onCue?.(group.length > 1 ? 'pattern' : 'place');
    }
  }

  function onPointerLeave() {
    setHover(null);
  }

  /* Wheel zoom, anchored on the pointer so the thing under the cursor stays
     under the cursor. Non-passive listener because we preventDefault. */
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return undefined;
    const onWheel = (e) => {
      e.preventDefault();
      const dir = e.deltaY > 0 ? -1 : 1;
      const nextZoom = Math.min(4, Math.max(1, +(zoom * (dir > 0 ? 1.15 : 1 / 1.15)).toFixed(3)));
      if (nextZoom === zoom) return;
      const ctm = svg.getScreenCTM();
      if (!ctm) return;
      const pt = svg.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      const at = pt.matrixTransform(ctm.inverse());
      // Keep `at` fixed: solve for the pan that maps it to the same place.
      const k = 1 - zoom / nextZoom;
      const next = clampPan(pan.x + (at.x - pan.x) * k, pan.y + (at.y - pan.y) * k, nextZoom);
      onView({ zoom: nextZoom, pan: next });
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, [zoom, pan, onView, clampPan]);

  const ghosts =
    hover && activeFlower && !state.sketchOn
      ? symmetryPositions({
          x: hover.x,
          y: hover.y,
          symmetry: state.symmetry,
          mirror: state.mirror,
        })
      : [];

  const ghostFlower = activeFlower ? flowerById(activeFlower) : null;
  const selected = state.blooms.find((b) => b.id === state.selectedId) || null;

  /* Petal shading is done with gradients, and a gradient has to be defined
     somewhere before it can be referenced. Defining only the ones actually on
     the mat keeps this at four nodes per distinct flower instead of four per
     bloom — the difference between ~40 and ~800 with a full carpet down. */
  const defs = useMemo(() => {
    const ids = new Set(state.blooms.map((b) => b.flowerId));
    if (activeFlower) ids.add(activeFlower);
    return [...ids].flatMap((id) => flowerDefs(flowerById(id)));
  }, [state.blooms, activeFlower]);

  return (
    <svg
      ref={svgRef}
      className="onam-board"
      viewBox={viewBox}
      role="application"
      aria-label={ariaLabel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onPointerLeave={onPointerLeave}
    >
      <defs>{shapesToElements(defs, 'g')}</defs>
      <circle className="onam-mat-inner" r={MAT_R} />
      <circle className="onam-mat-ring" r={MAT_R} />
      {state.snap && <PolarGrid />}

      {state.sketchVisible &&
        state.sketch.map((stroke, i) => (
          <polyline
            key={i}
            className="onam-sketch-path"
            points={stroke.map((pt) => `${pt.x},${pt.y}`).join(' ')}
          />
        ))}

      {state.blooms.map((b) => {
        const flower = flowerById(b.flowerId);
        if (!flower) return null;
        const k = b.size / ART_SPAN;
        return (
          <g
            key={b.id}
            className={`onam-bloom-g${b.id === state.selectedId ? ' is-selected' : ''}${
              newIds?.has(b.id) ? ' is-new' : ''
            }`}
            transform={`translate(${b.x} ${b.y}) rotate(${b.rot}) scale(${k})`}
          >
            <Shapes flower={flower} />
          </g>
        );
      })}

      {selected && (
        <circle
          className="onam-sel-ring"
          cx={selected.x}
          cy={selected.y}
          r={selected.size / 2 + 2.5}
        />
      )}

      {ghostFlower &&
        ghosts.map((g, i) => {
          const k = activeSize / ART_SPAN;
          return (
            <g
              key={i}
              className="onam-ghost"
              transform={`translate(${g.x} ${g.y}) rotate(${g.rot}) scale(${k})`}
            >
              <Shapes flower={ghostFlower} />
            </g>
          );
        })}
    </svg>
  );
}
