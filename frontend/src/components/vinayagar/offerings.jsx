/**
 * The things you put on the leaf.
 *
 * Each offering is drawn around its own origin at roughly 40x40 units, so the
 * board can drop one anywhere by translating and scaling a single <g>. Nothing
 * here knows where it will end up, which is what lets the same drawing serve
 * the tray thumbnail and the placed item on the leaf.
 *
 * Shading is done with gradients rather than flat fills, but every one of them
 * is defined once in <OfferingDefs/> and referenced by id. Twenty-one modakam
 * on the leaf would otherwise mean twenty-one copies of the same gradient, all
 * sharing an id — invalid, and it bloats the serialised copy that the share
 * export rasterises. Defs live in the board's own <defs> so that clone stays
 * self-contained; the tray's little SVGs resolve against the same ids, which
 * works because url(#id) resolves across the whole document.
 *
 * No filters. A blur filter on twenty-one instances is the one thing that
 * would make a full leaf stutter on a phone, so contact shadows are drawn as
 * plain ellipses instead — cheaper, and they rasterise identically.
 *
 * Drawn rather than photographed, and drawn plainly. These are ritual objects:
 * a modakam that reads as a modakam is worth more here than a glossy one.
 */

/** Every gradient the offerings use. Rendered once, inside the board. */
export function OfferingDefs() {
  return (
    <defs>
      {/* Modakam — light falling from the upper left onto a steamed shell. */}
      <linearGradient id="vinModakam" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#fffaf0" />
        <stop offset="52%" stopColor="#f3e5c8" />
        <stop offset="100%" stopColor="#dcc79c" />
      </linearGradient>
      {/* Terracotta, for the lamp. */}
      <linearGradient id="vinClay" x1="0" y1="0" x2="0.4" y2="1">
        <stop offset="0%" stopColor="#d07f45" />
        <stop offset="55%" stopColor="#b8632f" />
        <stop offset="100%" stopColor="#8a4520" />
      </linearGradient>
      {/* Flame: hot centre, cooler edge. */}
      <radialGradient id="vinFlame" cx="0.5" cy="0.68" r="0.62">
        <stop offset="0%" stopColor="#fff8dc" />
        <stop offset="45%" stopColor="#ffd76a" />
        <stop offset="100%" stopColor="#f0932b" />
      </radialGradient>
      {/* Hibiscus petal — deep at the throat, bright at the rim. */}
      <radialGradient id="vinPetal" cx="0.5" cy="0.92" r="0.95">
        <stop offset="0%" stopColor="#8c1d12" />
        <stop offset="38%" stopColor="#cf3a22" />
        <stop offset="100%" stopColor="#ef6a41" />
      </radialGradient>
      {/* Coconut flesh and shell. */}
      <linearGradient id="vinFlesh" x1="0" y1="0" x2="0.3" y2="1">
        <stop offset="0%" stopColor="#fffdf8" />
        <stop offset="70%" stopColor="#efe4d2" />
        <stop offset="100%" stopColor="#d9c9b0" />
      </linearGradient>
      <linearGradient id="vinShell" x1="0" y1="0" x2="0.4" y2="1">
        <stop offset="0%" stopColor="#8a5a33" />
        <stop offset="100%" stopColor="#4f2f19" />
      </linearGradient>
      {/* Banana skin. */}
      <linearGradient id="vinBanana" x1="0.1" y1="0" x2="0.7" y2="1">
        <stop offset="0%" stopColor="#ffe27a" />
        <stop offset="48%" stopColor="#f2c744" />
        <stop offset="100%" stopColor="#c99a22" />
      </linearGradient>
      {/* Betel leaf, and the grass. */}
      <linearGradient id="vinLeaf" x1="0.2" y1="0" x2="0.8" y2="1">
        <stop offset="0%" stopColor="#6fb04c" />
        <stop offset="55%" stopColor="#4f8a3a" />
        <stop offset="100%" stopColor="#33652a" />
      </linearGradient>
      <linearGradient id="vinGrass" x1="0" y1="1" x2="0" y2="0">
        <stop offset="0%" stopColor="#3f7a2c" />
        <stop offset="100%" stopColor="#8cc766" />
      </linearGradient>
      {/* Kumkum: a dry powder, so the light is diffuse rather than specular. */}
      <linearGradient id="vinKumkum" x1="0.2" y1="0" x2="0.8" y2="1">
        <stop offset="0%" stopColor="#e2483a" />
        <stop offset="50%" stopColor="#c62828" />
        <stop offset="100%" stopColor="#7d1717" />
      </linearGradient>
      {/* The supari on the betel leaf. */}
      <radialGradient id="vinNut" cx="0.35" cy="0.3" r="0.8">
        <stop offset="0%" stopColor="#c98a52" />
        <stop offset="100%" stopColor="#7d4423" />
      </radialGradient>
      {/* Brass, for the murti. Warmer and lighter than the clay the lamp is
          made of, so the figure reads as metal rather than more terracotta. */}
      <linearGradient id="vinBrass" x1="0.15" y1="0" x2="0.75" y2="1">
        <stop offset="0%" stopColor="#f3c977" />
        <stop offset="38%" stopColor="#d9a248" />
        <stop offset="72%" stopColor="#b47c2c" />
        <stop offset="100%" stopColor="#8a5a1c" />
      </linearGradient>
      <linearGradient id="vinBrassDeep" x1="0.2" y1="0" x2="0.8" y2="1">
        <stop offset="0%" stopColor="#c9922f" />
        <stop offset="100%" stopColor="#7a4d16" />
      </linearGradient>
      {/* The banana leaf the whole board is served on. Lit from the top left,
          like everything standing on it. */}
      <linearGradient id="vinServingLeaf" x1="0.1" y1="0" x2="0.6" y2="1">
        <stop offset="0%" stopColor="#6fb04c" />
        <stop offset="46%" stopColor="#4f8a3a" />
        <stop offset="100%" stopColor="#356a28" />
      </linearGradient>
      <radialGradient id="vinFloor" cx="0.5" cy="0.42" r="0.68">
        <stop offset="0%" stopColor="#fbeedd" />
        <stop offset="100%" stopColor="#f0dcc4" />
      </radialGradient>
    </defs>
  );
}

