/**
 * One interactive motif per festival.
 *
 * The idea that made the pookalam page work is the one repeated here: the
 * gesture on screen should be the gesture people actually perform. You lay
 * petals for Onam because that is what a pookalam is. So Deepavali lights
 * lamps, Pongal boils a pot over — the overflow IS the auspicious moment, which
 * is why the goal is to make something spill rather than to stop it — and Holi
 * throws colour at a clean wall. A generic "tap five times" widget in festival
 * colours would have been a quarter of the code and none of the point.
 *
 * All five share one contract, so the band that hosts them needs no special
 * cases and a new festival is a registry entry plus one component:
 *
 *   steps    how many taps complete it
 *   filled   how many are done — owned by the host, so progress survives a
 *            remount and can be persisted
 *   onStep   report a tap; the host decides whether it counts
 *   theme    the palette, so a motif can be reused in another festival's
 *            colours (Karthigai borrows Deepavali's lamps)
 *
 * Motifs may keep presentational state of their own — Holi has to remember
 * where each throw landed — but never the count. Nothing here animates except
 * through CSS classes, so the reduced-motion block in festival.css can switch
 * all of it off in one place.
 */
import { useCallback, useRef, useState } from 'react';

/* Deterministic jitter, so a motif looks hand-made but never re-rolls on a
   re-render and never disagrees between two renders of the same step. */
function rnd(i) {
  let x = Math.imul(i ^ 0x9e3779b9, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}
const wob = (i) => rnd(i) * 2 - 1;

/* ==========================================================================
 * Deepavali / Karthigai — light the row of lamps
 * ======================================================================== */

const LAMP_COUNT = 7;

export function Diyas({ steps = LAMP_COUNT, filled = 0, onStep, theme }) {
  const { accent, accentDeep, glow } = theme.palette;
  const lamps = Array.from({ length: steps }, (_, i) => i);

  return (
    <svg
      viewBox="0 0 340 150"
      className="fest-art"
      role="group"
      aria-label={`${steps} lamps, ${filled} lit`}
    >
      {/* The porch darkens or brightens with how many are lit. */}
      <defs>
        <radialGradient id="fest-diya-glow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor={glow} stopOpacity="0.85" />
          <stop offset="0.55" stopColor={glow} stopOpacity="0.28" />
          <stop offset="1" stopColor={glow} stopOpacity="0" />
        </radialGradient>
      </defs>

      {lamps.map((i) => {
        const lit = i < filled;
        const x = 26 + i * ((340 - 52) / (steps - 1));
        const y = 104 + wob(i * 3) * 3;
        return (
          <g key={i}>
            {lit && <circle cx={x} cy={y - 16} r="34" fill="url(#fest-diya-glow)" />}
            {/* The clay lamp: a shallow bowl with a pinched lip. */}
            <path
              d={`M ${x - 15} ${y} q 15 13 30 0 q -4 9 -15 9 q -11 0 -15 -9 z`}
              fill={lit ? '#8a4a22' : '#5d3a24'}
              stroke="rgba(0,0,0,0.3)"
              strokeWidth="0.8"
            />
            <ellipse cx={x} cy={y} rx="15" ry="4.2" fill={lit ? '#a75c2a' : '#6d4529'} />
            {/* Oil, and the wick lying in it. */}
            <ellipse cx={x} cy={y} rx="11" ry="2.6" fill={lit ? '#e8c169' : '#4a3220'} />
            <path
              d={`M ${x + 9} ${y - 1} l 6 -3`}
              stroke={lit ? '#f6e2a8' : '#3c2a1c'}
              strokeWidth="2"
              strokeLinecap="round"
            />
            {lit && (
              <g className="fest-flame" style={{ '--i': i }}>
                <path
                  d={`M ${x + 12} ${y - 4} c -4 -8 0 -14 0 -18 c 3 5 7 8 5 14 c -1 3 -3 4 -5 4 z`}
                  fill={accent}
                />
                <path
                  d={`M ${x + 12} ${y - 6} c -2 -5 0 -9 0 -11 c 2 3 4 5 3 9 c -1 2 -2 2 -3 2 z`}
                  fill="#fff6dc"
                />
              </g>
            )}
            {/* The tap target is a generous invisible rect, not the lamp path —
                a 30px bowl is not a comfortable thing to hit on a phone. */}
            {!lit && (
              <rect
                x={x - 24}
                y={y - 34}
                width="48"
                height="52"
                fill="transparent"
                className="fest-hit"
                onPointerDown={() => onStep?.(i)}
                role="button"
                tabIndex={0}
                aria-label={`Light lamp ${i + 1}`}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onStep?.(i);
                  }
                }}
              />
            )}
          </g>
        );
      })}

      {/* A rangoli line under the lamps, brightening as the porch fills. */}
      <path
        d="M 14 128 q 156 16 312 0"
        fill="none"
        stroke={accentDeep}
        strokeWidth="1.4"
        strokeOpacity={0.2 + (filled / steps) * 0.55}
        strokeDasharray="5 6"
      />
    </svg>
  );
}

/* ==========================================================================
 * Karthigai Deepam — light the hill, then the Maha Deepam
 *
 * Deepavali's lamps sit on a doorstep; Karthigai's climb Annamalai and end in
 * the great beacon on the summit, which is the image of the festival. Sharing
 * the Diyas motif would have been cheaper and would have thrown away the one
 * thing that makes the night look like itself. The last tap is the beacon, so
 * the sequence has a summit in both senses.
 * ======================================================================== */

