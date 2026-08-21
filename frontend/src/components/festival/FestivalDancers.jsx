/**
 * The festival troupe: full-colour cartoon figures dancing along the foot of
 * the band.
 *
 * These were flat silhouettes first. A silhouette was the safe choice — it
 * cannot be drawn badly the way a face can — but the shop asked for the
 * characters people actually picture at a festival, so these are drawn:
 * Maveli with his crown and muthukuda, a girl carrying pookalam flowers, a
 * chenda drummer, the pulikali tiger. Drawn here rather than taken from stock
 * art, because a shop cannot put an unlicensed illustration on its front page.
 *
 * ONE RIG. Every figure is the same skeleton — two legs, a body group that
 * bobs, two arms on shoulder joints — and differs in colour, costume and
 * props. That is what keeps ten characters to about the length of two.
 *
 * ANIMATION. Every moving part is a nested <g> carrying no transform attribute
 * of its own; its parent places the joint. A CSS rotation applied to a group
 * that already has a transform attribute reinterprets that attribute — it once
 * stacked an entire pookalam into a vertical column — so placement and
 * animation never share an element here.
 *
 * LAYER ORDER is the only depth these figures have: legs before the body so
 * clothing falls over them, and the far arm before the torso so it sits
 * behind it.
 */

/** Deterministic per-figure variation, so the row is not in lockstep. */
function rnd(i) {
  let x = Math.imul(i ^ 0x9e3779b9, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

const SKIN = '#E9A87A';
const SKIN_2 = '#CE8B5F';
const HAIR = '#2A1A12';
const GOLD = '#E8B22B';
const GOLD_2 = '#B4820F';
const MUNDU = '#FFF7E8';
/* White-on-cream is invisible on a pale festival ground, and most of these
   grounds are pale. Every white garment carries a soft warm edge so the figure
   still reads without a hard cartoon keyline. */
const EDGE = '#C9B48A';
const RED = '#D8342B';
const GREEN = '#2E7D4F';
const TEAL = '#1E8A85';
const ORANGE = '#F0762B';
const PINK = '#DB4F86';
const TIGER = '#F0A32B';

/* Who comes out for which festival. A festival with nothing written gets none
   — a generic dancer at a solemn observance is worse than an empty strip. */
const TROUPE = {
  onam: ['maveli', 'girl', 'tiger'],
  vishu: ['girl', 'drummer'],
  karthigai: ['lampgirl', 'drummer'],
  deepavali: ['sparkler', 'girl', 'sparkler'],
  navratri: ['dandiya', 'dandiya'],
  ayudha: ['drummer', 'girl'],
  pongal: ['bull', 'potgirl'],
  holi: ['holi', 'holi'],
  bihu: ['drummer', 'girl'],
  newyear: ['potgirl', 'drummer'],
  vinayagar: ['drummer', 'girl'],
};

/* ==========================================================================
 * Shared parts
 * ======================================================================== */

/** Two legs with feet, drawn before the body so clothing falls over them. */
function Legs({ style, skin = SKIN }) {
  return (
    <>
      <g transform="translate(26, 72)">
        <g className="fdn-leg-l" style={style}>
          <path d="M 0 0 l -2 22" stroke={skin} strokeWidth="7" strokeLinecap="round" fill="none" />
          <ellipse cx="-3" cy="24" rx="5.5" ry="3" fill={HAIR} />
        </g>
      </g>
      <g transform="translate(34, 72)">
        <g className="fdn-leg-r" style={style}>
          <path d="M 0 0 l 2 22" stroke={skin} strokeWidth="7" strokeLinecap="round" fill="none" />
          <ellipse cx="3" cy="24" rx="5.5" ry="3" fill={HAIR} />
        </g>
      </g>
    </>
  );
}

/** Eyes, brows, a smile, and a mustache where one belongs. */
function Face({ mustache }) {
  return (
    <>
      <circle cx="26.4" cy="15" r="1.5" fill={HAIR} />
      <circle cx="33.6" cy="15" r="1.5" fill={HAIR} />
      <path d="M 24.4 11.8 q 2 -1.4 4 -0.2" stroke={HAIR} strokeWidth="1.1" fill="none" strokeLinecap="round" />
      <path d="M 31.6 11.6 q 2 -1.2 4 0.2" stroke={HAIR} strokeWidth="1.1" fill="none" strokeLinecap="round" />
      <circle cx="23.2" cy="18.6" r="2" fill={RED} opacity="0.22" />
      <circle cx="36.8" cy="18.6" r="2" fill={RED} opacity="0.22" />
      {mustache ? (
        <path d="M 23.5 19.4 q 6.5 3.6 13 0 q -2 5.6 -6.5 5.6 q -4.5 0 -6.5 -5.6 z" fill={HAIR} />
      ) : (
        <path d="M 27 20.6 q 3 2.6 6 0" stroke={HAIR} strokeWidth="1.2" fill="none" strokeLinecap="round" />
      )}
    </>
  );
}

/** A shoulder joint. `l` is the far arm and is drawn before the torso. */
function Arm({ side, style, skin = SKIN, children }) {
  return (
    <g transform={`translate(${side === 'r' ? 39 : 21}, 38)`}>
      <g className={side === 'r' ? 'fdn-arm-r' : 'fdn-arm-l'} style={style}>
        {children || (
          <path
            d={side === 'r' ? 'M 0 0 l 8 15' : 'M 0 0 l -8 15'}
            stroke={skin}
            strokeWidth="6"
            strokeLinecap="round"
            fill="none"
          />
        )}
      </g>
    </g>
  );
}

/* ==========================================================================
 * The characters
 * ======================================================================== */

/** Maveli — crown, curled mustache, the belly, the umbrella held over him. */
function Maveli({ style }) {
  return (
    <g className="fdn" style={style}>
      <Legs style={style} />
      <g className="fdn-bob" style={style}>
        <Arm side="l" style={style} />

        <path d="M 15 54 q 15 -5 30 0 l 4 22 q -19 5 -38 0 z" fill={MUNDU} stroke={EDGE} strokeWidth="0.9" />
        <path d="M 11 74 q 19 5 38 0 l 1 5 q -20 5 -40 0 z" fill={GOLD} />

        <path d="M 30 25 q 17 3 16 20 q -1 12 -16 12 q -15 0 -16 -12 q -1 -17 16 -20 z" fill={SKIN} />
        <path d="M 22 45 q 8 4 16 0" stroke={SKIN_2} strokeWidth="1.1" fill="none" strokeLinecap="round" />

        {/* Angavastram across the chest. */}
        <path d="M 18 30 q 12 7 24 1 l 3 7 q -15 6 -29 -2 z" fill={ORANGE} />
        <path d="M 18 30 q 12 7 24 1" stroke={GOLD_2} strokeWidth="1.1" fill="none" />

        <circle cx="30" cy="16" r="10.5" fill={SKIN} />
        <ellipse cx="19.6" cy="17" rx="2" ry="2.6" fill={SKIN} />
        <ellipse cx="40.4" cy="17" rx="2" ry="2.6" fill={SKIN} />
        <Face mustache />

        <path d="M 20 8.5 l 2.5 -8 l 7.5 5 l 7.5 -5 l 2.5 8 z" fill={GOLD} />
        <rect x="19.5" y="8.4" width="21" height="2.8" rx="1" fill={GOLD_2} />
        <circle cx="30" cy="4.4" r="1.9" fill={RED} />

        <Arm side="r" style={style}>
          <path d="M 0 0 l 10 -24" stroke={SKIN} strokeWidth="6" strokeLinecap="round" fill="none" />
          {/* The fist closed round the shaft. Without it the umbrella read as
              floating above him rather than held. */}
          <circle cx="10" cy="-24" r="3.4" fill={SKIN} />
          <circle cx="10" cy="-24" r="3.4" fill="none" stroke={SKIN_2} strokeWidth="0.8" />
        </Arm>
      </g>

      {/* The muthukuda, clear of the crown and above the raised hand. */}
      <g transform="translate(49, 2)">
        <path d="M -17 0 q 17 -15 34 0 z" fill={GOLD_2} />
        <path d="M -17 0 q 17 -15 34 0 q -9 3 -17 3 q -8 0 -17 -3 z" fill={GOLD} />
        <path d="M -8 -0.8 v -8 M 0 -1.8 v -10 M 8 -0.8 v -8" stroke={GOLD_2} strokeWidth="0.8" opacity="0.7" />
        {/* Runs all the way down past the fist, so the join is unmistakable. */}
        <path d="M 0 0 v 17" stroke="#7A4A1E" strokeWidth="2.2" strokeLinecap="round" />
      </g>
    </g>
  );
}

/** A girl in a pavada. `carry` swaps her basket for a lamp or a pongal pot. */
function Girl({ style, top = TEAL, skirt = ORANGE, carry = 'basket' }) {
  return (
    <g className="fdn" style={style}>
      <Legs style={style} />
      <g className="fdn-bob" style={style}>
        <Arm side="l" style={style} />

        <path d="M 22 48 q 8 -3 16 0 l 8 28 q -16 5 -32 0 z" fill={skirt} />
        <path d="M 14 74 q 16 5 32 0 l 1 5 q -17 5 -34 0 z" fill={GOLD} />

        <path d="M 30 26 q 10 3 9 15 q -1 9 -9 9 q -8 0 -9 -9 q -1 -12 9 -15 z" fill={top} />
        <path d="M 21.5 38 q 8.5 4 17 0" stroke={GOLD} strokeWidth="1.2" fill="none" />

        <circle cx="30" cy="16" r="10" fill={SKIN} />
        <path d="M 20 14 q 2 -12 10 -12 q 8 0 10 12 q -3 -6 -10 -6 q -7 0 -10 6 z" fill={HAIR} />
        <path d="M 39.5 15 q 5 8 1 17 q -3.5 -9 -3.5 -14 z" fill={HAIR} />
        <circle cx="21.4" cy="10" r="2.4" fill={PINK} />
        <circle cx="21.4" cy="10" r="0.9" fill={GOLD} />
        <Face />

        <Arm side="r" style={style}>
          <path d="M 0 0 l 7 13" stroke={SKIN} strokeWidth="6" strokeLinecap="round" fill="none" />
        </Arm>
      </g>

      {/* Carried on the hip, outside the bob so it does not swing. */}
      {carry === 'basket' && (
        <g transform="translate(48, 58)">
          <path d="M -8 0 q 8 -3 16 0 l -2 12 q -6 2 -12 0 z" fill={GOLD_2} />
          <circle cx="-4" cy="-1.4" r="3" fill={ORANGE} />
          <circle cx="1" cy="-2.8" r="3.2" fill={GOLD} />
          <circle cx="5.6" cy="-1.4" r="2.8" fill={RED} />
          <circle cx="-1" cy="-5" r="2.4" fill={PINK} />
        </g>
      )}
      {carry === 'lamp' && (
        <g transform="translate(48, 60)">
          <path d="M -8 0 q 8 6 16 0 q -3 6 -8 6 q -5 0 -8 -6 z" fill={GOLD_2} />
          <ellipse cx="0" cy="0" rx="8" ry="2.4" fill={GOLD} />
          <g className="fdn-flame" style={style}>
            <path d="M 5 -2 q 3.5 -7 0 -12 q -3.5 5 0 12 z" fill="#FFD34A" />
            <path d="M 5 -3 q 1.8 -4 0 -7 q -1.8 3 0 7 z" fill="#FFF3C4" />
          </g>
        </g>
      )}
      {carry === 'pot' && (
        <g transform="translate(47, 58)">
          <path d="M -9 0 q -4 14 9 14 q 13 0 9 -14 z" fill={RED} />
          <rect x="-10.5" y="-4" width="21" height="4.5" rx="2.2" fill={GOLD} />
          {/* Boiling over, which is the whole point of Pongal. */}
          <path d="M -6 -4 q 3 -7 6 -3 q 3 -5 6 1 q -6 3 -12 2 z" fill={MUNDU} />
        </g>
      )}
    </g>
  );
}

/** A chenda drummer, both hands over the drum head. */
function Drummer({ style }) {
  return (
    <g className="fdn" style={style}>
      <Legs style={style} />
      <g className="fdn-bob" style={style}>
        <path d="M 15 54 q 15 -5 30 0 l 4 22 q -19 5 -38 0 z" fill={MUNDU} stroke={EDGE} strokeWidth="0.9" />
        <path d="M 11 74 q 19 5 38 0 l 1 5 q -20 5 -40 0 z" fill={GOLD} />

        <path d="M 30 26 q 11 3 10 16 q -1 10 -10 10 q -9 0 -10 -10 q -1 -13 10 -16 z" fill={SKIN} />
        <path d="M 20 29 q 11 6 21 1 l 2 6 q -13 6 -25 -1 z" fill={RED} />

        <circle cx="30" cy="16" r="10" fill={SKIN} />
        <path d="M 20 13 q 3 -11 10 -11 q 7 0 10 11 q -4 -5 -10 -5 q -6 0 -10 5 z" fill={HAIR} />
        <Face mustache />

        <Arm side="l" style={style}>
          <path d="M 0 0 l -6 -12" stroke={SKIN} strokeWidth="6" strokeLinecap="round" fill="none" />
          <path d="M -6 -12 l -4 -7" stroke="#9A6A3A" strokeWidth="2.2" strokeLinecap="round" />
        </Arm>
        <Arm side="r" style={style}>
          <path d="M 0 0 l 6 -12" stroke={SKIN} strokeWidth="6" strokeLinecap="round" fill="none" />
          <path d="M 6 -12 l 4 -7" stroke="#9A6A3A" strokeWidth="2.2" strokeLinecap="round" />
        </Arm>
      </g>

      <g transform="translate(30, 58)">
        <rect x="-13" y="-2" width="26" height="16" rx="3" fill="#8A4B22" />
        <ellipse cx="0" cy="-2" rx="13" ry="4.4" fill={MUNDU} />
        <ellipse cx="0" cy="-2" rx="13" ry="4.4" fill="none" stroke={GOLD_2} strokeWidth="1.2" />
        <path d="M -13 4 h 26 M -13 8 h 26" stroke={GOLD_2} strokeWidth="1" opacity="0.6" />
      </g>
    </g>
  );
}

/** Pulikali — the painted tiger of the Onam parade, dancing on two legs. */
function Tiger({ style }) {
  return (
    <g className="fdn" style={style}>
      <Legs style={style} skin={TIGER} />
      <g className="fdn-bob" style={style}>
        <Arm side="l" style={style} skin={TIGER} />

        <path d="M 30 26 q 15 3 14 22 q -1 13 -14 13 q -13 0 -14 -13 q -1 -19 14 -22 z" fill={TIGER} />
        <ellipse cx="30" cy="46" rx="8" ry="10" fill="#FFE1A8" />
        <path d="M 18 34 q 5 3 4 8 M 42 34 q -5 3 -4 8 M 19 48 q 5 2 4 7 M 41 48 q -5 2 -4 7"
              stroke={HAIR} strokeWidth="2.2" fill="none" strokeLinecap="round" />

        <circle cx="30" cy="16" r="11" fill={TIGER} />
        <path d="M 20 7.5 l -2.5 -9.5 l 10 4 z" fill={TIGER} />
        <path d="M 40 7.5 l 2.5 -9.5 l -10 4 z" fill={TIGER} />
        <path d="M 20.5 5.5 l -1.4 -5 l 5.4 2.2 z" fill="#E08A6A" />
        <path d="M 39.5 5.5 l 1.4 -5 l -5.4 2.2 z" fill="#E08A6A" />
        <ellipse cx="30" cy="19.5" rx="6.8" ry="5" fill="#FFE1A8" />
        <circle cx="26.2" cy="14.2" r="1.8" fill={HAIR} />
        <circle cx="33.8" cy="14.2" r="1.8" fill={HAIR} />
        <path d="M 30 17.4 l -2.4 2.4 h 4.8 z" fill={HAIR} />
        <path d="M 23.5 21 h -5.5 M 36.5 21 h 5.5" stroke={HAIR} strokeWidth="1.4" strokeLinecap="round" />
        {/* Stripes on the brow — without them it is a cat, not a tiger. */}
        <path d="M 26 7.5 q 1 3 0.5 5 M 30 6.6 q 0 3.4 0 5.4 M 34 7.5 q -1 3 -0.5 5"
              stroke={HAIR} strokeWidth="1.7" fill="none" strokeLinecap="round" />
        <path d="M 21 13 q 3 1 4.5 0.6 M 39 13 q -3 1 -4.5 0.6"
              stroke={HAIR} strokeWidth="1.7" fill="none" strokeLinecap="round" />
        {/* The grin every parade mask has. */}
        <path d="M 26 22.6 q 4 3.4 8 0" stroke={HAIR} strokeWidth="1.4" fill="none" strokeLinecap="round" />
        <path d="M 27.2 23.2 v 2.4 M 32.8 23.2 v 2.4" stroke={MUNDU} strokeWidth="1.6" strokeLinecap="round" />

        <Arm side="r" style={style} skin={TIGER}>
          <path d="M 0 0 l 10 -9" stroke={TIGER} strokeWidth="6" strokeLinecap="round" fill="none" />
        </Arm>
      </g>
    </g>
  );
}

/** The Mattu Pongal bull: washed, horns painted, a bell at the neck. */
function Bull({ style }) {
  return (
    <g className="fdn" style={style}>
      <g className="fdn-bob" style={style}>
        <path d="M 8 54 q 22 -10 40 0 q 5 11 0 22 q -20 8 -40 0 q -5 -11 0 -22 z" fill="#C9885A" />
        <ellipse cx="28" cy="70" rx="16" ry="6" fill="#E3B189" />
        <path d="M 13 74 l -2 26" stroke="#C9885A" strokeWidth="5.5" strokeLinecap="round" />
        <path d="M 21 74 l -1 26" stroke="#B57848" strokeWidth="5.5" strokeLinecap="round" />
        <path d="M 39 74 l 1 26" stroke="#B57848" strokeWidth="5.5" strokeLinecap="round" />
        <path d="M 46 74 l 2 26" stroke="#C9885A" strokeWidth="5.5" strokeLinecap="round" />
        <path d="M 8 56 q -9 7 -7 22" stroke="#C9885A" strokeWidth="2.6" fill="none" strokeLinecap="round" />
        <g transform="translate(50, 50)">
          <g className="fdn-head" style={style}>
            <path d="M 0 0 q 12 1 13 11 q 1 10 -9 11 q -10 1 -13 -9 q -2 -10 9 -13 z" fill="#C9885A" />
            <ellipse cx="7" cy="15" rx="6" ry="4.5" fill="#E3B189" />
            <circle cx="0" cy="7" r="1.5" fill={HAIR} />
            <circle cx="8" cy="19" r="1" fill={HAIR} />
            <path d="M 0 0 q -4 -14 6 -17" stroke={GOLD} strokeWidth="3.4" fill="none" strokeLinecap="round" />
            <path d="M 10 2 q 7 -13 16 -11" stroke={GOLD} strokeWidth="3.4" fill="none" strokeLinecap="round" />
            <circle cx="6" cy="-17" r="1.8" fill={RED} />
            <circle cx="26" cy="-9" r="1.8" fill={RED} />
            <circle cx="-2" cy="16" r="2.6" fill={GOLD} />
          </g>
        </g>
      </g>
    </g>
  );
}

/** A dandiya dancer, sticks crossing overhead. */
function Dandiya({ style, i }) {
  const skirt = i % 2 ? PINK : GREEN;
  return (
    <g className="fdn" style={style}>
      <Legs style={style} />
      <g className="fdn-bob" style={style}>
        <path d="M 22 48 q 8 -3 16 0 l 9 28 q -17 5 -34 0 z" fill={skirt} />
        <path d="M 13 74 q 17 5 34 0 l 1 5 q -18 5 -36 0 z" fill={GOLD} />
        <path d="M 30 26 q 10 3 9 15 q -1 9 -9 9 q -8 0 -9 -9 q -1 -12 9 -15 z" fill={GOLD} />
        <circle cx="30" cy="16" r="10" fill={SKIN} />
        <path d="M 20 14 q 2 -12 10 -12 q 8 0 10 12 q -3 -6 -10 -6 q -7 0 -10 6 z" fill={HAIR} />
        <Face />
        <Arm side="l" style={style}>
          <path d="M 0 0 l -12 -11" stroke={SKIN} strokeWidth="6" strokeLinecap="round" fill="none" />
          <path d="M -12 -11 l -8 -6" stroke={ORANGE} strokeWidth="3.4" strokeLinecap="round" />
        </Arm>
        <Arm side="r" style={style}>
          <path d="M 0 0 l 12 -11" stroke={SKIN} strokeWidth="6" strokeLinecap="round" fill="none" />
          <path d="M 12 -11 l 8 -6" stroke={ORANGE} strokeWidth="3.4" strokeLinecap="round" />
        </Arm>
      </g>
    </g>
  );
}

/** A child with a sparkler, which is most of what Deepavali looks like. */
function Sparkler({ style }) {
  return (
    <g className="fdn" style={style}>
      <Legs style={style} />
      <g className="fdn-bob" style={style}>
        <Arm side="l" style={style} />
        <path d="M 20 48 q 10 -3 20 0 l 4 28 q -14 4 -28 0 z" fill={TEAL} />
        <path d="M 30 26 q 10 3 9 15 q -1 9 -9 9 q -8 0 -9 -9 q -1 -12 9 -15 z" fill={RED} />
        <circle cx="30" cy="16" r="10" fill={SKIN} />
        <path d="M 20 13 q 3 -11 10 -11 q 7 0 10 11 q -4 -5 -10 -5 q -6 0 -10 5 z" fill={HAIR} />
        <Face />
        <Arm side="r" style={style}>
          <path d="M 0 0 l 11 -17" stroke={SKIN} strokeWidth="6" strokeLinecap="round" fill="none" />
          <path d="M 11 -17 l 6 -9" stroke="#6E6E6E" strokeWidth="2" strokeLinecap="round" />
          <g className="fdn-spark" style={style}>
            <circle cx="17" cy="-26" r="7" fill={GOLD} opacity="0.28" />
            <circle cx="17" cy="-26" r="3.4" fill="#FFF3C4" />
            <path d="M 17 -26 l 7 -6 M 17 -26 l -6 -5 M 17 -26 l 8 4 M 17 -26 l -5 7 M 17 -26 l 2 -9"
                  stroke={GOLD} strokeWidth="1.6" strokeLinecap="round" />
          </g>
        </Arm>
      </g>
    </g>
  );
}

/** Holi: a fistful of gulal already leaving the hand, and colour on the kurta. */
function Holi({ style, i }) {
  const kurta = i % 2 ? '#3FA9F5' : '#8B5CF6';
  return (
    <g className="fdn" style={style}>
      <Legs style={style} />
      <g className="fdn-bob" style={style}>
        <Arm side="l" style={style} />
        <path d="M 18 50 q 12 -4 24 0 l 3 26 q -15 5 -30 0 z" fill={MUNDU} stroke={EDGE} strokeWidth="0.9" />
        <path d="M 30 26 q 11 3 10 16 q -1 10 -10 10 q -9 0 -10 -10 q -1 -13 10 -16 z" fill={kurta} />
        <circle cx="24.5" cy="40" r="3" fill={PINK} opacity="0.75" />
        <circle cx="35.5" cy="46" r="2.4" fill={GOLD} opacity="0.75" />
        <circle cx="27" cy="58" r="2.6" fill="#22C55E" opacity="0.55" />
        <circle cx="30" cy="16" r="10" fill={SKIN} />
        <path d="M 20 13 q 3 -11 10 -11 q 7 0 10 11 q -4 -5 -10 -5 q -6 0 -10 5 z" fill={HAIR} />
        <circle cx="23.5" cy="9" r="2.2" fill={PINK} opacity="0.8" />
        <Face />
        <Arm side="r" style={style}>
          <path d="M 0 0 l 15 -13" stroke={SKIN} strokeWidth="6" strokeLinecap="round" fill="none" />
          <g className="fdn-throw" style={style}>
            <circle cx="21" cy="-18" r="4.4" fill={PINK} opacity="0.85" />
            <circle cx="27" cy="-24" r="2.6" fill={GOLD} opacity="0.7" />
            <circle cx="26" cy="-13" r="2.2" fill="#22C55E" opacity="0.6" />
          </g>
        </Arm>
      </g>
    </g>
  );
}

const CAST = {
  maveli: Maveli,
  girl: Girl,
  drummer: Drummer,
  tiger: Tiger,
  bull: Bull,
  dandiya: Dandiya,
  sparkler: Sparkler,
  holi: Holi,
  lampgirl: (p) => <Girl {...p} carry="lamp" top={RED} skirt={GOLD_2} />,
  potgirl: (p) => <Girl {...p} carry="pot" top={GREEN} skirt={RED} />,
};

export default function FestivalDancers({ theme, animation }) {
  if (!theme) return null;
  if (animation?.enabled === false) return null;

  const troupe = TROUPE[theme.id];
  if (!troupe?.length) return null;

  const W = 62;

  return (
    <svg
      className="fest-dancers"
      /* Headroom above the figures. Maveli's umbrella and the dandiya sticks
         both reach well over their heads, and a box starting at zero clipped
         them — anything a costume holds up needs room to be held up in. */
      viewBox={`0 -18 ${W * troupe.length} 122`}
      role="img"
      aria-label={`${theme.label} dancers`}
      preserveAspectRatio="xMidYMax meet"
    >
      {troupe.map((kind, i) => {
        const Who = CAST[kind];
        if (!Who) return null;
        const style = {
          animationDelay: `${-(rnd(i * 3 + 1) * 1.8).toFixed(2)}s`,
          animationDuration: `${(1.5 + rnd(i * 3 + 2) * 0.5).toFixed(2)}s`,
        };
        return (
          <g key={i} transform={`translate(${i * W}, 0)`}>
            <Who style={style} i={i} />
          </g>
        );
      })}
      <path
        d={`M 8 100 H ${W * troupe.length - 8}`}
        stroke={theme.palette.accentDeep || theme.palette.accent}
        strokeOpacity="0.22"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