/** Contact shadow. Drawn, not filtered — see the note at the top of the file. */
function Ground({ rx = 12, ry = 3.2, y = 1, o = 0.17 }) {
  return <ellipse cx="0" cy={y} rx={rx} ry={ry} fill="#2a1a12" opacity={o} />;
}

export function Modakam() {
  const w = 11;
  const h = 15;
  return (
    <g>
      <Ground rx={w * 0.95} ry={2.8} />
      <path
        d={`M 0 ${-h}
            c ${w * 0.46} ${h * 0.3} ${w} ${h * 0.58} ${w} ${h}
            l ${-w * 2} 0
            c 0 ${-h * 0.42} ${w * 0.54} ${-h * 0.7} ${w} ${-h} z`}
        fill="url(#vinModakam)"
        stroke="#c9b085"
        strokeWidth="0.7"
      />
      {/* Pleats. Curved, because a hand-formed pleat bows outward — the
          straight lines this replaced read as a paper cone. */}
      {[-0.62, -0.24, 0.24, 0.62].map((f) => (
        <path
          key={f}
          d={`M 0 ${-h + 0.6} q ${w * f * 0.45} ${h * 0.52} ${w * f} ${h - 0.6}`}
          stroke="#d3bb90"
          strokeWidth="0.62"
          fill="none"
          opacity="0.9"
        />
      ))}
      {/* Left-hand highlight, following the same bow as the pleats. */}
      <path
        d={`M -1.4 ${-h + 1.4} q ${-w * 0.34} ${h * 0.5} ${-w * 0.62} ${h - 2.4}`}
        stroke="#fffdf5"
        strokeWidth="1.5"
        fill="none"
        opacity="0.55"
        strokeLinecap="round"
      />
      {/* The tip is pinched closed, and catches the light. */}
      <circle cx="0" cy={-h + 1.2} r="1.5" fill="#e8d5ae" />
      <circle cx="-0.4" cy={-h + 0.8} r="0.7" fill="#fffaf0" />
    </g>
  );
}