/* Up the ridge, roughly following the silhouette below. */
const HILL_LAMPS = [
  { x: 52, y: 128 },
  { x: 86, y: 116 },
  { x: 116, y: 103 },
  { x: 142, y: 88 },
  { x: 160, y: 72 },
  { x: 172, y: 58 },
];

export function KarthigaiHill({ steps = HILL_LAMPS.length + 1, filled = 0, onStep, theme }) {
  const { accent, accentDeep, glow } = theme.palette;
  const beaconLit = filled >= steps;

  return (
    <svg
      viewBox="0 0 340 150"
      className="fest-art"
      role="button"
      tabIndex={0}
      aria-label={
        beaconLit
          ? 'The Maha Deepam is lit'
          : `${filled} of ${steps} lamps lit on the hill`
      }
      onPointerDown={filled < steps ? () => onStep?.(filled) : undefined}
      onKeyDown={(e) => {
        if (filled < steps && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onStep?.(filled);
        }
      }}
    >
      <defs>
        <radialGradient id="fest-beacon-glow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor={glow} stopOpacity="0.95" />
          <stop offset="0.4" stopColor={glow} stopOpacity="0.4" />
          <stop offset="1" stopColor={glow} stopOpacity="0" />
        </radialGradient>
        <radialGradient id="fest-hill-glow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor={glow} stopOpacity="0.7" />
          <stop offset="1" stopColor={glow} stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* A few stars, fixed so they never re-scatter on a re-render. */}
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <circle
          key={i}
          cx={224 + rnd(i * 9) * 106}
          cy={12 + rnd(i * 13) * 52}
          r={0.8 + rnd(i * 17) * 0.9}
          fill={glow}
          fillOpacity={0.45 + rnd(i * 21) * 0.4}
        />
      ))}

      {/* The beacon's glow spills over the whole summit once lit. */}
      {beaconLit && <circle cx="186" cy="34" r="66" fill="url(#fest-beacon-glow)" />}

      {/* Annamalai. Two overlapping ridges so it reads as a hill, not a cone. */}
      <path d="M 0 150 L 96 92 L 150 116 L 214 60 L 268 96 L 340 150 z" fill="#3a2f3f" />
      <path
        d="M 0 150 L 74 108 L 128 128 L 186 30 L 246 104 L 300 128 L 340 150 z"
        fill="#2a2130"
      />

      {HILL_LAMPS.map((lamp, i) => {
        const lit = i < filled;
        return (
          <g key={i}>
            {lit && <circle cx={lamp.x} cy={lamp.y - 4} r="15" fill="url(#fest-hill-glow)" />}
            <path
              d={`M ${lamp.x - 6} ${lamp.y} q 6 5 12 0 q -2 4 -6 4 q -4 0 -6 -4 z`}
              fill={lit ? '#8a4a22' : '#4a3a44'}
            />
            {lit && (
              <g className="fest-flame" style={{ '--i': i }}>
                <path
                  d={`M ${lamp.x} ${lamp.y - 2} c -2 -4 0 -7 0 -9 c 2 3 3 5 2 7 c 0 1 -1 2 -2 2 z`}
                  fill={accent}
                />
              </g>
            )}
          </g>
        );
      })}

      {/* The Maha Deepam: a cauldron on the summit, dark until the last tap. */}
      <path
        d="M 172 34 q 14 12 28 0 q -3 10 -14 10 q -11 0 -14 -10 z"
        fill={beaconLit ? '#9c5427' : '#463650'}
        stroke="rgba(0,0,0,0.35)"
        strokeWidth="0.8"
      />
      <ellipse cx="186" cy="34" rx="14" ry="4" fill={beaconLit ? '#b9682f' : '#52405e'} />
      {beaconLit && (
        <g className="fest-flame" style={{ '--i': 0 }}>
          <path
            d="M 186 32 c -8 -14 2 -22 0 -30 c 7 10 13 15 9 24 c -2 5 -6 6 -9 6 z"
            fill={accent}
          />
          <path
            d="M 186 28 c -4 -8 1 -13 0 -18 c 4 6 7 9 5 14 c -1 3 -3 4 -5 4 z"
            fill="#fff3d0"
          />
        </g>
      )}

      {!beaconLit && filled >= HILL_LAMPS.length && (
        <text
          x="186"
          y="14"
          textAnchor="middle"
          fill={glow}
          style={{ font: '700 9px var(--font-body, sans-serif)', letterSpacing: '0.16em' }}
        >
          THE MAHA DEEPAM
        </text>
      )}
      {filled === 0 && (
        <text
          x="256"
          y="138"
          textAnchor="middle"
          fill={accentDeep}
          style={{ font: '600 10px var(--font-body, sans-serif)', letterSpacing: '0.16em' }}
        >
          TAP TO LIGHT THE HILL
        </text>
      )}
    </svg>
  );
}

/* ==========================================================================
 * Pongal — feed the fire until the pot boils over
 * ======================================================================== */

