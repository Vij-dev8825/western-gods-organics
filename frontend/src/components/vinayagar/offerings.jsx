/**
 * The things you put on the leaf.
 *
 * Each offering is a photograph, cut out of its white background and declared
 * once as an SVG <symbol>. Placing one is a <use> referencing that symbol, so
 * twenty-one modakam on the leaf cost one copy of the image rather than
 * twenty-one — which matters both for the DOM and, much more, for the share
 * export, where the picture data has to be inlined as a data URI and every
 * duplicate would be paid for in full.
 *
 * Symbols rather than bare <image> elements because <use> only honours width
 * and height when what it points at establishes its own viewport. An <image>
 * in <defs> would be positioned but not resized.
 *
 * Vinayagar is still drawn, not photographed — see Pillaiyar at the bottom.
 *
 * The cut-outs were made by flood-filling inward from the border rather than
 * thresholding on white, because the modakam is itself cream-white and a
 * global threshold would have eaten straight through it. See backend/_cutout.js
 * in the commit that added these.
 */

import deepamImg from '../../assets/vinayagar/deepam.png';
import betelImg from '../../assets/vinayagar/betel.png';
import coconutImg from '../../assets/vinayagar/coconut.png';
import bananaImg from '../../assets/vinayagar/banana.png';
import kumkumImg from '../../assets/vinayagar/kumkum.png';
import hibiscusImg from '../../assets/vinayagar/hibiscus.png';
import arukampulImg from '../../assets/vinayagar/arukampul.png';
import modakamImg from '../../assets/vinayagar/modakam.png';

/* Intrinsic pixel size of each cut-out, so the symbol's viewBox matches its
 * image and nothing is stretched. `h` is how tall the thing is drawn on the
 * leaf, in board units; the width follows from the aspect ratio. They are not
 * all the same, because a coconut next to a blade of grass should not be. */
const ART = {
  deepam: { src: deepamImg, w: 178, h: 189, draw: 34 },
  betel: { src: betelImg, w: 174, h: 189, draw: 30 },
  coconut: { src: coconutImg, w: 199, h: 187, draw: 33 },
  banana: { src: bananaImg, w: 201, h: 193, draw: 27 },
  kumkum: { src: kumkumImg, w: 151, h: 168, draw: 31 },
  hibiscus: { src: hibiscusImg, w: 198, h: 184, draw: 30 },
  arukampul: { src: arukampulImg, w: 201, h: 199, draw: 34 },
  modakam: { src: modakamImg, w: 217, h: 185, draw: 30 },
};

/** Every symbol and gradient the board needs, rendered once inside it. */
export function OfferingDefs() {
  return (
    <defs>
      {Object.entries(ART).map(([id, a]) => (
        <symbol key={id} id={`vinArt-${id}`} viewBox={`0 0 ${a.w} ${a.h}`}>
          <image href={a.src} x="0" y="0" width={a.w} height={a.h} />
        </symbol>
      ))}

      {/* Brass, for the murti. Warmer and lighter than terracotta, so the
          figure reads as metal rather than clay. */}
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

      {/* The banana leaf the whole board is served on, and the floor under it.
          Colours taken off a photograph of a real one: much yellower and
          lighter than the forest green this used to be, and brightest along
          the midrib where the blade catches the light. */}
      <linearGradient id="vinServingLeaf" x1="0.08" y1="0" x2="0.55" y2="1">
        <stop offset="0%" stopColor="#7fb93f" />
        <stop offset="30%" stopColor="#9ccb52" />
        <stop offset="52%" stopColor="#86bd45" />
        <stop offset="100%" stopColor="#4e8a2e" />
      </linearGradient>
      {/* The ribs. A banana leaf is covered in fine parallel veins running out
          from the midrib, and without them a green lens just reads as a dish.
          Done as a pattern rather than a few hundred drawn lines: one tile,
          repeated, and it costs nothing in the serialised copy the share
          export rasterises. */}
      <pattern id="vinRibs" width="5" height="12" patternUnits="userSpaceOnUse">
        <line x1="1" y1="0" x2="1" y2="12" stroke="#3f7a25" strokeWidth="0.9" opacity="0.34" />
        <line x1="3.4" y1="0" x2="3.4" y2="12" stroke="#cfe9a0" strokeWidth="0.6" opacity="0.3" />
      </pattern>
      <radialGradient id="vinFloor" cx="0.5" cy="0.42" r="0.68">
        <stop offset="0%" stopColor="#fbeedd" />
        <stop offset="100%" stopColor="#f0dcc4" />
      </radialGradient>
    </defs>
  );
}

/** One offering, drawn around its own origin so the board can drop it anywhere
 * by translating a single <g>. Sits on a soft contact shadow — drawn as an
 * ellipse rather than a blur filter, because a filter on twenty-one instances
 * is the one thing that would make a full leaf stutter on a phone. */
function Art({ id }) {
  const a = ART[id];
  const h = a.draw;
  const w = h * (a.w / a.h);
  return (
    <g>
      <ellipse cx="0" cy="1" rx={w * 0.4} ry={2.6} fill="#2a1a12" opacity="0.18" />
      <use href={`#vinArt-${id}`} x={-w / 2} y={-h} width={w} height={h} />
    </g>
  );
}

export const Deepam = () => <Art id="deepam" />;
export const BetelLeaf = () => <Art id="betel" />;
export const Coconut = () => <Art id="coconut" />;
export const Banana = () => <Art id="banana" />;
export const Kumkum = () => <Art id="kumkum" />;
export const Hibiscus = () => <Art id="hibiscus" />;
export const Arukampul = () => <Art id="arukampul" />;
export const Modakam = () => <Art id="modakam" />;

/**
 * Vinayagar himself — fixed at the head of the leaf, never placed by the
 * player. Drawn rather than photographed, and deliberately so: you do not drag
 * a deity around a screen, and a cut-out of someone else's murti is not ours
 * to put here. Modelled on a cast brass figure — seated with the knees pushed
 * out either side of the belly, four arms, wide fan ears, a tapering mukuta
 * with a medallion and finial, one tusk broken as it always is, eyes downcast.
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
      <ellipse cx="-9" cy="1.5" rx="5" ry="3" fill="#e0b160" opacity="0.75" />
      <ellipse cx="9" cy="1.5" rx="5" ry="3" fill="#e0b160" opacity="0.75" />

      {/* Four arms: the back pair raised, the front pair resting forward. */}
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

      {/* Head and trunk. A trunk drawn straight reads as a snout, so it ends
          curled. */}
      <ellipse cx="0" cy="-40" rx="18" ry="15.5" fill="url(#vinBrass)" />
      <path
        d="M 0 -33 q 1.5 11 -6 16 q -8 5 -11 -1.5 q -2 -4.5 3.5 -5.5"
        stroke="url(#vinBrass)"
        strokeWidth="6.2"
        fill="none"
        strokeLinecap="round"
      />
      <path d="M -7.5 -32 q -2 4 -0.5 6.5" stroke="#fdf6e4" strokeWidth="2.2" fill="none" strokeLinecap="round" />
      <path d="M 7.5 -32 q 2 3 1 4.5" stroke="#fdf6e4" strokeWidth="2.2" fill="none" strokeLinecap="round" opacity="0.9" />
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