export function Arukampul() {
  /* Durva grass. Blades are tapered wedges rather than strokes, so they come
     to a point the way grass does. */
  const blade = (lean, len, wide) =>
    `M 0 0 q ${lean * 0.35} ${-len * 0.55} ${lean} ${-len}
     q ${-wide * 0.5} ${len * 0.12} ${-lean * 0.62} ${len * 0.94} z`;
  return (
    <g>
      <Ground rx={9} ry={2.2} o={0.13} />
      {[
        [-11, 20, 2.6],
        [-5, 25, 2.8],
        [2, 27, 3],
        [8, 23, 2.7],
        [13, 17, 2.4],
      ].map(([lean, len, wide], i) => (
        <path
          key={i}
          d={blade(lean, len, wide)}
          fill="url(#vinGrass)"
          opacity={i % 2 ? 0.92 : 1}
        />
      ))}
      {/* Midribs, on the two front blades only. */}
      <path d="M 0 -1 q 1 -12 2 -25" stroke="#2f5f21" strokeWidth="0.5" fill="none" opacity="0.5" />
      <path d="M 0 -1 q -3 -11 -5 -23" stroke="#2f5f21" strokeWidth="0.5" fill="none" opacity="0.4" />
    </g>
  );
}

export function Hibiscus() {
  /* Sembaruthi. Five petals with a notched outer edge — the notch is what
     separates a hibiscus from a daisy at this size. */
  const petal =
    'M 0 0 C -7 -6 -8.6 -13 -5.6 -17.4 C -4 -19.8 -3 -18.2 -1.8 -19.6 C -0.8 -20.8 0.8 -20.8 1.8 -19.6 C 3 -18.2 4 -19.8 5.6 -17.4 C 8.6 -13 7 -6 0 0 Z';
  return (
    <g>
      <Ground rx={11} ry={2.8} o={0.13} />
      {[0, 72, 144, 216, 288].map((deg) => (
        <g key={deg} transform={`rotate(${deg})`}>
          <path d={petal} fill="url(#vinPetal)" />
          {/* Veins radiating from the throat. */}
          <path d="M 0 -1.5 q 0.6 -8 0.4 -15" stroke="#7d1710" strokeWidth="0.55" fill="none" opacity="0.55" />
          <path d="M 0 -1.5 q -2.6 -7 -3.4 -12.5" stroke="#7d1710" strokeWidth="0.42" fill="none" opacity="0.4" />
          <path d="M 0 -1.5 q 2.6 -7 3.4 -12.5" stroke="#7d1710" strokeWidth="0.42" fill="none" opacity="0.4" />
        </g>
      ))}
      <circle cx="0" cy="0" r="3.4" fill="#8c1d12" />
      <circle cx="-0.8" cy="-0.8" r="1.5" fill="#c0392b" opacity="0.8" />
      {/* The staminal column, which is the part everyone actually pictures. */}
      <path d="M 0 0 q 2.6 -10 2 -16.5" stroke="#a82718" strokeWidth="1.3" fill="none" strokeLinecap="round" />
      {[[1.4, -16.6], [3.1, -14.8], [0.2, -14.6], [2.4, -12.6]].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="1.25" fill="#ffe08a" />
      ))}
    </g>
  );
}

export function Deepam() {
  return (
    <g>
      <Ground rx={14} ry={3.2} y={6} />
      {/* Pooled glow on the lamp, from its own flame. */}
      <ellipse cx="0" cy="-2" rx="17" ry="9" fill="#f7c85a" opacity="0.2" />
      <path
        d={`M 0 -22 c 5.6 5 6.8 10.6 3.4 14.2 c -2.2 2.3 -4.6 2.3 -6.8 0
            c -3.4 -3.6 -2.2 -9.2 3.4 -14.2 z`}
        fill="url(#vinFlame)"
      />
      <path
        d={`M 0 -17 c 2.6 2.6 3.1 5.6 1.5 7.4 c -1 1.1 -2 1.1 -3 0
            c -1.6 -1.8 -1.1 -4.8 1.5 -7.4 z`}
        fill="#fffdf0"
        opacity="0.92"
      />
      {/* Wick, so the flame is attached to something. */}
      <path d="M 0 -8 l 0 4.4" stroke="#5a3a1c" strokeWidth="1.5" strokeLinecap="round" />
      {/* Clay dish: pinched lip at the front where the wick rests. */}
      <path
        d="M -14 -3.4 q 14 10.6 28 0 q -4.4 7.6 -14 7.6 q -9.6 0 -14 -7.6 z"
        fill="url(#vinClay)"
        stroke="#7d3d1b"
        strokeWidth="0.8"
      />
      <path d="M -14 -3.4 q 14 5.6 28 0" stroke="#e89a5c" strokeWidth="1.2" fill="none" opacity="0.75" />
      <path d="M -9.5 -1.4 q 3 2.6 6 3.2" stroke="#f4b97e" strokeWidth="1" fill="none" opacity="0.5" />
    </g>
  );
}