export function PongalPot({ steps = 6, filled = 0, onStep, theme }) {
  const { accent, accentDeep } = theme.palette;
  const t = filled / steps;
  const boiling = filled >= steps;
  /* Milk climbs from low in the pot to just over the rim. */
  const milkY = 74 - t * 26;

  return (
    <svg
      viewBox="0 0 340 150"
      className="fest-art"
      role="group"
      aria-label={boiling ? 'The pot has boiled over' : `Fire fed ${filled} of ${steps} times`}
    >
      {/* Sugarcane, tied either side of the pot as it is on the day. */}
      {[36, 304].map((x, i) => (
        <g key={x}>
          <path
            d={`M ${x} 138 q ${i ? 10 : -10} -50 ${i ? 4 : -4} -96`}
            stroke="#5b8a3c"
            strokeWidth="4"
            fill="none"
            strokeLinecap="round"
          />
          {[0, 1, 2].map((k) => (
            <path
              key={k}
              d={`M ${x + (i ? 6 : -6) - (i ? 0 : 0)} ${64 - k * 20} q ${i ? 26 : -26} -8 ${i ? 34 : -34} -22`}
              stroke="#6ea04a"
              strokeWidth="3"
              fill="none"
              strokeLinecap="round"
            />
          ))}
        </g>
      ))}

      {/* Three hearth stones. */}
      {[128, 170, 212].map((x) => (
        <ellipse key={x} cx={x} cy={132} rx="16" ry="7" fill="#6b6259" />
      ))}

      {/* The fire, taller with every tap. */}
      <g className="fest-fire">
        {[0, 1, 2].map((k) => {
          const h = 12 + t * 26 + k * 3;
          const x = 152 + k * 18;
          return (
            <path
              key={k}
              d={`M ${x} 128 c -7 -${h * 0.5} 3 -${h * 0.7} 1 -${h} c 6 ${h * 0.35} 11 ${h * 0.55} 7 ${h * 0.85} c -2 ${h * 0.15} -6 ${h * 0.15} -8 ${h * 0.15} z`}
              fill={k === 1 ? '#ffd166' : accent}
              opacity={0.75 + k * 0.08}
              style={{ '--i': k }}
            />
          );
        })}
      </g>

      {/* The pot. Drawn after the fire so it sits in front of it. */}
      <path
        d="M 116 66 q 0 56 54 56 q 54 0 54 -56 q 0 -12 -12 -16 l -84 0 q -12 4 -12 16 z"
        fill="#a9552c"
        stroke="#7c3c1d"
        strokeWidth="1.6"
      />
      {/* Milk, clipped to the pot's inside. */}
      <clipPath id="fest-pot-clip">
        <path d="M 120 60 q 0 52 50 52 q 50 0 50 -52 z" />
      </clipPath>
      <g clipPath="url(#fest-pot-clip)">
        <rect x="118" y={milkY} width="104" height="60" fill="#fdf6e4" />
        <ellipse cx="170" cy={milkY} rx="52" ry="5" fill="#fffdf6" />
      </g>
      {/* The rim, over the milk. */}
      <ellipse cx="170" cy="52" rx="56" ry="12" fill="none" stroke="#7c3c1d" strokeWidth="2.4" />
      <ellipse cx="170" cy="52" rx="56" ry="12" fill="#c46536" fillOpacity="0.25" />
      {/* A turmeric knot tied round the neck. */}
      <path d="M 128 44 q 42 -12 84 0" stroke={accentDeep} strokeWidth="3" fill="none" />

      {/* The overflow: what everybody is waiting for. */}
      {boiling && (
        <g className="fest-boil">
          <path
            d="M 126 50 q -8 22 -2 40 q 8 -18 10 -38 z"
            fill="#fffdf6"
            stroke="#efe4c8"
            strokeWidth="0.8"
          />
          <path
            d="M 214 50 q 8 22 2 40 q -8 -18 -10 -38 z"
            fill="#fffdf6"
            stroke="#efe4c8"
            strokeWidth="0.8"
          />
          {[0, 1, 2, 3, 4].map((k) => (
            <circle
              key={k}
              cx={148 + k * 12 + wob(k * 7) * 3}
              cy={40 - k * 2}
              r={2.6 + rnd(k * 5) * 1.6}
              fill="#fffdf6"
              className="fest-bubble"
              style={{ '--i': k }}
            />
          ))}
        </g>
      )}

      {!boiling && (
        <rect
          x="112"
          y="96"
          width="116"
          height="48"
          fill="transparent"
          className="fest-hit"
          onPointerDown={() => onStep?.(filled)}
          role="button"
          tabIndex={0}
          aria-label="Fan the fire"
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onStep?.(filled);
            }
          }}
        />
      )}
    </svg>
  );
}

/* ==========================================================================
 * Holi — throw colour at a clean wall
 * ======================================================================== */

const GULAL = ['#e5326b', '#f5a524', '#3aa66f', '#3d6fd6', '#8a4bc4', '#ec5f2a'];

