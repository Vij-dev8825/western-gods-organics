/**
 * Vinayagar Chaturthi — lay the offering on the leaf.
 *
 * The second festival with a real page behind it, after the Onam pookalam.
 * Where that one is about filling rings in a fixed pattern, this one is about
 * arranging: you pick something off the tray and put it where you want it on
 * the leaf, and the only fixed thing is Vinayagar himself at the head of it.
 *
 * The target is twenty-one modakam, which is the traditional count, so there is
 * a real finish rather than an open canvas that never resolves. Everything
 * else on the tray is there because it belongs on the leaf, not because the
 * game needs it — you can offer none of it and still finish.
 *
 * Vinayagar is drawn, never placed. You do not drag a deity around a screen.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import SeoMeta from '../components/SeoMeta';
import { useToast } from '../context/ToastContext';
import { shareOrDownload } from '../components/festival/shareCard';
import { OFFERINGS, OFFERING_BY_ID, OfferingDefs, Pillaiyar } from '../components/vinayagar/offerings';
import '../styles/vinayagar.css';

/* The leaf's drawing space. Everything below is in these units. */
const VB = { w: 600, h: 430 };

/* Where an offering is allowed to land. Tracks the drawn leaf rather than the
 * board: the leaf path's curves are quadratics with a control offset of 78, so
 * they peak at half that — the leaf really only spans y 233..311, and an
 * earlier ry of 112 let offerings be dropped on the bare floor either side of
 * it. Inset a little from the true edge so nothing hangs over the rim. */
const FIELD = { cx: 300, cy: 274, rx: 234, ry: 29 };

/* Twenty-one is the count in the ritual, so it is the count here. */
const MODAKAM_TARGET = 21;

const SAVE_KEY = 'wg_vinayagar_leaf';

/** Inside the leaf? Offerings that land outside are ignored rather than
 * clamped — a dropped item sliding somewhere you didn't tap feels broken. */
function onLeaf(x, y) {
  const dx = (x - FIELD.cx) / FIELD.rx;
  const dy = (y - FIELD.cy) / FIELD.ry;
  return dx * dx + dy * dy <= 1;
}

/** A spot that is free-ish, for keyboard users and the "offer one" button.
 * Spirals outward from the middle so the leaf fills plausibly rather than
 * stacking everything on one pixel. */
function autoSpot(n) {
  const turn = n * 2.399963; // golden angle, so successive points don't line up
  const r = 26 + Math.sqrt(n) * 21;
  const x = FIELD.cx + Math.cos(turn) * Math.min(r, FIELD.rx - 26);
  // The leaf is far wider than it is deep, so the vertical spread is scaled to
  // the field rather than the radius — otherwise every auto-placed offering
  // lands on one line down the middle.
  const y = FIELD.cy + Math.sin(turn) * (FIELD.ry - 6);
  return { x, y };
}

function readSaved() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (!Array.isArray(parsed)) return [];
    // Anything whose offering no longer exists is dropped rather than crashing
    // the board on a stale save from an older build.
    return parsed
      .filter((p) => p && OFFERING_BY_ID[p.id] && Number.isFinite(p.x) && Number.isFinite(p.y))
      .slice(0, 200);
  } catch {
    return [];
  }
}

