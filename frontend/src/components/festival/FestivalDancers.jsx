/**
 * A frieze of dancers along the foot of the festival band.
 *
 * Deliberately silhouettes rather than cartoon characters. A detailed cartoon
 * has to be drawn well or it looks like clip art, and clip art on a shop
 * selling cold-pressed oil at a premium costs more than it adds. A silhouette
 * carries the festival on its shape alone — an umbrella and a round belly is
 * Maveli to anyone in Kerala, two sticks is dandiya, a bull with painted horns
 * is Mattu Pongal — and it cannot be drawn badly in the way a face can.
 *
 * One rig, several costumes. Every figure is the same head, torso, two arms
 * and two legs; what changes is the prop, the stance and which limbs move. It
 * is the difference between five characters to draw and five to describe.
 *
 * ANIMATION. Each limb is a nested <g> that carries no transform attribute of
 * its own — its parent does the positioning — so the CSS rotation that makes
 * it dance cannot reinterpret a placement transform. Getting that wrong once
 * stacked an entire pookalam into a vertical column, and the same trap is one
 * careless `transform-box` away here.
 */

/** Deterministic per-figure variation, so the row is not in lockstep and does
 *  not re-roll on every render. */
function rnd(i) {
  let x = Math.imul(i ^ 0x9e3779b9, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

/* Which figures come out for which festival. Anything not listed gets none —
   a generic dancer at a solemn observance would be worse than an empty strip. */
const TROUPE = {
  onam: ['maveli', 'clap', 'clap'],
  vishu: ['clap', 'clap'],
  karthigai: ['lamp', 'clap'],
  deepavali: ['sparkler', 'clap', 'sparkler'],
  navratri: ['dandiya', 'dandiya'],
  ayudha: ['clap', 'clap'],
  pongal: ['bull', 'pot'],
  holi: ['throw', 'throw', 'clap'],
  bihu: ['clap', 'clap'],
  newyear: ['pot', 'clap'],
};

/**
 * One dancer. The whole figure lives in a 60x100 box with its feet on y=100,
 * so a row of them stands on one line however tall each is.
 */
function Dancer({ kind, i, ink, glow }) {
  /* Two arms, two legs and a bob, each on its own nested group. The delay is
     hashed per figure so the row moves like people rather than a machine. */
  const delay = `${-(rnd(i * 3 + 1) * 1.8).toFixed(2)}s`;
  const beat = `${(1.5 + rnd(i * 3 + 2) * 0.5).toFixed(2)}s`;
  const style = { animationDelay: delay, animationDuration: beat };

  if (kind === 'bull') {
    /* Mattu Pongal: the bull is washed, its horns painted and belled. It does
       not dance — it tosses its head, which is the whole character of it. */
    return (
      <g className="fdn" style={style}>
        <g className="fdn-bob" style={style}>
          {/* Barrel body, four legs, a dewlap and a tail. The first attempt
              was one blob with two stubs and read as a beetle. */}
          <path d="M 8 56 q 22 -9 40 0 q 4 10 0 20 q -20 7 -40 0 q -4 -10 0 -20 z" fill={ink} />
          <path d="M 13 74 l -2 26" stroke={ink} strokeWidth="5" strokeLinecap="round" />
          <path d="M 21 74 l -1 26" stroke={ink} strokeWidth="5" strokeLinecap="round" />
          <path d="M 39 74 l 1 26" stroke={ink} strokeWidth="5" strokeLinecap="round" />
          <path d="M 46 74 l 2 26" stroke={ink} strokeWidth="5" strokeLinecap="round" />
          <path d="M 8 58 q -8 6 -6 20" stroke={ink} strokeWidth="2.5" fill="none" strokeLinecap="round" />
          <g transform="translate(50, 52)">
            <g className="fdn-head" style={style}>
              <path d="M 0 0 q 11 1 12 10 q 1 9 -8 10 q -9 1 -12 -8 q -2 -9 8 -12 z" fill={ink} />
              {/* Painted, belled horns — the part everyone recognises. */}
              <path d="M 1 0 q -3 -13 6 -16" stroke={glow} strokeWidth="3.2" fill="none" strokeLinecap="round" />
              <path d="M 10 2 q 6 -12 15 -11" stroke={glow} strokeWidth="3.2" fill="none" strokeLinecap="round" />
              <circle cx="3" cy="14" r="2.2" fill={glow} />
            </g>
          </g>
        </g>
      </g>
    );
  }

  const props = {
    /* Maveli: umbrella, crown, and the belly he is always drawn with. */
    maveli: {
      belly: true,
      crown: true,
      rightArm: <path d="M 0 0 l 10 -22" stroke={ink} strokeWidth="5" strokeLinecap="round" fill="none" />,
      /* Above the raised hand, not on his head. The first version put the
         canopy at the same height as the face and it read as a hat pulled
         over his eyes. The lifted arm ends at (48,14); the shaft starts
         there and the canopy clears the crown. */
      extra: (
        <g transform="translate(48, 3)">
          <path d="M -15 0 q 15 -13 30 0 q -8 -3 -15 -3 q -7 0 -15 3 z" fill={glow} />
          <path d="M 0 0 v 12" stroke={ink} strokeWidth="2.2" strokeLinecap="round" />
        </g>
      ),
    },
    /* Dandiya: the sticks, and arms crossing to strike them. */
    dandiya: {
      rightArm: <path d="M 0 0 l 14 -12" stroke={ink} strokeWidth="5" strokeLinecap="round" fill="none" />,
      leftArm: <path d="M 0 0 l -14 -12" stroke={ink} strokeWidth="5" strokeLinecap="round" fill="none" />,
      extra: (
        <>
          <path d="M 44 36 l 10 -8" stroke={glow} strokeWidth="3.5" strokeLinecap="round" />
          <path d="M 16 36 l -10 -8" stroke={glow} strokeWidth="3.5" strokeLinecap="round" />
        </>
      ),
    },
    sparkler: {
      rightArm: <path d="M 0 0 l 12 -18" stroke={ink} strokeWidth="5" strokeLinecap="round" fill="none" />,
      extra: (
        <g className="fdn-spark" style={style}>
          <circle cx="46" cy="22" r="3" fill={glow} />
          <path d="M 46 22 l 6 -6 M 46 22 l -5 -6 M 46 22 l 7 4" stroke={glow} strokeWidth="1.6" strokeLinecap="round" />
        </g>
      ),
    },
    lamp: {
      rightArm: <path d="M 0 0 l 10 -10" stroke={ink} strokeWidth="5" strokeLinecap="round" fill="none" />,
      extra: (
        <g transform="translate(44, 44)">
          <path d="M -7 0 q 7 6 14 0 q -2 5 -7 5 q -5 0 -7 -5 z" fill={ink} />
          <g className="fdn-flame" style={style}>
            <path d="M 0 -2 q 3 -6 0 -10 q -3 4 0 10 z" fill={glow} />
          </g>
        </g>
      ),
    },
    /* Holi: a hand flung open, and the colour already leaving it. */
    throw: {
      rightArm: <path d="M 0 0 l 16 -14" stroke={ink} strokeWidth="5" strokeLinecap="round" fill="none" />,
      extra: (
        <g className="fdn-throw" style={style}>
          <circle cx="52" cy="26" r="4" fill={glow} opacity="0.85" />
          <circle cx="58" cy="20" r="2.4" fill={glow} opacity="0.6" />
          <circle cx="56" cy="32" r="2" fill={glow} opacity="0.5" />
        </g>
      ),
    },
    /* A pot carried on the hip — Pongal, and the new year. */
    pot: {
      leftArm: <path d="M 0 0 l -8 6" stroke={ink} strokeWidth="5" strokeLinecap="round" fill="none" />,
      extra: (
        <g transform="translate(14, 52)">
          <path d="M -8 0 q -3 12 8 12 q 11 0 8 -12 z" fill={glow} />
          <rect x="-9" y="-3" width="18" height="4" rx="2" fill={ink} />
        </g>
      ),
    },
    clap: {},
  }[kind] || {};

  return (
    <g className="fdn" style={style}>
      <g className="fdn-bob" style={style}>
        {/* Head, and a crown for the one who needs one. */}
        <circle cx="30" cy="20" r="9" fill={ink} />
        {props.crown && <path d="M 21 12 l 3 -8 l 6 5 l 6 -5 l 3 8 z" fill={glow} />}

        {/* Torso — rounder for Maveli, because that is how he is drawn. */}
        {props.belly ? (
          <path d="M 30 29 q 17 4 15 24 q -2 13 -15 13 q -13 0 -15 -13 q -2 -20 15 -24 z" fill={ink} />
        ) : (
          <path d="M 30 29 q 10 3 9 18 q -1 12 -9 12 q -8 0 -9 -12 q -1 -15 9 -18 z" fill={ink} />
        )}

        {/* Arms. The outer group puts the shoulder in place; the inner one
            carries no transform of its own, so CSS can swing it freely. */}
        <g transform="translate(38, 36)">
          <g className="fdn-arm-r" style={style}>
            {props.rightArm || <path d="M 0 0 l 8 14" stroke={ink} strokeWidth="5" strokeLinecap="round" fill="none" />}
          </g>
        </g>
        <g transform="translate(22, 36)">
          <g className="fdn-arm-l" style={style}>
            {props.leftArm || <path d="M 0 0 l -8 14" stroke={ink} strokeWidth="5" strokeLinecap="round" fill="none" />}
          </g>
        </g>
      </g>

      {/* Legs stay outside the bob, so the feet keep the line while the body
          rises and falls above them. */}
      <g transform="translate(26, 62)">
        <g className="fdn-leg-l" style={style}>
          <path d="M 0 0 l -3 38" stroke={ink} strokeWidth="5.5" strokeLinecap="round" fill="none" />
        </g>
      </g>
      <g transform="translate(34, 62)">
        <g className="fdn-leg-r" style={style}>
          <path d="M 0 0 l 3 38" stroke={ink} strokeWidth="5.5" strokeLinecap="round" fill="none" />
        </g>
      </g>

      {props.extra}
    </g>
  );
}

export default function FestivalDancers({ theme, animation }) {
  if (!theme) return null;
  if (animation?.enabled === false) return null;

  const troupe = TROUPE[theme.id];
  if (!troupe?.length) return null;

  const { accentDeep, glow, accent } = theme.palette;
  const W = 60;

  return (
    <svg
      className="fest-dancers"
      /* Sixteen units of headroom above the figures. Maveli's umbrella reaches
         well over his crown and was being clipped by a box that started at
         zero — anything a costume holds up needs room to be held up in. */
      viewBox={`0 -16 ${W * troupe.length} 120`}
      role="img"
      aria-label={`${theme.label} dancers`}
      preserveAspectRatio="xMidYMax meet"
    >
      {troupe.map((kind, i) => (
        <g key={i} transform={`translate(${i * W}, 0)`}>
          <Dancer kind={kind} i={i} ink={accentDeep || accent} glow={glow} />
        </g>
      ))}
      {/* The ground they stand on. */}
      <path
        d={`M 6 101 H ${W * troupe.length - 6}`}
        stroke={accentDeep || accent}
        strokeOpacity="0.25"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