export function Gulal({ steps = 8, filled = 0, onStep, theme }) {
  /* Where a throw landed is presentation, so the motif keeps it — but it cannot
     be the ONLY record, or a wall restored from a saved count comes back blank:
     the host remembers "8 thrown", this component remembers nothing across a
     remount, and the visitor sees a clean wall labelled finished. So any
     `filled` the host reports beyond what was actually clicked here is filled in
     from a deterministic scatter. Clicked positions win; the rest are invented
     but stable. */
  const [thrown, setThrown] = useState([]);
  const svgRef = useRef(null);

  const splats = [...thrown];
  for (let i = thrown.length; i < filled; i += 1) {
    splats.push({ x: 34 + rnd(i * 11 + 3) * 272, y: 24 + rnd(i * 17 + 7) * 102, i });
  }

  const throwColour = useCallback(
    (evt) => {
      const svg = svgRef.current;
      if (!svg) return;
      const ctm = svg.getScreenCTM();
      if (!ctm) return;
      const pt = svg.createSVGPoint();
      pt.x = evt.clientX;
      pt.y = evt.clientY;
      const p = pt.matrixTransform(ctm.inverse());
      setThrown((prev) => [...prev, { x: p.x, y: p.y, i: prev.length }]);
      onStep?.(filled, { x: p.x, y: p.y });
    },
    [filled, onStep]
  );

  return (
    <svg
      ref={svgRef}
      viewBox="0 0 340 150"
      className="fest-art fest-art-wall"
      role="button"
      tabIndex={0}
      aria-label={`Throw colour. ${filled} of ${steps} thrown.`}
      onPointerDown={filled < steps ? throwColour : undefined}
      onKeyDown={(e) => {
        if (filled < steps && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          /* Keyboard players get a scattered position rather than nothing. */
          const i = splats.length;
          const x = 40 + rnd(i * 11) * 260;
          const y = 26 + rnd(i * 17) * 96;
          setThrown((prev) => [...prev, { x, y, i }]);
          onStep?.(filled, { x, y });
        }
      }}
    >
      <rect x="0" y="0" width="340" height="150" rx="14" fill={theme.palette.paper2} />

      {splats.map(({ x, y, i }) => {
        const colour = GULAL[i % GULAL.length];
        const r = 22 + rnd(i * 3) * 12;
        return (
          <g key={i} className="fest-splat" style={{ '--i': i % 6 }}>
            {/* An irregular blob: a circle would read as a sticker. */}
            <path
              d={`M ${x} ${y - r}
                  c ${r * 0.7} ${wob(i) * 6} ${r} ${r * 0.5} ${r * 0.55} ${r * 0.8}
                  c ${wob(i + 1) * 8} ${r * 0.5} ${-r * 0.5} ${r * 0.4} ${-r * 0.55} ${r * 0.2}
                  c ${-r * 0.6} ${wob(i + 2) * 8} ${-r} ${-r * 0.4} ${-r * 0.6} ${-r * 0.7}
                  c ${wob(i + 3) * 7} ${-r * 0.5} ${r * 0.3} ${-r * 0.6} ${r * 0.6} ${-r * 0.3} z`}
              fill={colour}
              fillOpacity="0.9"
            />
            {/* Satellite specks, the way powder actually scatters. */}
            {[0, 1, 2, 3, 4].map((k) => (
              <circle
                key={k}
                cx={x + wob(i * 10 + k) * (r + 16)}
                cy={y + wob(i * 20 + k) * (r + 12)}
                r={1.4 + rnd(i * 30 + k) * 2.6}
                fill={colour}
                fillOpacity="0.75"
              />
            ))}
          </g>
        );
      })}

      {filled === 0 && (
        <text
          x="170"
          y="80"
          textAnchor="middle"
          fill="rgba(24,56,44,0.4)"
          style={{ font: '600 13px var(--font-body, sans-serif)', letterSpacing: '0.18em' }}
        >
          TAP TO THROW COLOUR
        </text>
      )}
    </svg>
  );
}

/* ==========================================================================
 * Onam — lay the flower carpet, ring by ring
 *
 * A compact cousin of the full game at /onam: five taps rather than two hundred
 * flowers, because this one lives on a home page between a hero and a product
 * grid and has about ten seconds of somebody's attention.
 * ======================================================================== */

const RINGS = [
  { r: 62, n: 24 },
  { r: 49, n: 18 },
  { r: 36, n: 12 },
  { r: 23, n: 12 },
  { r: 11, n: 6 },
];

const PETAL_COLOURS = ['#f2a20c', '#d8324b', '#5b4b9e', '#f6d423', '#e4571b'];

export function PookalamRings({ steps = RINGS.length, filled = 0, onStep, theme }) {
  return (
    <svg
      viewBox="-75 -75 150 150"
      className="fest-art fest-art-round"
      role="button"
      tabIndex={0}
      aria-label={`Pookalam, ${filled} of ${steps} rings laid`}
      onPointerDown={filled < steps ? () => onStep?.(filled) : undefined}
      onKeyDown={(e) => {
        if (filled < steps && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onStep?.(filled);
        }
      }}
    >
      <circle r="70" fill={theme.palette.paper2} />
      <circle r="70" fill="none" stroke={theme.palette.accent} strokeWidth="0.8" strokeOpacity="0.5" />

      {RINGS.map((ring, ri) => {
        /* Rings fill from the outside in, the way one is really laid. */
        const laid = ri < filled;
        if (!laid) return null;
        const colour = PETAL_COLOURS[ri % PETAL_COLOURS.length];
        const step = 360 / ring.n;
        return (
          <g key={ri} className="fest-ring" style={{ '--i': ri }}>
            {Array.from({ length: ring.n }, (_, k) => {
              const a = (k * step - 90) * (Math.PI / 180);
              const rr = ring.r * (1 + wob(ri * 31 + k) * 0.02);
              return (
                <ellipse
                  key={k}
                  cx={Math.cos(a) * rr}
                  cy={Math.sin(a) * rr}
                  rx={ring.r * 0.13}
                  ry={ring.r * 0.2}
                  fill={colour}
                  transform={`rotate(${k * step} ${Math.cos(a) * rr} ${Math.sin(a) * rr})`}
                  stroke="rgba(24,56,44,0.14)"
                  strokeWidth="0.4"
                />
              );
            })}
          </g>
        );
      })}

      {filled >= steps && <circle r="7" fill={theme.palette.accent} />}
      {filled === 0 && (
        <text
          y="4"
          textAnchor="middle"
          fill="rgba(24,56,44,0.42)"
          style={{ font: '600 8px var(--font-body, sans-serif)', letterSpacing: '0.16em' }}
        >
          TAP TO LAY
        </text>
      )}
    </svg>
  );
}