export function Coconut() {
  /* One half, cut side up. */
  return (
    <g>
      <Ground rx={13} ry={3} y={3} />
      <path d="M -12.5 0 a 12.5 12.5 0 0 0 25 0 z" fill="url(#vinShell)" />
      <ellipse cx="0" cy="0" rx="12.5" ry="3.8" fill="url(#vinFlesh)" stroke="#6b4326" strokeWidth="0.9" />
      {/* The brown testa between flesh and shell. */}
      <ellipse cx="0" cy="0" rx="10.6" ry="2.9" fill="#fffdf8" opacity="0.55" />
      <ellipse cx="0" cy="0.3" rx="6.6" ry="1.7" fill="#e3d4bd" opacity="0.75" />
      <path d="M -8 -1.2 q 3.4 -1.6 7.4 -1.4" stroke="#fffefb" strokeWidth="1.1" fill="none" opacity="0.8" />
      {/* Fibre on the shell. */}
      {[-7, -2, 3, 8].map((x) => (
        <path key={x} d={`M ${x} 2.4 q ${x * 0.1} 4 ${x * 0.16} 7`} stroke="#3b2213" strokeWidth="0.6" fill="none" opacity="0.45" />
      ))}
    </g>
  );
}

export function Banana() {
  return (
    <g>
      <Ground rx={12} ry={2.6} y={4} />
      <path
        d="M -12 5 q 1.6 -14 14.5 -17.6 q 3 -0.8 4.2 0.6 q 1 1.2 -0.6 2.4
           q -8.4 4.6 -10.6 14 q -0.8 3 -4 3 q -3.4 0 -3.5 -2.4 z"
        fill="url(#vinBanana)"
        stroke="#b8901f"
        strokeWidth="0.8"
      />
      {/* Ridge down the length. */}
      <path d="M -8.6 3.4 q 2.2 -10.6 12 -14.6" stroke="#fff0b0" strokeWidth="1.2" fill="none" opacity="0.65" />
      <path d="M -10.4 1 q 2.6 -9.4 11 -13.6" stroke="#cfa326" strokeWidth="0.6" fill="none" opacity="0.5" />
      {/* Stem, and the dried tip. */}
      <path d="M 5.6 -12.4 q 2.4 -1.8 3.6 -1" stroke="#7d6018" strokeWidth="2" fill="none" strokeLinecap="round" />
      <circle cx="-11.6" cy="4.4" r="1.5" fill="#8a6a1c" opacity="0.8" />
    </g>
  );
}

export function BetelLeaf() {
  /* Vettrilai with a supari on it — always offered as a pair. */
  return (
    <g>
      <Ground rx={12} ry={3} y={9} />
      <path
        d="M 0 -18 C 9 -11.6 13 -4 11 4 C 9.6 9.6 5 12.6 0 12.6
           C -5 12.6 -9.6 9.6 -11 4 C -13 -4 -9 -11.6 0 -18 Z"
        fill="url(#vinLeaf)"
        stroke="#2f5f21"
        strokeWidth="0.9"
      />
      <path d="M 0 -15.4 L 0 11.4" stroke="#8cc766" strokeWidth="1.1" opacity="0.85" />
      {[-1, 1].map((d) =>
        [-8, -3.4, 1.4, 6].map((y) => (
          <path
            key={`${d}-${y}`}
            d={`M 0 ${y} q ${d * 5} ${1.6} ${d * 8.4} ${5.4}`}
            stroke="#8cc766"
            strokeWidth="0.62"
            fill="none"
            opacity="0.6"
          />
        ))
      )}
      {/* A sheen, because a betel leaf is glossy. */}
      <path d="M -6 -9 q 4 -3.4 8.6 -3.6" stroke="#c6e8a8" strokeWidth="1.5" fill="none" opacity="0.4" strokeLinecap="round" />
      <ellipse cx="0" cy="4.4" rx="4.2" ry="3.6" fill="url(#vinNut)" stroke="#5e3218" strokeWidth="0.6" />
      <ellipse cx="-1.2" cy="3.2" rx="1.4" ry="1.1" fill="#d9a771" opacity="0.7" />
    </g>
  );
}