export default function Vinayagar() {
  const { showToast } = useToast();
  const svgRef = useRef(null);
  const [placed, setPlaced] = useState(readSaved);
  const [picked, setPicked] = useState('modakam');
  const [busy, setBusy] = useState(false);

  const modakamCount = useMemo(
    () => placed.filter((p) => p.id === 'modakam').length,
    [placed]
  );
  const done = modakamCount >= MODAKAM_TARGET;

  useEffect(() => {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(placed));
    } catch {
      /* A full or disabled store must not stop the game. */
    }
  }, [placed]);

  const place = useCallback((x, y) => {
    if (!onLeaf(x, y)) return;
    setPlaced((prev) => {
      if (prev.length >= 200) return prev; // a sane ceiling, never reached in play
      return [...prev, { id: picked, x: Math.round(x), y: Math.round(y), r: Math.random() * 16 - 8 }];
    });
  }, [picked]);

  /** Screen coordinates to viewBox coordinates. getScreenCTM handles the
   * letterboxing that preserveAspectRatio introduces; mapping off the bounding
   * rect instead would drift as soon as the board isn't exactly 600x430. */
  function pointerToBoard(evt) {
    const svg = svgRef.current;
    if (!svg) return null;
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    const pt = svg.createSVGPoint();
    pt.x = evt.clientX;
    pt.y = evt.clientY;
    const mapped = pt.matrixTransform(ctm.inverse());
    return { x: mapped.x, y: mapped.y };
  }

  function handleBoardPointer(evt) {
    const p = pointerToBoard(evt);
    if (p) place(p.x, p.y);
  }

  function handleBoardKey(evt) {
    if (evt.key !== 'Enter' && evt.key !== ' ') return;
    evt.preventDefault();
    const spot = autoSpot(placed.length);
    place(spot.x, spot.y);
  }

  function undo() {
    setPlaced((prev) => prev.slice(0, -1));
  }

  function clearLeaf() {
    setPlaced([]);
  }

  /** Serialises the board and paints it into a PNG. Every colour in the SVG is
   * an attribute rather than a class, precisely so the detached copy still
   * looks like the board the player made.
   *
   * The offering photographs need more than that. A serialised SVG is
   * rasterised from a blob URL, and a blob-URL document will not fetch
   * anything external — an <image href="/assets/modakam-abc.png"> inside it
   * renders as nothing at all, silently. Measured: the exported PNG came back
   * with zero non-background pixels where the image should have been. So every
   * picture is read back and inlined as a data URI before the clone is
   * serialised. They live in <defs> as symbols, so each one is inlined once
   * however many times it was laid on the leaf. */
  async function inlineImages(clone) {
    const nodes = [...clone.querySelectorAll('image')];
    const cache = new Map();
    await Promise.all(
      nodes.map(async (node) => {
        const href = node.getAttribute('href') || node.getAttribute('xlink:href');
        if (!href || href.startsWith('data:')) return;
        if (!cache.has(href)) {
          cache.set(href, (async () => {
            const res = await fetch(href);
            const blob = await res.blob();
            return new Promise((resolve, reject) => {
              const fr = new FileReader();
              fr.onload = () => resolve(fr.result);
              fr.onerror = () => reject(new Error('read failed'));
              fr.readAsDataURL(blob);
            });
          })());
        }
        const uri = await cache.get(href);
        node.setAttribute('href', uri);
        node.removeAttribute('xlink:href');
      })
    );
  }

  async function share() {
    const svg = svgRef.current;
    if (!svg || busy) return;
    setBusy(true);
    try {
      const clone = svg.cloneNode(true);
      await inlineImages(clone);
      clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
      clone.setAttribute('width', String(VB.w * 2));
      clone.setAttribute('height', String(VB.h * 2));
      const markup = new XMLSerializer().serializeToString(clone);
      const url = URL.createObjectURL(new Blob([markup], { type: 'image/svg+xml;charset=utf-8' }));

      const img = new Image();
      img.decoding = 'sync';
      const loaded = new Promise((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Could not draw the leaf.'));
      });
      img.src = url;
      await loaded;

      const canvas = document.createElement('canvas');
      canvas.width = VB.w * 2;
      canvas.height = VB.h * 2;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fdf3e7';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);

      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
      const res = await shareOrDownload(blob, 'vinayagar-chaturthi.png', 'Vinayagar Chaturthi valthukkal');
      if (!res?.ok) showToast('Could not share the picture.');
    } catch {
      showToast('Could not make the picture.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <SeoMeta
        title="Vinayagar Chaturthi — lay the offering | Western Gods Organics"
        description="Put the modakam, the arukampul and the lamp on the leaf for Vinayagar Chaturthi. Twenty-one modakam makes the offering."
        path="/vinayagar"
      />

      <div className="vin-page">
        <div className="container">
          <header className="vin-head">
            <span className="vin-eyebrow">Vinayagar Chaturthi</span>
            <h1>Lay the offering</h1>
            <p className="vin-lede">
              Clay pillaiyar on the step, arukampul beside him, and modakam on the leaf.
              Pick something off the tray and put it where you like — twenty-one modakam
              makes the offering.
            </p>
          </header>

          <div className="vin-progress" role="status" aria-live="polite">
            <div className="vin-bar">
              <span style={{ width: `${Math.min(100, (modakamCount / MODAKAM_TARGET) * 100)}%` }} />
            </div>
            <p>
              {done
                ? 'The offering is made. Vinayagar Chaturthi valthukkal.'
                : `${modakamCount} of ${MODAKAM_TARGET} modakam`}
            </p>
          </div>

          <svg
            ref={svgRef}
            className={`vin-board ${done ? 'is-done' : ''}`}
            viewBox={`0 0 ${VB.w} ${VB.h}`}
            role="button"
            tabIndex={0}
            aria-label={`The leaf. ${placed.length} offerings laid, ${modakamCount} of ${MODAKAM_TARGET} modakam. Press Enter to lay ${OFFERING_BY_ID[picked].label}.`}
            onPointerDown={handleBoardPointer}
            onKeyDown={handleBoardKey}
          >
            {/* Every gradient the offerings reference, defined once. Inside the
                board rather than the page so the clone the share export
                rasterises carries its own paint with it. */}
            <OfferingDefs />

            <rect x="0" y="0" width={VB.w} height={VB.h} fill="#fdf3e7" />

            {/* The floor the leaf is set down on. */}
            <ellipse cx="300" cy="290" rx="270" ry="128" fill="url(#vinFloor)" />
            <ellipse cx="300" cy="286" rx="258" ry="116" fill="#2a1a12" opacity="0.07" />

            {/* Banana leaf. The blade, then the ribs laid over it through a
                clip so they stop at the edge, then the midrib on top — which
                is the order you'd actually see them. */}
            <clipPath id="vinLeafClip">
              <path d="M 46 272 q 254 -78 508 0 q -254 78 -508 0 z" />
            </clipPath>
            <path
              d="M 46 272 q 254 -78 508 0 q -254 78 -508 0 z"
              fill="url(#vinServingLeaf)"
              stroke="#3f7a25"
              strokeWidth="1.6"
            />
            <g clipPath="url(#vinLeafClip)">
              <rect x="40" y="190" width="524" height="164" fill="url(#vinRibs)" />
              {/* Darker towards the two tips, the way a leaf shades away from
                  the light running down its spine. */}
              <ellipse cx="300" cy="272" rx="260" ry="44" fill="#2f5f21" opacity="0.18" />
              <ellipse cx="300" cy="272" rx="170" ry="40" fill="#b7e07a" opacity="0.2" />
              {/* Waxy sheen along the upper blade. */}
              <path d="M 120 256 q 180 -30 360 0 q -180 14 -360 0 z" fill="#e8f7c8" opacity="0.22" />
            </g>
            {/* Midrib: pale yellow-green, the brightest line on the leaf. */}
            <path d="M 52 272 q 248 -14 496 0" stroke="#5f9130" strokeWidth="3.4" fill="none" opacity="0.55" />
            <path d="M 52 272 q 248 -14 496 0" stroke="#e4f0a8" strokeWidth="1.8" fill="none" />

            <g transform="translate(300 168)">
              <Pillaiyar lit={done} />
            </g>

            {placed.map((p, i) => {
              const { Art } = OFFERING_BY_ID[p.id];
              return (
                <g
                  key={i}
                  className="vin-placed"
                  style={{ '--i': Math.min(i, 24) }}
                  transform={`translate(${p.x} ${p.y}) rotate(${p.r || 0})`}
                >
                  <Art />
                </g>
              );
            })}

            {placed.length === 0 && (
              <text
                x="300"
                y="278"
                textAnchor="middle"
                fill="rgba(42,26,18,0.45)"
                style={{ font: '600 13px var(--font-body, sans-serif)', letterSpacing: '0.18em' }}
              >
                TAP THE LEAF TO LAY IT
              </text>
            )}
          </svg>

          <div className="vin-tray" role="group" aria-label="Things to offer">
            {OFFERINGS.map((o) => {
              const { Art } = o;
              const count = placed.filter((p) => p.id === o.id).length;
              return (
                <button
                  key={o.id}
                  type="button"
                  className={`vin-chip ${picked === o.id ? 'is-picked' : ''}`}
                  aria-pressed={picked === o.id}
                  onClick={() => setPicked(o.id)}
                  title={o.note}
                >
                  {/* The art is drawn upward from its own baseline, so the box
                      reaches further above the origin than below it. The <use>
                      inside resolves against the board's <defs>, which is why
                      the board must be on the page for the tray to draw. */}
                  <svg viewBox="-20 -38 40 42" aria-hidden="true">
                    <Art />
                  </svg>
                  <span className="vin-chip-label">{o.label}</span>
                  <span className="vin-chip-tamil">{o.tamil}</span>
                  {count > 0 && <span className="vin-chip-count">{count}</span>}
                </button>
              );
            })}
          </div>

          <p className="vin-note">{OFFERING_BY_ID[picked].note}</p>

          <div className="vin-actions">
            <button type="button" className="btn btn-outline btn-sm" onClick={undo} disabled={!placed.length}>
              Undo
            </button>
            <button type="button" className="btn btn-outline btn-sm" onClick={clearLeaf} disabled={!placed.length}>
              Clear the leaf
            </button>
            <button type="button" className="btn btn-gold btn-sm" onClick={share} disabled={busy || !placed.length}>
              {busy ? 'Making the picture…' : 'Share the leaf'}
            </button>
          </div>

          {done && (
            <div className="vin-done">
              <p className="vin-greeting">Vinayagar Chaturthi valthukkal</p>
              <p className="muted">
                Modakam is steamed with jaggery, coconut and a spoon of sesame oil — the
                same cold-pressed oil that goes on the lamp beside it.
              </p>
              <Link to="/shop?category=oils" className="btn btn-forest btn-sm">
                See the oils
              </Link>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