/* ==========================================================================
 * Vinayagar Chaturthi — lay the modakam on the leaf
 *
 * The offering rather than the idol. Making a clay pillaiyar does not reduce to
 * a tap, but placing modakam on a banana leaf does, and for a mill that sells
 * the coconut and the gingelly oil the sweet is made with it is the more
 * relevant half of the day anyway. Five, not the traditional twenty-one — the
 * count is a gesture here, not a vow.
 * ======================================================================== */

export function Modakam({ steps = 5, filled = 0, onStep, theme }) {
  const { accent, accentDeep, glow } = theme.palette;

  /* Laid out along the leaf, front row first so the pile builds towards you. */
  const spots = [
    { x: 170, y: 96, s: 1 },
    { x: 134, y: 92, s: 0.94 },
    { x: 206, y: 92, s: 0.94 },
    { x: 152, y: 74, s: 0.86 },
    { x: 188, y: 74, s: 0.86 },
  ];

  return (
    <svg
      viewBox="0 0 340 150"
      className="fest-art"
      role="button"
      tabIndex={0}
      aria-label={`${filled} of ${steps} modakam offered`}
      onPointerDown={filled < steps ? () => onStep?.(filled) : undefined}
      onKeyDown={(e) => {
        if (filled < steps && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onStep?.(filled);
        }
      }}
    >
      {/* The banana leaf everything is served on. */}
      <path
        d="M 44 104 q 126 -34 252 0 q -126 34 -252 0 z"
        fill="#4f8a3a"
        stroke="#3b6b29"
        strokeWidth="1.4"
      />
      <path d="M 46 104 q 126 -8 248 0" stroke="#7cb057" strokeWidth="1.6" fill="none" />

      {/* Vinayagar, suggested rather than drawn — a silhouette reads as
          reverent where a cartoon face would not. */}
      <g opacity="0.96">
        <ellipse cx="170" cy="30" rx="15" ry="13" fill="#b8632f" />
        {/* ears */}
        <ellipse cx="152" cy="31" rx="7" ry="10" fill="#a4552a" />
        <ellipse cx="188" cy="31" rx="7" ry="10" fill="#a4552a" />
        {/* trunk, curling to its left */}
        <path
          d="M 170 36 q 2 12 -7 15 q -7 2 -7 -5"
          stroke="#a4552a"
          strokeWidth="5"
          fill="none"
          strokeLinecap="round"
        />
        {/* body */}
        <path d="M 154 44 q 16 12 32 0 q 4 12 -16 14 q -20 -2 -16 -14 z" fill="#b8632f" />
        {/* crown and a tilak */}
        <path d="M 162 19 l 8 -11 l 8 11 z" fill={glow} />
        <path d="M 170 24 l 0 6" stroke={accentDeep} strokeWidth="1.6" strokeLinecap="round" />
      </g>

      {/* Arukampul — the grass offered alongside. */}
      {[74, 262].map((x, i) => (
        <g key={x}>
          {[0, 1, 2].map((k) => (
            <path
              key={k}
              d={`M ${x} 100 q ${(i ? 1 : -1) * (5 + k * 4)} -12 ${(i ? 1 : -1) * (3 + k * 7)} -22`}
              stroke="#5f9a3f"
              strokeWidth="1.8"
              fill="none"
              strokeLinecap="round"
            />
          ))}
        </g>
      ))}

      {spots.slice(0, filled).map((sp, i) => {
        const w = 15 * sp.s;
        const h = 19 * sp.s;
        return (
          <g key={i} className="fest-ring" style={{ '--i': i }}>
            {/* The dumpling: a pleated cone, wide at the base. */}
            <path
              d={`M ${sp.x} ${sp.y - h}
                  c ${w * 0.5} ${h * 0.35} ${w} ${h * 0.6} ${w} ${h}
                  l ${-w * 2} 0
                  c 0 ${-h * 0.4} ${w * 0.5} ${-h * 0.65} ${w} ${-h} z`}
              fill="#f6ead1"
              stroke="#d9c49a"
              strokeWidth="0.9"
            />
            {/* Pleats, converging at the tip. */}
            {[-0.55, -0.18, 0.18, 0.55].map((f) => (
              <path
                key={f}
                d={`M ${sp.x} ${sp.y - h} L ${sp.x + w * f} ${sp.y}`}
                stroke="#ddc9a3"
                strokeWidth="0.7"
                fill="none"
              />
            ))}
            {/* A dab of ghee catching the light on top. */}
            <circle cx={sp.x} cy={sp.y - h + 1.5} r={1.8 * sp.s} fill={accent} />
          </g>
        );
      })}

      {filled === 0 && (
        <text
          x="170"
          y="130"
          textAnchor="middle"
          fill="rgba(42,26,18,0.45)"
          style={{ font: '600 11px var(--font-body, sans-serif)', letterSpacing: '0.18em' }}
        >
          TAP TO OFFER MODAKAM
        </text>
      )}
    </svg>
  );
}

/* ==========================================================================
 * Raksha Bandhan — tie the thread
 * ======================================================================== */