export function Kumkum() {
  /* A dry powder: diffuse light, a soft rim, and the thumb-press that is
     always in the middle of the mound. */
  return (
    <g>
      <Ground rx={11.5} ry={2.6} y={2.4} />
      <path d="M -10.5 2 q 10.5 -13.5 21 0 z" fill="url(#vinKumkum)" />
      {/* Loose powder skirting the base. */}
      <ellipse cx="0" cy="2" rx="10.5" ry="2.5" fill="#8e1f1f" />
      <ellipse cx="0" cy="1.6" rx="12.6" ry="1.9" fill="#c62828" opacity="0.32" />
      {/* The press, and the ridge it pushes up. */}
      <ellipse cx="0" cy="-2.2" rx="3.1" ry="1.6" fill="#6d1414" opacity="0.72" />
      <path d="M -3.4 -3.2 q 3.4 -1.6 6.8 0" stroke="#e8604f" strokeWidth="0.8" fill="none" opacity="0.55" />
      <path d="M -5.6 -1.4 q 2.4 -5.4 5 -7.2" stroke="#ef7059" strokeWidth="1.2" fill="none" opacity="0.42" strokeLinecap="round" />
    </g>
  );
}

/**
 * Vinayagar himself — fixed at the head of the leaf, never placed by the
 * player. Suggested rather than drawn, the same way the tap-motif does it: a
 * silhouette reads as reverent where a face would read as a cartoon. He is not
 * one of the offerings, so he is not in the tray and cannot be moved.
 */
export function Pillaiyar({ lit = false }) {
  return (
    <g>
      {lit && (
        <>
          <ellipse cx="0" cy="-22" rx="58" ry="52" fill="#f7c85a" opacity="0.14" />
          <ellipse cx="0" cy="-22" rx="38" ry="36" fill="#f7c85a" opacity="0.12" />
        </>
      )}
      <ellipse cx="0" cy="9" rx="32" ry="5.4" fill="#2a1a12" opacity="0.16" />

      {/* Seat: crossed legs, the knees pushed out either side of the belly. */}
      <path
        d="M -27 8 q -3 -11 7 -14 q 9 -2.6 14 2 h 12 q 5 -4.6 14 -2 q 10 3 7 14 z"
        fill="url(#vinBrassDeep)"
      />
      <path d="M -18 3.5 q 18 -5 36 0" stroke="#6b4312" strokeWidth="1" fill="none" opacity="0.5" />
      {/* Two soles, turned up the way they are in a seated murti. */}
      <ellipse cx="-9" cy="1.5" rx="5" ry="3" fill="#e0b160" opacity="0.75" />
      <ellipse cx="9" cy="1.5" rx="5" ry="3" fill="#e0b160" opacity="0.75" />

      {/* Upper arms, behind the body. The back pair hold attributes; the front
          pair rest forward — the lower right open in blessing, the lower left
          cupped round a modakam, which is how he is nearly always cast. */}
      <path d="M -17 -18 q -13 2 -16 -9" stroke="url(#vinBrassDeep)" strokeWidth="5.4" fill="none" strokeLinecap="round" />
      <path d="M 17 -18 q 13 2 16 -9" stroke="url(#vinBrassDeep)" strokeWidth="5.4" fill="none" strokeLinecap="round" />
      <circle cx="-33" cy="-28" r="3.4" fill="#e8bd6a" />
      <circle cx="33" cy="-28" r="3.4" fill="#e8bd6a" />
      <path d="M -16 -10 q -12 5 -12 13" stroke="url(#vinBrass)" strokeWidth="5" fill="none" strokeLinecap="round" />
      <path d="M 16 -10 q 12 5 12 13" stroke="url(#vinBrass)" strokeWidth="5" fill="none" strokeLinecap="round" />

      {/* Belly — the part of him everyone pictures first. */}
      <path d="M -19 -22 q 19 -7 38 0 q 6 18 -19 22 q -25 -4 -19 -22 z" fill="url(#vinBrass)" />
      <ellipse cx="0" cy="-6" rx="6.5" ry="4.5" fill="#8a5a1c" opacity="0.3" />
      <path d="M -13 -18 q 6 -4 13 -4" stroke="#f7dca2" strokeWidth="2.2" fill="none" opacity="0.5" strokeLinecap="round" />

      {/* Ears: wide fans, the single biggest thing that makes him legible. */}
      <path d="M -18 -38 q -22 -6 -24 8 q -2 13 11 14 q 10 0 14 -8 z" fill="url(#vinBrassDeep)" />
      <path d="M 18 -38 q 22 -6 24 8 q 2 13 -11 14 q -10 0 -14 -8 z" fill="url(#vinBrassDeep)" />
      <path d="M -20 -35 q -15 -3 -17 7" stroke="#f0c684" strokeWidth="1.4" fill="none" opacity="0.55" />
      <path d="M 20 -35 q 15 -3 17 7" stroke="#f0c684" strokeWidth="1.4" fill="none" opacity="0.55" />

      {/* Head and trunk. The trunk sweeps down and to the viewer's left, and
          ends curled — a trunk drawn straight reads as a snout. */}
      <ellipse cx="0" cy="-40" rx="18" ry="15.5" fill="url(#vinBrass)" />
      <path
        d="M 0 -33 q 1.5 11 -6 16 q -8 5 -11 -1.5 q -2 -4.5 3.5 -5.5"
        stroke="url(#vinBrass)"
        strokeWidth="6.2"
        fill="none"
        strokeLinecap="round"
      />
      {/* Tusks, one of them broken, as it always is. */}
      <path d="M -7.5 -32 q -2 4 -0.5 6.5" stroke="#fdf6e4" strokeWidth="2.2" fill="none" strokeLinecap="round" />
      <path d="M 7.5 -32 q 2 3 1 4.5" stroke="#fdf6e4" strokeWidth="2.2" fill="none" strokeLinecap="round" opacity="0.9" />
      {/* Eyes, closed and downcast rather than staring out of the page. */}
      <path d="M -10 -42 q 3 2 5.5 0.6" stroke="#6b4312" strokeWidth="1.3" fill="none" strokeLinecap="round" />
      <path d="M 10 -42 q -3 2 -5.5 0.6" stroke="#6b4312" strokeWidth="1.3" fill="none" strokeLinecap="round" />

      {/* Crown: a tapering mukuta with a medallion at the front and a finial. */}
      <path d="M -14 -52 q 14 -5 28 0 l -3 6 q -11 -3.5 -22 0 z" fill="#e8bd6a" />
      <path d="M -11 -52 q 11 -17 22 0 z" fill="url(#vinBrass)" />
      <path d="M -5.5 -62 q 5.5 -9 11 0 z" fill="#e8bd6a" />
      <path d="M 0 -70 l 3.5 8 h -7 z" fill="#f3c977" />
      <circle cx="0" cy="-71.5" r="2.2" fill="#e0562d" />
      <circle cx="0" cy="-55" r="4" fill="#f3c977" />
      <circle cx="0" cy="-55" r="1.8" fill="#b47c2c" />
      {/* Tilak. */}
      <path d="M 0 -47.5 l 0 5" stroke="#e0562d" strokeWidth="2" strokeLinecap="round" />
    </g>
  );
}

