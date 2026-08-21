/**
 * The festival troupe: cartoon figures dancing along the foot of the band.
 *
 * PROPORTION IS THE WHOLE THING. The first colour version used roughly
 * realistic proportions — a small head on a long body with thin stroked limbs
 * — and at the eighty pixels these are actually drawn at, that reads stiff and
 * cheap. Every appealing mascot is built the other way round: the head is
 * nearly half the figure, the body is a small rounded lump under it, and the
 * limbs are filled shapes rather than lines. That is what these are now.
 *
 * At this size detail is noise. What carries a character is silhouette, one
 * strong colour and a face big enough to read — a crown and a mustache is
 * Maveli, a huge striped head is pulikali. Anything finer than that is lost.
 *
 * ONE RIG. Every figure shares a head, a body, two arms on shoulder joints and
 * two legs; costume and colour are the difference. Ten characters cost about
 * the length of two.
 *
 * ANIMATION. Every moving part is a nested <g> with no transform attribute of
 * its own — its parent places the joint. A CSS rotation on a group that
 * already carries a transform attribute reinterprets that attribute, which
 * once stacked a whole pookalam into a vertical column. Placement and
 * animation never share an element here.
 */

/** Deterministic per-figure variation, so the row is not in lockstep. */
function rnd(i) {
  let x = Math.imul(i ^ 0x9e3779b9, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

const SKIN = '#F0B183';
const SKIN_2 = '#D08C58';
const HAIR = '#2E1C14';
const GOLD = '#F2B927';
const GOLD_2 = '#C08A10';
const CREAM = '#FFF6E6';
const CREAM_2 = '#D9C296';
const RED = '#E03B2F';
const RED_2 = '#A82219';
const GREEN = '#2F8B57';
const GREEN_2 = '#1E5F3B';
const TEAL = '#1F9490';
const TEAL_2 = '#136865';
const ORANGE = '#F47B27';
const ORANGE_2 = '#C05512';
const PINK = '#E0568F';
const PINK_2 = '#A82F63';
const TIGER = '#F5A623';
const TIGER_2 = '#C87A0A';
const BROWN = '#C08552';
const BROWN_2 = '#8A5A32';

/* Who comes out for which festival. Two apiece, not three: at this size a
   third figure only makes all of them smaller. A festival with nothing
   written gets none — a generic dancer at a solemn observance is worse than
   an empty strip. */
const TROUPE = {
  onam: ['maveli', 'tiger'],
  vishu: ['girl', 'drummer'],
  karthigai: ['lampgirl', 'drummer'],
  deepavali: ['sparkler', 'girl'],
  navratri: ['dandiya', 'dandiya'],
  ayudha: ['drummer', 'girl'],
  pongal: ['bull', 'potgirl'],
  holi: ['holi', 'holi'],
  bihu: ['drummer', 'girl'],
  newyear: ['potgirl', 'drummer'],
  vinayagar: ['drummer', 'girl'],
};

/* ==========================================================================
 * The rig
 *
 * A figure is 68 wide and stands with its feet on y=100. The head is centred
 * at (34, 30) with r=22 — nearly half the height, which is the proportion the
 * whole look depends on.
 * ======================================================================== */

const HEAD_X = 34;
const HEAD_Y = 30;
const HEAD_R = 22;

/** Short, thick legs with round feet. Drawn first so clothing falls over. */
function Legs({ style, skin = SKIN, dark = SKIN_2 }) {
  return (
    <>
      <g transform="translate(27, 76)">
        <g className="fdn-leg-l" style={style}>
          <path d="M 0 0 v 16" stroke={skin} strokeWidth="11" strokeLinecap="round" fill="none" />
          <ellipse cx="-1" cy="20" rx="7.5" ry="4.5" fill={dark} />
        </g>
      </g>
      <g transform="translate(41, 76)">
        <g className="fdn-leg-r" style={style}>
          <path d="M 0 0 v 16" stroke={skin} strokeWidth="11" strokeLinecap="round" fill="none" />
          <ellipse cx="1" cy="20" rx="7.5" ry="4.5" fill={dark} />
        </g>
      </g>
    </>
  );
}

/** A big readable face. At this scale the eyes and smile are the character. */
function Face({ mustache }) {
  return (
    <>
      <ellipse cx={HEAD_X - 7.5} cy={HEAD_Y - 1} rx="3" ry="3.4" fill={HAIR} />
      <ellipse cx={HEAD_X + 7.5} cy={HEAD_Y - 1} rx="3" ry="3.4" fill={HAIR} />
      <circle cx={HEAD_X - 6.4} cy={HEAD_Y - 2.4} r="1.1" fill="#fff" />
      <circle cx={HEAD_X + 8.6} cy={HEAD_Y - 2.4} r="1.1" fill="#fff" />
      <circle cx={HEAD_X - 14} cy={HEAD_Y + 6} r="3.6" fill={RED} opacity="0.2" />
      <circle cx={HEAD_X + 14} cy={HEAD_Y + 6} r="3.6" fill={RED} opacity="0.2" />
      {mustache ? (
        <>
          {/* A big curled mustache does more for Maveli than any other mark. */}
          <path
            d={`M ${HEAD_X} ${HEAD_Y + 7} q -6 -3 -11 0 q -3 2 -1 4 q 3 2 6 -1 q 3 -3 6 -3 z`}
            fill={HAIR}
          />
          <path
            d={`M ${HEAD_X} ${HEAD_Y + 7} q 6 -3 11 0 q 3 2 1 4 q -3 2 -6 -1 q -3 -3 -6 -3 z`}
            fill={HAIR}
          />
          <path
            d={`M ${HEAD_X - 4} ${HEAD_Y + 12} q 4 3 8 0`}
            stroke={HAIR}
            strokeWidth="1.6"
            fill="none"
            strokeLinecap="round"
          />
        </>
      ) : (
        <path
          d={`M ${HEAD_X - 5} ${HEAD_Y + 7} q 5 5 10 0`}
          stroke={HAIR}
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
        />
      )}
    </>
  );
}

/** A shoulder joint. `l` is the far arm, drawn before the body. */
function Arm({ side, style, skin = SKIN, children }) {
  return (
    <g transform={`translate(${side === 'r' ? 45 : 23}, 58)`}>
      <g className={side === 'r' ? 'fdn-arm-r' : 'fdn-arm-l'} style={style}>
        {children || (
          <path
            d={side === 'r' ? 'M 0 0 q 7 6 8 13' : 'M 0 0 q -7 6 -8 13'}
            stroke={skin}
            strokeWidth="9"
            strokeLinecap="round"
            fill="none"
          />
        )}
      </g>
    </g>
  );
}

/** The small rounded body every figure hangs off. */
function Body({ fill, dark, trim }) {
  return (
    <>
      <path d="M 34 48 q 15 2 14 15 q -1 13 -14 13 q -13 0 -14 -13 q -1 -13 14 -15 z" fill={fill} />
      {dark && <path d="M 34 76 q 10 0 13 -5 q -2 5 -13 5 q -11 0 -13 -5 q 3 5 13 5 z" fill={dark} />}
      {trim}
    </>
  );
}

/* ==========================================================================
 * The characters
 * ======================================================================== */

/** Maveli — the crown, the mustache, the belly, the umbrella over him. */
function Maveli({ style }) {
  return (
    <g className="fdn" style={style}>
      <Legs style={style} />
      <g className="fdn-bob" style={style}>
        <Arm side="l" style={style} />

        {/* Mundu over a round belly. */}
        <path d="M 34 48 q 17 2 16 16 q -1 14 -16 14 q -15 0 -16 -14 q -1 -14 16 -16 z" fill={SKIN} />
        <path d="M 18 64 q 16 6 32 0 l 2 15 q -18 6 -36 0 z" fill={CREAM} stroke={CREAM_2} strokeWidth="1" />
        <path d="M 16 77 q 18 6 36 0 l 1 4 q -19 6 -38 0 z" fill={GOLD} />
        {/* Angavastram over one shoulder. */}
        <path d="M 22 52 q 13 8 26 1 l 3 7 q -16 8 -31 -1 z" fill={ORANGE} />

        <circle cx={HEAD_X} cy={HEAD_Y} r={HEAD_R} fill={SKIN} />
        <ellipse cx={HEAD_X - 21} cy={HEAD_Y + 3} rx="3.4" ry="4.4" fill={SKIN} />
        <ellipse cx={HEAD_X + 21} cy={HEAD_Y + 3} rx="3.4" ry="4.4" fill={SKIN} />
        <circle cx={HEAD_X - 21} cy={HEAD_Y + 5} r="1.6" fill={GOLD} />
        <circle cx={HEAD_X + 21} cy={HEAD_Y + 5} r="1.6" fill={GOLD} />
        <Face mustache />

        {/* Crown, sized to the head rather than perched on it. */}
        <path d="M 17 14 l 3 -12 l 8 7 l 6 -9 l 6 9 l 8 -7 l 3 12 z" fill={GOLD} />
        <rect x="16" y="13" width="36" height="5" rx="2.4" fill={GOLD_2} />
        <circle cx="34" cy="6" r="2.6" fill={RED} />
        <circle cx="22.5" cy="10" r="1.8" fill={RED} />
        <circle cx="45.5" cy="10" r="1.8" fill={RED} />

        <Arm side="r" style={style}>
          <path d="M 0 0 q 9 -8 11 -20" stroke={SKIN} strokeWidth="9" strokeLinecap="round" fill="none" />
          {/* The fist closed on the shaft, so the umbrella reads as held. */}
          <circle cx="11" cy="-20" r="5" fill={SKIN} />
        </Arm>
      </g>

      {/* The muthukuda, wide enough to be an umbrella rather than a hat. */}
      <g transform="translate(56, 6)">
        <path d="M -21 0 q 21 -19 42 0 z" fill={GOLD_2} />
        <path d="M -21 0 q 21 -19 42 0 q -11 4 -21 4 q -10 0 -21 -4 z" fill={GOLD} />
        <path d="M -10 -0.5 v -10 M 0 -2 v -13 M 10 -0.5 v -10" stroke={GOLD_2} strokeWidth="1" opacity="0.7" />
        <circle cx="0" cy="-17" r="2.2" fill={RED} />
        <path d="M 0 0 v 34" stroke={BROWN_2} strokeWidth="2.6" strokeLinecap="round" />
      </g>
    </g>
  );
}

/** A girl in a pavada. `carry` swaps the basket for a lamp or a pongal pot. */
function Girl({ style, top = TEAL, topDark = TEAL_2, skirt = ORANGE, skirtDark = ORANGE_2, carry = 'basket' }) {
  return (
    <g className="fdn" style={style}>
      <Legs style={style} />
      <g className="fdn-bob" style={style}>
        <Arm side="l" style={style} />

        {/* Bell skirt with a gold hem. */}
        <path d="M 26 62 q 8 -3 16 0 l 10 18 q -18 6 -36 0 z" fill={skirt} />
        <path d="M 16 78 q 18 6 36 0 l 1 4 q -19 6 -38 0 z" fill={GOLD} />
        <path d="M 26 62 q 8 -3 16 0 l 2 4 q -10 3 -20 0 z" fill={skirtDark} opacity="0.5" />

        <Body fill={top} dark={topDark} />

        <circle cx={HEAD_X} cy={HEAD_Y} r={HEAD_R} fill={SKIN} />
        {/* Hair as a cap over the crown of the head, plus a plait. */}
        <path d="M 12 28 q 2 -26 22 -26 q 20 0 22 26 q -6 -13 -22 -13 q -16 0 -22 13 z" fill={HAIR} />
        <path d="M 54 30 q 10 16 3 32 q -7 -17 -7 -26 z" fill={HAIR} />
        <circle cx="15.5" cy="20" r="4.4" fill={PINK} />
        <circle cx="15.5" cy="20" r="1.7" fill={GOLD} />
        <Face />

        <Arm side="r" style={style}>
          <path d="M 0 0 q 8 5 9 12" stroke={SKIN} strokeWidth="9" strokeLinecap="round" fill="none" />
        </Arm>
      </g>

      {/* Carried on the hip, outside the bob so it does not swing. */}
      {carry === 'basket' && (
        <g transform="translate(56, 70)">
          <path d="M -10 0 q 10 -4 20 0 l -3 15 q -7 3 -14 0 z" fill={BROWN_2} />
          <path d="M -10 0 q 10 -4 20 0 l -1 4 q -9 3 -18 0 z" fill={BROWN} />
          <circle cx="-5" cy="-2" r="4" fill={ORANGE} />
          <circle cx="1" cy="-4" r="4.4" fill={GOLD} />
          <circle cx="7" cy="-2" r="3.6" fill={RED} />
          <circle cx="-1" cy="-7" r="3.2" fill={PINK} />
        </g>
      )}
      {carry === 'lamp' && (
        <g transform="translate(56, 72)">
          <path d="M -11 0 q 11 8 22 0 q -4 8 -11 8 q -7 0 -11 -8 z" fill={GOLD_2} />
          <ellipse cx="0" cy="0" rx="11" ry="3.2" fill={GOLD} />
          <g className="fdn-flame" style={style}>
            <path d="M 7 -3 q 5 -10 0 -17 q -5 7 0 17 z" fill="#FFD34A" />
            <path d="M 7 -4 q 2.4 -5 0 -9 q -2.4 4 0 9 z" fill="#FFF6D8" />
          </g>
        </g>
      )}
      {carry === 'pot' && (
        <g transform="translate(55, 70)">
          <path d="M -12 0 q -5 18 12 18 q 17 0 12 -18 z" fill={RED} />
          <path d="M -12 0 q -5 18 12 18 q -6 -6 -6 -18 z" fill={RED_2} opacity="0.45" />
          <rect x="-13.5" y="-5" width="27" height="6" rx="3" fill={GOLD} />
          {/* Boiling over, which is the whole point of Pongal. */}
          <path d="M -8 -5 q 4 -9 8 -4 q 4 -7 8 1 q -8 4 -16 3 z" fill={CREAM} />
        </g>
      )}
    </g>
  );
}

/** A chenda drummer, both hands over the head of the drum. */
function Drummer({ style }) {
  return (
    <g className="fdn" style={style}>
      <Legs style={style} />
      <g className="fdn-bob" style={style}>
        <path d="M 18 64 q 16 6 32 0 l 2 15 q -18 6 -36 0 z" fill={CREAM} stroke={CREAM_2} strokeWidth="1" />
        <path d="M 16 77 q 18 6 36 0 l 1 4 q -19 6 -38 0 z" fill={GOLD} />
        <Body fill={SKIN} dark={SKIN_2} />
        <path d="M 22 52 q 13 8 26 1 l 3 7 q -16 8 -31 -1 z" fill={RED} />

        <circle cx={HEAD_X} cy={HEAD_Y} r={HEAD_R} fill={SKIN} />
        <path d="M 12 27 q 2 -25 22 -25 q 20 0 22 25 q -6 -12 -22 -12 q -16 0 -22 12 z" fill={HAIR} />
        <Face mustache />

        <Arm side="l" style={style}>
          <path d="M 0 0 q -6 -8 -4 -16" stroke={SKIN} strokeWidth="9" strokeLinecap="round" fill="none" />
          <path d="M -4 -16 l -3 -9" stroke={BROWN_2} strokeWidth="3" strokeLinecap="round" />
        </Arm>
        <Arm side="r" style={style}>
          <path d="M 0 0 q 6 -8 4 -16" stroke={SKIN} strokeWidth="9" strokeLinecap="round" fill="none" />
          <path d="M 4 -16 l 3 -9" stroke={BROWN_2} strokeWidth="3" strokeLinecap="round" />
        </Arm>
      </g>

      {/* The chenda, slung at the waist. */}
      <g transform="translate(34, 68)">
        <rect x="-17" y="-3" width="34" height="20" rx="4" fill={BROWN_2} />
        <ellipse cx="0" cy="-3" rx="17" ry="5.5" fill={CREAM} />
        <ellipse cx="0" cy="-3" rx="17" ry="5.5" fill="none" stroke={GOLD_2} strokeWidth="1.6" />
        <path d="M -17 5 h 34 M -17 10 h 34" stroke={GOLD} strokeWidth="1.4" opacity="0.75" />
      </g>
    </g>
  );
}

/** Pulikali — the painted tiger. A big striped head is the whole character. */
function Tiger({ style }) {
  return (
    <g className="fdn" style={style}>
      <Legs style={style} skin={TIGER} dark={TIGER_2} />
      <g className="fdn-bob" style={style}>
        <Arm side="l" style={style} skin={TIGER} />

        <path d="M 34 48 q 16 2 15 16 q -1 14 -15 14 q -14 0 -15 -14 q -1 -14 15 -16 z" fill={TIGER} />
        <ellipse cx="34" cy="65" rx="9" ry="11" fill="#FFE7B8" />
        <path d="M 20 56 q 5 3 4 8 M 48 56 q -5 3 -4 8" stroke={HAIR} strokeWidth="2.6" fill="none" strokeLinecap="round" />

        {/* Head. */}
        <circle cx={HEAD_X} cy={HEAD_Y} r={HEAD_R} fill={TIGER} />
        <path d="M 18 14 l -4 -13 l 15 5 z" fill={TIGER} />
        <path d="M 50 14 l 4 -13 l -15 5 z" fill={TIGER} />
        <path d="M 19 11.5 l -2 -7 l 8 3 z" fill="#E2856A" />
        <path d="M 49 11.5 l 2 -7 l -8 3 z" fill="#E2856A" />

        <ellipse cx={HEAD_X} cy={HEAD_Y + 7} rx="13" ry="9.5" fill="#FFE7B8" />
        <ellipse cx={HEAD_X - 7.5} cy={HEAD_Y - 2} rx="3.2" ry="3.6" fill={HAIR} />
        <ellipse cx={HEAD_X + 7.5} cy={HEAD_Y - 2} rx="3.2" ry="3.6" fill={HAIR} />
        <circle cx={HEAD_X - 6.3} cy={HEAD_Y - 3.4} r="1.2" fill="#fff" />
        <circle cx={HEAD_X + 8.7} cy={HEAD_Y - 3.4} r="1.2" fill="#fff" />
        <path d="M 34 33 l -3.4 3.4 h 6.8 z" fill={HAIR} />
        <path d="M 34 36.4 v 3.5" stroke={HAIR} strokeWidth="1.6" strokeLinecap="round" />
        {/* The grin every parade mask has. */}
        <path d="M 27 40 q 7 6 14 0" stroke={HAIR} strokeWidth="2" fill="none" strokeLinecap="round" />
        <path d="M 29.5 41.5 v 3.6 M 38.5 41.5 v 3.6" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
        {/* Stripes: without them it is a cat. */}
        <path d="M 27 12 q 1.5 5 1 8 M 34 10 q 0 5.5 0 8.5 M 41 12 q -1.5 5 -1 8"
              stroke={HAIR} strokeWidth="2.6" fill="none" strokeLinecap="round" />
        <path d="M 14 26 q 5 2 7 1.5 M 54 26 q -5 2 -7 1.5 M 15 35 q 5 1 6.5 0 M 53 35 q -5 1 -6.5 0"
              stroke={HAIR} strokeWidth="2.4" fill="none" strokeLinecap="round" />
        <path d="M 22 40 h -7 M 46 40 h 7" stroke={HAIR} strokeWidth="1.6" strokeLinecap="round" />

        <Arm side="r" style={style} skin={TIGER}>
          <path d="M 0 0 q 10 -4 13 -10" stroke={TIGER} strokeWidth="9" strokeLinecap="round" fill="none" />
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
        <path d="M 8 54 q 24 -12 44 0 q 6 13 0 26 q -22 9 -44 0 q -6 -13 0 -26 z" fill={BROWN} />
        <ellipse cx="30" cy="74" rx="18" ry="7" fill="#E8C09A" />
        <path d="M 14 78 v 22" stroke={BROWN} strokeWidth="8" strokeLinecap="round" />
        <path d="M 23 78 v 22" stroke={BROWN_2} strokeWidth="8" strokeLinecap="round" />
        <path d="M 41 78 v 22" stroke={BROWN_2} strokeWidth="8" strokeLinecap="round" />
        <path d="M 50 78 v 22" stroke={BROWN} strokeWidth="8" strokeLinecap="round" />
        <path d="M 8 56 q -11 8 -8 26" stroke={BROWN} strokeWidth="3.4" fill="none" strokeLinecap="round" />
        <g transform="translate(52, 44)">
          <g className="fdn-head" style={style}>
            <circle cx="0" cy="8" r="14" fill={BROWN} />
            <ellipse cx="6" cy="15" rx="9" ry="7" fill="#E8C09A" />
            <circle cx="-4" cy="3" r="2.2" fill={HAIR} />
            <circle cx="9" cy="4" r="2.2" fill={HAIR} />
            <circle cx="3" cy="15" r="1.4" fill={HAIR} />
            <circle cx="10" cy="16" r="1.4" fill={HAIR} />
            {/* Painted horns and the bell. */}
            <path d="M -8 -3 q -6 -16 5 -20" stroke={GOLD} strokeWidth="4.4" fill="none" strokeLinecap="round" />
            <path d="M 9 -3 q 9 -14 19 -11" stroke={GOLD} strokeWidth="4.4" fill="none" strokeLinecap="round" />
            <circle cx="-3" cy="-23" r="2.4" fill={RED} />
            <circle cx="28" cy="-14" r="2.4" fill={RED} />
            <circle cx="-6" cy="19" r="3.4" fill={GOLD} />
          </g>
        </g>
      </g>
    </g>
  );
}

/** A dandiya dancer, sticks crossing overhead. */
function Dandiya({ style, i }) {
  const skirt = i % 2 ? PINK : GREEN;
  const dark = i % 2 ? PINK_2 : GREEN_2;
  return (
    <g className="fdn" style={style}>
      <Legs style={style} />
      <g className="fdn-bob" style={style}>
        <path d="M 26 62 q 8 -3 16 0 l 11 18 q -19 6 -38 0 z" fill={skirt} />
        <path d="M 15 78 q 19 6 38 0 l 1 4 q -20 6 -40 0 z" fill={GOLD} />
        <Body fill={GOLD} dark={GOLD_2} />
        <circle cx={HEAD_X} cy={HEAD_Y} r={HEAD_R} fill={SKIN} />
        <path d="M 12 28 q 2 -26 22 -26 q 20 0 22 26 q -6 -13 -22 -13 q -16 0 -22 13 z" fill={HAIR} />
        <circle cx="15.5" cy="20" r="4.2" fill={dark} />
        <Face />
        <Arm side="l" style={style}>
          <path d="M 0 0 q -10 -8 -13 -16" stroke={SKIN} strokeWidth="9" strokeLinecap="round" fill="none" />
          {/* Long enough to be sticks. At four pixels they read as fingers. */}
          <path d="M -13 -16 l -15 -12" stroke={ORANGE} strokeWidth="5" strokeLinecap="round" />
          <circle cx="-28" cy="-28" r="2.6" fill={GOLD} />
        </Arm>
        <Arm side="r" style={style}>
          <path d="M 0 0 q 10 -8 13 -16" stroke={SKIN} strokeWidth="9" strokeLinecap="round" fill="none" />
          <path d="M 13 -16 l 15 -12" stroke={ORANGE} strokeWidth="5" strokeLinecap="round" />
          <circle cx="28" cy="-28" r="2.6" fill={GOLD} />
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
        <path d="M 22 62 q 12 -3 24 0 l 5 18 q -17 6 -34 0 z" fill={TEAL} />
        <path d="M 17 78 q 17 6 34 0 l 1 4 q -18 6 -36 0 z" fill={TEAL_2} />
        <Body fill={RED} dark={RED_2} />
        <circle cx={HEAD_X} cy={HEAD_Y} r={HEAD_R} fill={SKIN} />
        <path d="M 12 27 q 2 -25 22 -25 q 20 0 22 25 q -6 -12 -22 -12 q -16 0 -22 12 z" fill={HAIR} />
        <Face />
        <Arm side="r" style={style}>
          <path d="M 0 0 q 9 -10 10 -19" stroke={SKIN} strokeWidth="9" strokeLinecap="round" fill="none" />
          <path d="M 10 -19 l 5 -11" stroke="#707070" strokeWidth="2.6" strokeLinecap="round" />
          <g className="fdn-spark" style={style}>
            <circle cx="16" cy="-32" r="10" fill={GOLD} opacity="0.25" />
            <circle cx="16" cy="-32" r="4.4" fill="#FFF6D8" />
            <path d="M 16 -32 l 9 -8 M 16 -32 l -8 -6 M 16 -32 l 10 5 M 16 -32 l -6 9 M 16 -32 l 3 -12"
                  stroke={GOLD} strokeWidth="2.2" strokeLinecap="round" />
          </g>
        </Arm>
      </g>
    </g>
  );
}

/** Holi: a fistful of gulal already leaving the hand, and colour on the kurta. */
function Holi({ style, i }) {
  const kurta = i % 2 ? '#3FA9F5' : '#8B5CF6';
  const dark = i % 2 ? '#1D7FC4' : '#6534D6';
  return (
    <g className="fdn" style={style}>
      <Legs style={style} />
      <g className="fdn-bob" style={style}>
        <Arm side="l" style={style} />
        <path d="M 20 64 q 14 -4 28 0 l 4 16 q -18 6 -36 0 z" fill={CREAM} stroke={CREAM_2} strokeWidth="1" />
        <Body fill={kurta} dark={dark} />
        <circle cx="26" cy="58" r="4" fill={PINK} opacity="0.8" />
        <circle cx="43" cy="66" r="3.4" fill={GOLD} opacity="0.8" />
        <circle cx="30" cy="72" r="3" fill="#22C55E" opacity="0.6" />
        <circle cx={HEAD_X} cy={HEAD_Y} r={HEAD_R} fill={SKIN} />
        <path d="M 12 27 q 2 -25 22 -25 q 20 0 22 25 q -6 -12 -22 -12 q -16 0 -22 12 z" fill={HAIR} />
        <circle cx="18" cy="18" r="3.6" fill={PINK} opacity="0.85" />
        <circle cx="49" cy="21" r="3" fill="#22C55E" opacity="0.7" />
        <Face />
        <Arm side="r" style={style}>
          <path d="M 0 0 q 12 -6 16 -13" stroke={SKIN} strokeWidth="9" strokeLinecap="round" fill="none" />
          <g className="fdn-throw" style={style}>
            <circle cx="23" cy="-18" r="6" fill={PINK} opacity="0.85" />
            <circle cx="31" cy="-25" r="3.6" fill={GOLD} opacity="0.75" />
            <circle cx="30" cy="-11" r="3" fill="#22C55E" opacity="0.6" />
          </g>
        </Arm>
      </g>
    </g>
  );
}

/**
 * The shop's own artwork.
 *
 * A supplied picture is one flat image — its arms are painted on, so nothing
 * can swing them. It bobs, sways and tilts as a whole figure instead, which is
 * how a printed frieze reads anyway, and at a glance is indistinguishable from
 * a jointed puppet doing the same thing slowly.
 *
 * Each is given the same footprint and hung from the same baseline, so a tall
 * character and a short one still stand on one line.
 */
function SuppliedTroupe({ theme, characters }) {
  const W = 92;
  return (
    <svg
      className="fest-dancers"
      viewBox={`0 0 ${W * characters.length} 116`}
      role="img"
      aria-label={`${theme.label} characters`}
      preserveAspectRatio="xMidYMax meet"
    >
      {characters.map((c, i) => (
        <g key={c.id} transform={`translate(${i * W}, 0)`}>
          <g
            className="fdn-figure"
            style={{
              animationDelay: `${-(rnd(i * 3 + 1) * 1.8).toFixed(2)}s`,
              animationDuration: `${(1.6 + rnd(i * 3 + 2) * 0.7).toFixed(2)}s`,
            }}
          >
            {/* Anchored to the bottom of its box so figures of different
                heights share a floor rather than a centre line. */}
            <image
              href={c.url}
              x="4"
              y="0"
              width={W - 8}
              height="104"
              preserveAspectRatio="xMidYMax meet"
            />
          </g>
        </g>
      ))}
      <path
        d={`M 10 106 H ${W * characters.length - 10}`}
        stroke={theme.palette.accentDeep || theme.palette.accent}
        strokeOpacity="0.2"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
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
  lampgirl: (p) => <Girl {...p} carry="lamp" top={RED} topDark={RED_2} skirt={GOLD_2} skirtDark={GOLD_2} />,
  potgirl: (p) => <Girl {...p} carry="pot" top={GREEN} topDark={GREEN_2} skirt={RED} skirtDark={RED_2} />,
};

export default function FestivalDancers({ theme, animation, characters }) {
  if (!theme) return null;
  if (animation?.enabled === false) return null;

  /* Artwork the shop has supplied for this festival wins outright. The drawn
     figures are a decent default, not something to mix with a commissioned
     illustration — half drawn and half painted looks like a mistake. */
  const supplied = (characters || []).filter((c) => c.festival === theme.id && c.url);
  if (supplied.length) return <SuppliedTroupe theme={theme} characters={supplied.slice(0, 4)} />;

  const troupe = TROUPE[theme.id];
  if (!troupe?.length) return null;

  const W = 76;

  return (
    <svg
      className="fest-dancers"
      /* Headroom above: Maveli's umbrella and the dandiya sticks both reach
         well over their heads, and a box starting at zero clipped them. */
      viewBox={`0 -26 ${W * troupe.length} 130`}
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
          <g key={i} transform={`translate(${i * W + 4}, 0)`}>
            <Who style={style} i={i} />
          </g>
        );
      })}
      <path
        d={`M 10 101 H ${W * troupe.length - 10}`}
        stroke={theme.palette.accentDeep || theme.palette.accent}
        strokeOpacity="0.2"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