export function Rakhi({ steps = 5, filled = 0, onStep, theme }) {
  const { accent, accentDeep, glow } = theme.palette;
  const tied = filled >= steps;
  /* Each tap is another turn of thread round the wrist. */
  const turns = Math.min(filled, steps - 1);

  return (
    <svg
      viewBox="0 0 340 150"
      className="fest-art"
      role="button"
      tabIndex={0}
      aria-label={tied ? 'The rakhi is tied' : `${filled} of ${steps} turns wound`}
      onPointerDown={filled < steps ? () => onStep?.(filled) : undefined}
      onKeyDown={(e) => {
        if (filled < steps && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onStep?.(filled);
        }
      }}
    >
      {/* A wrist seen straight on, not a foreshortened arm with fingers. The
          first attempt drew the arm in perspective and came out as a lumpy
          drumstick — anatomy at 340x150 is a losing fight, and a plain wrist
          band reads instantly as the thing you tie a rakhi to. */}
      <path
        d="M 138 22 q 30 0 30 22 l 0 64 q 0 22 -30 22 q -30 0 -30 -22 l 0 -64 q 0 -22 30 -22 z"
        fill="#dcac7c"
        stroke="#b3854f"
        strokeWidth="1.6"
      />
      {/* A crease at the wrist, so it is clearly a wrist and not a post. */}
      <path d="M 112 62 q 26 7 52 0" stroke="#c1926a" strokeWidth="1.4" fill="none" />

      {/* The thread, one turn per tap, wrapping across. */}
      {Array.from({ length: turns }, (_, i) => (
        <path
          key={i}
          className="fest-ring"
          style={{ '--i': i }}
          d={`M 108 ${72 + i * 7} q 30 ${6 - i} 60 0`}
          stroke={i % 2 ? accentDeep : accent}
          strokeWidth="5"
          fill="none"
          strokeLinecap="round"
        />
      ))}

      {/* The rosette, on the last tap. */}
      {tied && (
        <g className="fest-ring" style={{ '--i': 0 }}>
          {Array.from({ length: 8 }, (_, k) => {
            const a = (k * 45 - 90) * (Math.PI / 180);
            const cx = 138 + Math.cos(a) * 12;
            const cy = 84 + Math.sin(a) * 12;
            return (
              <ellipse
                key={k}
                cx={cx}
                cy={cy}
                rx="7"
                ry="11"
                fill={accent}
                transform={`rotate(${k * 45 + 90} ${cx} ${cy})`}
                opacity="0.95"
              />
            );
          })}
          <circle cx="138" cy="84" r="9" fill={accentDeep} />
          <circle cx="138" cy="84" r="4.5" fill={glow} />
          {/* Tails hanging off the side. */}
          <path d="M 168 88 q 22 10 34 26" stroke={accent} strokeWidth="3.4" fill="none" strokeLinecap="round" />
          <path d="M 168 96 q 26 6 40 16" stroke={accentDeep} strokeWidth="3.4" fill="none" strokeLinecap="round" />
        </g>
      )}

      {filled === 0 && (
        <text
          x="238"
          y="60"
          textAnchor="middle"
          fill="rgba(42,26,18,0.5)"
          style={{ font: '600 11px var(--font-body, sans-serif)', letterSpacing: '0.16em' }}
        >
          TAP TO TIE
        </text>
      )}
    </svg>
  );
}

/* ==========================================================================
 * Navratri / Golu — set the dolls on the steps
 * ======================================================================== */

export function GoluSteps({ steps = 5, filled = 0, onStep, theme }) {
  const { accent, accentDeep, glow } = theme.palette;
  /* Odd number of tiers, as the arrangement always is. */
  const tiers = [0, 1, 2, 3, 4];

  return (
    <svg
      viewBox="0 0 340 150"
      className="fest-art"
      role="button"
      tabIndex={0}
      aria-label={`${filled} of ${steps} tiers filled`}
      onPointerDown={filled < steps ? () => onStep?.(filled) : undefined}
      onKeyDown={(e) => {
        if (filled < steps && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onStep?.(filled);
        }
      }}
    >
      {/* The padi: five tiers, widest at the bottom, draped in cloth. */}
      {tiers.map((i) => {
        const w = 300 - i * 44;
        const x = (340 - w) / 2;
        const y = 128 - i * 21;
        return (
          <g key={i}>
            <rect x={x} y={y} width={w} height="21" fill={i % 2 ? '#8d3450' : '#a03c5c'} />
            <rect x={x} y={y} width={w} height="4" fill={glow} fillOpacity="0.5" />
          </g>
        );
      })}

      {/* One doll per tier, bottom tier first. */}
      {tiers.map((i) => {
        if (i >= filled) return null;
        const w = 300 - i * 44;
        const x = (340 - w) / 2;
        const y = 128 - i * 21;
        /* Two or three dolls on the wide lower tiers, one at the top. */
        const count = Math.max(1, 3 - Math.floor(i / 2));
        return (
          <g key={i} className="fest-ring" style={{ '--i': i }}>
            {Array.from({ length: count }, (_, k) => {
              const cx = x + (w / (count + 1)) * (k + 1);
              const cy = y - 2;
              const tone = k % 2 ? accent : accentDeep;
              return (
                <g key={k}>
                  {/* A doll, suggested: skirt, torso, head. */}
                  <path d={`M ${cx - 7} ${cy} q 7 -12 14 0 z`} fill={tone} />
                  <rect x={cx - 3} y={cy - 16} width="6" height="8" rx="2" fill={tone} />
                  <circle cx={cx} cy={cy - 19} r="4" fill="#e8c9a0" />
                  <path
                    d={`M ${cx - 4} ${cy - 21} q 4 -4 8 0`}
                    stroke="#3a2a1c"
                    strokeWidth="2"
                    fill="none"
                  />
                </g>
              );
            })}
          </g>
        );
      })}

      {filled === 0 && (
        <text
          x="170"
          y="20"
          textAnchor="middle"
          fill="rgba(42,26,18,0.5)"
          style={{ font: '600 11px var(--font-body, sans-serif)', letterSpacing: '0.16em' }}
        >
          {/* Taken from the theme rather than fixed, because these steps now
              serve Ayudha Puja as well as the golu, and a caption telling you
              to set the golu while the band asks you to garland the tools is
              two instructions for one gesture. */}
          {(theme.action || 'Tap to set a tier').toUpperCase()}
        </text>
      )}
    </svg>
  );
}