/**
 * The tray, in the order a puja actually runs: light the lamp, then the leaf
 * and the nut, then what is eaten, then the flowers and the grass, then the
 * modakam last because that is the offering the day is about.
 */
export const OFFERINGS = [
  { id: 'deepam', label: 'Deepam', tamil: 'தீபம்', Art: Deepam, note: 'Light it first.' },
  { id: 'betel', label: 'Betel leaf', tamil: 'வெற்றிலை', Art: BetelLeaf, note: 'Leaf and nut, always a pair.' },
  { id: 'coconut', label: 'Coconut', tamil: 'தேங்காய்', Art: Coconut, note: 'Broken, cut side up.' },
  { id: 'banana', label: 'Banana', tamil: 'வாழைப்பழம்', Art: Banana, note: 'From the same plant as the leaf.' },
  { id: 'kumkum', label: 'Kumkum', tamil: 'குங்குமம்', Art: Kumkum, note: 'A mound, pressed in the middle.' },
  { id: 'hibiscus', label: 'Sembaruthi', tamil: 'செம்பருத்தி', Art: Hibiscus, note: 'The red flower that is his.' },
  { id: 'arukampul', label: 'Arukampul', tamil: 'அறுகம்புல்', Art: Arukampul, note: 'Durva grass, offered in threes.' },
  { id: 'modakam', label: 'Modakam', tamil: 'மோதகம்', Art: Modakam, note: 'Twenty-one of them, traditionally.' },
];

export const OFFERING_BY_ID = Object.fromEntries(OFFERINGS.map((o) => [o.id, o]));
