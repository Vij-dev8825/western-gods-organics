/**
 * Vinayagar, drawn as line-work rather than as a statue.
 *
 * The naturalistic brass figure this replaced was competing with the
 * photographic offerings and losing — a modelled statue next to real
 * photographs reads as neither. Ornamental line-art sidesteps that: it is
 * plainly a drawing, so it sits beside photographs the way a printed motif
 * sits on a festival card, instead of pretending to be another object on the
 * leaf.
 *
 * Drawn as one family of sweeping strokes — the idiom you see on every
 * Chaturthi card and temple hoarding — with the trunk as a single continuous
 * curve, which is the line the whole figure hangs off. Original work in that
 * idiom. Nothing is traced from any reference.
 *
 * Lives in its own file so the homepage motif can use it without pulling in
 * the eight offering photographs that offerings.jsx imports.
 *
 * Drawn around its own origin, spanning roughly x -44..44 and y -82..12, so a
 * caller places it with a translate and scales it with one transform.
 */

/** Unique-per-instance ids are not needed: both call sites render at most one
 * of these, and identical duplicate gradients resolve to the same paint. */
export function PillaiyarDefs() {
  return (
    <>
      <linearGradient id="vinLineInk" x1="0" y1="0" x2="0.4" y2="1">
        <stop offset="0%" stopColor="#e04a2c" />
        <stop offset="55%" stopColor="#c0281c" />
        <stop offset="100%" stopColor="#8e1a12" />
      </linearGradient>
      <radialGradient id="vinLineHalo" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0%" stopColor="#f7c85a" stopOpacity="0.5" />
        <stop offset="100%" stopColor="#f7c85a" stopOpacity="0" />
      </radialGradient>
    </>
  );
}

export function PillaiyarLine({ lit = false }) {
  const ink = 'url(#vinLineInk)';
  /* Every stroke shares these, which is what makes the figure read as one
     drawn line rather than a set of shapes that happen to be adjacent. */
  const L = { stroke: ink, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' };

  return (
    <g>
      {lit && <circle cx="0" cy="-34" r="72" fill="url(#vinLineHalo)" />}

      {/* ---- Crown: tiered arcs narrowing to a flame ---- */}
      <circle cx="0" cy="-80" r="2.4" fill={ink} />
      <path d="M 0 -76 C 3.6 -71 3.6 -67 0 -64 C -3.6 -67 -3.6 -71 0 -76 Z" fill={ink} />
      <path d="M -7 -62 C -4 -67 4 -67 7 -62" {...L} strokeWidth="2.4" />
      <path d="M -11 -56 C -6 -63 6 -63 11 -56" {...L} strokeWidth="2.6" />
      <path d="M -15 -50 C -8 -59 8 -59 15 -50" {...L} strokeWidth="2.8" />
      {/* Beads along the crown band. */}
      {[-10, -3.4, 3.4, 10].map((x) => (
        <circle key={x} cx={x} cy={-47.5} r="1.2" fill={ink} />
      ))}

      {/* ---- Head: a single arc, open at the bottom where the trunk leaves ---- */}
      <path d="M -17 -45 C -17 -32 -10 -24 0 -24 C 10 -24 17 -32 17 -45" {...L} strokeWidth="3" />
      {/* Tilak, and the third eye above it. */}
      <path d="M 0 -43 L 0 -36" {...L} strokeWidth="2.2" />
      <circle cx="0" cy="-45.5" r="1.6" fill={ink} />

      {/* ---- Ears: big paisley sweeps, the shape that makes him legible ---- */}
      <path d="M -16 -43 C -30 -48 -42 -42 -41 -32 C -40 -22 -30 -19 -20 -25" {...L} strokeWidth="3" />
      <path d="M 16 -43 C 30 -48 42 -42 41 -32 C 40 -22 30 -19 20 -25" {...L} strokeWidth="3" />
      {/* Inner curl of each ear. */}
      <path d="M -20 -38 C -29 -40 -34 -36 -32 -31" {...L} strokeWidth="1.8" />
      <path d="M 20 -38 C 29 -40 34 -36 32 -31" {...L} strokeWidth="1.8" />

      {/* ---- Eyes: closed, downcast ---- */}
      <path d="M -9 -37 C -6.5 -34.6 -4 -34.6 -2.4 -36" {...L} strokeWidth="1.8" />
      <path d="M 9 -37 C 6.5 -34.6 4 -34.6 2.4 -36" {...L} strokeWidth="1.8" />

      {/* ---- Trunk: one continuous curve, the line the figure hangs off ---- */}
      <path
        d="M 0 -24 C 1 -14 -1 -8 -7 -4 C -14 0 -20 -3 -19 -9 C -18.4 -12.6 -14.6 -13.2 -13 -10.4"
        {...L}
        strokeWidth="4.2"
      />
      {/* Tusks, the right one broken short as it always is. */}
      <path d="M -8 -25 C -10 -21 -10 -19 -8.6 -17.4" {...L} strokeWidth="2.2" />
      <path d="M 8 -25 C 9.6 -22.4 9.8 -21 9.2 -20" {...L} strokeWidth="2.2" />

      {/* ---- Body: belly as one bowl, with the shoulders sweeping into it ---- */}
      <path d="M -21 -20 C -26 -8 -22 4 -9 6" {...L} strokeWidth="3" />
      <path d="M 21 -20 C 26 -8 22 4 9 6" {...L} strokeWidth="3" />
      <path d="M -9 6 C -4 7.4 4 7.4 9 6" {...L} strokeWidth="3" />
      {/* The navel curl — a small spiral, the one flourish the belly gets. */}
      <path d="M 2 -2 C -1 -4 -3.4 -2 -2.6 0.6 C -2 2.6 0.6 3 1.8 1.4" {...L} strokeWidth="1.8" />

      {/* ---- Arms: two sweeps out to a lotus and a modakam ---- */}
      <path d="M -21 -16 C -31 -14 -36 -7 -34 0" {...L} strokeWidth="2.8" />
      <path d="M 21 -16 C 31 -14 36 -7 34 0" {...L} strokeWidth="2.8" />
      {/* Lotus buds in the raised hands. */}
      {[-34, 34].map((x) => (
        <g key={x}>
          <path d={`M ${x} 1 C ${x - 4} -3 ${x - 2.4} -8 ${x} -10 C ${x + 2.4} -8 ${x + 4} -3 ${x} 1 Z`} fill={ink} />
          <path d={`M ${x - 5.4} 1 C ${x - 7} -2.4 ${x - 5} -5.4 ${x - 2.6} -5.6`} {...L} strokeWidth="1.6" />
          <path d={`M ${x + 5.4} 1 C ${x + 7} -2.4 ${x + 5} -5.4 ${x + 2.6} -5.6`} {...L} strokeWidth="1.6" />
        </g>
      ))}

      {/* ---- Seat: a lotus, petals opening under him ---- */}
      <path d="M -26 8 C -14 14 14 14 26 8" {...L} strokeWidth="3" />
      {[-19, -9.6, 0, 9.6, 19].map((x, i) => (
        <path
          key={x}
          d={`M ${x} 9 C ${x - 4.6} 13 ${x - 2.4} 17.4 ${x} 18 C ${x + 2.4} 17.4 ${x + 4.6} 13 ${x} 9 Z`}
          fill={i % 2 ? 'none' : ink}
          stroke={ink}
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      ))}
    </g>
  );
}