/* ==========================================================================
 * Eid — watch for the crescent
 *
 * Eid begins when the new moon is actually sighted, so the gesture is looking
 * rather than making: each tap clears cloud until the crescent is out.
 * ======================================================================== */

export function Crescent({ steps = 5, filled = 0, onStep, theme }) {
  const { accent, glow } = theme.palette;
  const clear = filled >= steps;

  return (
    <svg
      viewBox="0 0 340 150"
      className="fest-art"
      role="button"
      tabIndex={0}
      aria-label={clear ? 'The crescent is sighted' : `${filled} of ${steps} clouds cleared`}
      onPointerDown={filled < steps ? () => onStep?.(filled) : undefined}
      onKeyDown={(e) => {
        if (filled < steps && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onStep?.(filled);
        }
      }}
    >
      <defs>
        <radialGradient id="fest-moon-glow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor={glow} stopOpacity="0.8" />
          <stop offset="1" stopColor={glow} stopOpacity="0" />
        </radialGradient>
      </defs>

      {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
        <circle
          key={i}
          cx={20 + rnd(i * 7) * 300}
          cy={12 + rnd(i * 11) * 60}
          r={0.9 + rnd(i * 13) * 1}
          fill={glow}
          fillOpacity={clear ? 0.75 : 0.3}
        />
      ))}

      {clear && <circle cx="196" cy="56" r="52" fill="url(#fest-moon-glow)" />}
      {/* The crescent: one path, two subpaths, even-odd fill, so the second
          circle punches a bite out of the first.

          Two goes at this failed and both are worth recording. A <mask> gave a
          pale disc. Then even-odd gave a RING, because the biting circle was
          offset far enough to poke out the far side — and the bit poking out
          sits inside exactly one subpath, so even-odd fills it too, closing the
          crescent back into an annulus. The biting circle has to be wholly
          CONTAINED: here the centres are 7.8 apart and the radii differ by 9,
          so it is, with room to spare. Offset diagonally rather than
          horizontally, which is what makes it read as a waxing moon instead of
          a washer. */}
      <path
        fillRule="evenodd"
        fill={glow}
        fillOpacity={0.4 + (filled / steps) * 0.6}
        d="M 196 22 a 34 34 0 1 0 0 68 a 34 34 0 1 0 0 -68 Z
           M 201 25 a 25 25 0 1 0 0 50 a 25 25 0 1 0 0 -50 Z"
      />

      {/* Cloud, drifting off a band at a time. */}
      {Array.from({ length: steps }, (_, i) => {
        if (i < filled) return null;
        const y = 34 + i * 13;
        return (
          <path
            key={i}
            d={`M ${120 + i * 8} ${y} q 26 -13 52 0 q 26 -10 46 4 q -22 11 -50 8 q -30 3 -48 -12 z`}
            fill="#5a5f74"
            fillOpacity={0.85 - i * 0.08}
          />
        );
      })}

      {/* A fanoos hanging at the side, lit once the moon is out. */}
      <path d="M 60 14 L 60 34" stroke="#7a6a4a" strokeWidth="1.6" />
      <path
        d="M 46 34 l 28 0 l -4 34 l -20 0 z"
        fill={clear ? accent : '#4a4459'}
        fillOpacity={clear ? 0.9 : 1}
        stroke="#7a6a4a"
        strokeWidth="1.4"
      />
      {clear && <circle cx="60" cy="52" r="7" fill={glow} className="fest-flame" style={{ '--i': 0 }} />}
      <path d="M 44 68 l 32 0" stroke="#7a6a4a" strokeWidth="2.4" />

      {filled === 0 && (
        <text
          x="196"
          y="126"
          textAnchor="middle"
          fill={glow}
          fillOpacity="0.85"
          style={{ font: '600 11px var(--font-body, sans-serif)', letterSpacing: '0.16em' }}
        >
          TAP TO CLEAR THE CLOUD
        </text>
      )}
    </svg>
  );
}

/* ==========================================================================
 * Christmas — hang the star
 * ======================================================================== */

export function StarTree({ steps = 5, filled = 0, onStep, theme }) {
  const { accent, accentDeep, glow } = theme.palette;
  const topped = filled >= steps;

  /* Ornaments appear up the tree, then the star crowns it. */
  const baubles = [
    { x: 152, y: 112 },
    { x: 188, y: 104 },
    { x: 162, y: 88 },
    { x: 182, y: 70 },
  ];

  return (
    <svg
      viewBox="0 0 340 150"
      className="fest-art"
      role="button"
      tabIndex={0}
      aria-label={topped ? 'The star is on the tree' : `${filled} of ${steps} hung`}
      onPointerDown={filled < steps ? () => onStep?.(filled) : undefined}
      onKeyDown={(e) => {
        if (filled < steps && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onStep?.(filled);
        }
      }}
    >
      {/* Its own glow. Referencing the one Crescent defines would work only on
          the single day of the year both happened to be on screen together. */}
      <defs>
        <radialGradient id="fest-star-glow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor={glow} stopOpacity="0.8" />
          <stop offset="1" stopColor={glow} stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Trunk and three tiers of branches. */}
      <rect x="164" y="122" width="10" height="16" fill="#6b4a2a" />
      {[
        { y: 122, w: 74 },
        { y: 100, w: 58 },
        { y: 78, w: 42 },
      ].map((t, i) => (
        <path
          key={i}
          d={`M 169 ${t.y - 34} L ${169 + t.w / 2} ${t.y} L ${169 - t.w / 2} ${t.y} z`}
          fill={i % 2 ? '#2f6b3a' : '#377d43'}
        />
      ))}

      {baubles.slice(0, Math.min(filled, baubles.length)).map((b, i) => (
        <g key={i} className="fest-ring" style={{ '--i': i }}>
          <circle cx={b.x} cy={b.y} r="5.5" fill={i % 2 ? accent : accentDeep} />
          <circle cx={b.x - 1.6} cy={b.y - 1.8} r="1.6" fill="#fff" fillOpacity="0.7" />
        </g>
      ))}

      {topped && (
        <g className="fest-ring" style={{ '--i': 0 }}>
          <circle cx="169" cy="40" r="20" fill="url(#fest-star-glow)" />
          <path
            d="M 169 26 l 4.4 9.4 l 10.2 1.2 l -7.6 7 l 2 10.2 l -9 -5 l -9 5 l 2 -10.2 l -7.6 -7 l 10.2 -1.2 z"
            fill={glow}
            stroke={accent}
            strokeWidth="1"
          />
        </g>
      )}

      {filled === 0 && (
        <text
          x="256"
          y="80"
          textAnchor="middle"
          fill="rgba(42,26,18,0.45)"
          style={{ font: '600 11px var(--font-body, sans-serif)', letterSpacing: '0.16em' }}
        >
          TAP TO DECORATE
        </text>
      )}
    </svg>
  );
}

/* ==========================================================================
 * The fallback
 *
 * Festival dates are typed in by the admin, so the calendar can hold a name
 * this file has never heard of. That must still look deliberate rather than
 * broken, so anything unmatched gets a kolam that draws itself in the
 * festival's own colours.
 * ======================================================================== */

export function Kolam({ steps = 5, filled = 0, onStep, theme }) {
  const { accent, accentDeep, paper2 } = theme.palette;

  return (
    <svg
      viewBox="-75 -75 150 150"
      className="fest-art fest-art-round"
      role="button"
      tabIndex={0}
      aria-label={`Kolam, ${filled} of ${steps} lines drawn`}
      onPointerDown={filled < steps ? () => onStep?.(filled) : undefined}
      onKeyDown={(e) => {
        if (filled < steps && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onStep?.(filled);
        }
      }}
    >
      <circle r="70" fill={paper2} />

      {/* The pulli — the dot grid a kolam is set out on. Always visible, because
          the dots are drawn before the lines are and staying visible is the
          whole point of them. */}
      {[-40, -20, 0, 20, 40].map((y) =>
        [-40, -20, 0, 20, 40].map((x) =>
          Math.hypot(x, y) > 58 ? null : (
            <circle key={`${x}:${y}`} cx={x} cy={y} r="1.5" fill={accentDeep} fillOpacity="0.42" />
          )
        )
      )}

      {/* A kolam is CLOSED LOOPS drawn around the dots, not lines radiating from
          the middle. The first version did the latter and came out as a
          starburst — six of the calendar's festivals fall back to this motif, so
          it was the most-seen and worst-looking thing here. Each step adds a
          ring of loops, and every loop is a single closed curve that bulges out
          past its dot and pinches back to the centre line, which is what gives
          a kolam its woven look. */}
      {Array.from({ length: steps }, (_, ri) => {
        if (ri >= filled) return null;
        const loops = 4 + ri * 2;
        const inner = 8 + ri * 12;
        const outer = inner + 13;
        const stroke = ri % 2 ? accentDeep : accent;
        let d = '';
        for (let k = 0; k < loops; k += 1) {
          const a = (k * (360 / loops) - 90) * (Math.PI / 180);
          const half = Math.PI / loops;
          /* Two points on the inner circle, one bulge out to the outer. */
          const p = (rad, ang) => `${(Math.cos(ang) * rad).toFixed(2)} ${(Math.sin(ang) * rad).toFixed(2)}`;
          const bulge = outer * 1.32;
          d +=
            `M ${p(inner, a - half)} ` +
            `C ${p(bulge, a - half * 0.75)} ${p(bulge, a + half * 0.75)} ${p(inner, a + half)} ` +
            `C ${p(inner * 0.62, a + half * 0.35)} ${p(inner * 0.62, a - half * 0.35)} ${p(inner, a - half)} Z `;
        }
        return (
          <path
            key={ri}
            className="fest-ring"
            style={{ '--i': ri }}
            d={d.trim()}
            fill={stroke}
            fillOpacity="0.13"
            stroke={stroke}
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
        );
      })}
      {filled === 0 && (
        <text
          y="4"
          textAnchor="middle"
          fill="rgba(24,56,44,0.42)"
          style={{ font: '600 8px var(--font-body, sans-serif)', letterSpacing: '0.16em' }}
        >
          TAP TO DRAW
        </text>
      )}
    </svg>
  );
}
