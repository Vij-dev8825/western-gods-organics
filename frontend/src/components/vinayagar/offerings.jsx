/**
 * The things you put on the leaf.
 *
 * Each offering is drawn around its own origin at roughly 40x40 units, so the
 * board can drop one anywhere by translating and scaling a single <g>. Nothing
 * here knows where it will end up, which is what lets the same drawing serve
 * the tray thumbnail and the placed item on the leaf.
 *
 * Drawn rather than photographed, and drawn plainly. These are ritual objects:
 * a modakam that reads as a modakam is worth more here than a glossy one.
 */

/* Ghee-lamp flame, shared by the deepam and used on its own nowhere else. */
function Flame({ y = -14 }) {
  return (
    <g>
      <path
        d={`M 0 ${y} c 5 4 6 9 3 12 c -2 2 -4 2 -6 0 c -3 -3 -2 -8 3 -12 z`}
        fill="#f7c85a"
      />
      <path
        d={`M 0 ${y + 4} c 2.5 2.5 3 5.5 1.4 7.2 c -1 1 -1.8 1 -2.8 0 c -1.6 -1.7 -1.1 -4.7 1.4 -7.2 z`}
        fill="#fff3cd"
      />
    </g>
  );
}

export function Modakam() {
  const w = 11;
  const h = 14;
  return (
    <g>
      <path
        d={`M 0 ${-h}
            c ${w * 0.5} ${h * 0.35} ${w} ${h * 0.6} ${w} ${h}
            l ${-w * 2} 0
            c 0 ${-h * 0.4} ${w * 0.5} ${-h * 0.65} ${w} ${-h} z`}
        fill="#f6ead1"
        stroke="#d9c49a"
        strokeWidth="0.9"
      />
      {/* Pleats converging at the tip — what makes it a modakam and not a cone. */}
      {[-0.55, -0.18, 0.18, 0.55].map((f) => (
        <path
          key={f}
          d={`M 0 ${-h} L ${w * f} 0`}
          stroke="#ddc9a3"
          strokeWidth="0.7"
          fill="none"
        />
      ))}
      <circle cx="0" cy={-h + 1.6} r="1.8" fill="#e0562d" />
    </g>
  );
}

export function Arukampul() {
  /* Durva grass, offered in threes. Blades splay from a single point. */
  return (
    <g>
      {[-1, -0.4, 0.3, 1].map((dir, i) => (
        <path
          key={i}
          d={`M 0 0 q ${dir * 7} -9 ${dir * 10} -19`}
          stroke={i % 2 ? '#5f9a3f' : '#4f8a3a'}
          strokeWidth="1.9"
          fill="none"
          strokeLinecap="round"
        />
      ))}
    </g>
  );
}

export function Hibiscus() {
  /* Sembaruthi — the red flower that belongs to Ganesha. Five petals. */
  return (
    <g>
      {[0, 1, 2, 3, 4].map((i) => (
        <ellipse
          key={i}
          cx="0"
          cy="-8"
          rx="6"
          ry="9"
          fill={i % 2 ? '#d8402c' : '#e0562d'}
          transform={`rotate(${i * 72})`}
        />
      ))}
      <circle cx="0" cy="0" r="3.2" fill="#f7c85a" />
      {/* The stamen, which is the part of a hibiscus everyone actually pictures. */}
      <path d="M 0 0 q 2 -9 1 -14" stroke="#b8362a" strokeWidth="1.2" fill="none" />
      <circle cx="1" cy="-14" r="1.6" fill="#ffe9a8" />
    </g>
  );
}

export function Deepam() {
  return (
    <g>
      <Flame y={-13} />
      {/* Clay dish, wider than it is deep, with the lip drawn out for the wick. */}
      <path
        d="M -13 0 q 13 9 26 0 q -4 6 -13 6 q -9 0 -13 -6 z"
        fill="#b8632f"
        stroke="#8f4a22"
        strokeWidth="0.9"
      />
      <path d="M -13 0 q 13 5 26 0" stroke="#e0562d" strokeWidth="1.1" fill="none" />
    </g>
  );
}

export function Coconut() {
  /* Broken in half and set cut-side up, which is how it is offered. */
  return (
    <g>
      <path
        d="M -12 0 a 12 12 0 0 1 24 0 z"
        fill="#8f5a33"
        stroke="#6f4324"
        strokeWidth="1"
        transform="rotate(180)"
      />
      <ellipse cx="0" cy="0" rx="12" ry="3.4" fill="#f4ece0" />
      <ellipse cx="0" cy="0" rx="8.5" ry="2.2" fill="#e6d8c4" />
    </g>
  );
}

export function Banana() {
  return (
    <g>
      <path
        d="M -11 2 q 3 -13 15 -15 q -5 5 -4 10 q -1 7 -11 5 z"
        fill="#f2c744"
        stroke="#cfa326"
        strokeWidth="0.9"
      />
      <path d="M -8 1 q 3 -9 11 -12" stroke="#e0b63a" strokeWidth="1" fill="none" />
    </g>
  );
}

export function BetelLeaf() {
  /* Vettrilai with a supari on top — always offered as a pair. */
  return (
    <g>
      <path
        d="M 0 -16 q 12 8 10 17 q -2 8 -10 8 q -8 0 -10 -8 q -2 -9 10 -17 z"
        fill="#4f8a3a"
        stroke="#3b6b29"
        strokeWidth="1"
      />
      <path d="M 0 -13 L 0 8" stroke="#7cb057" strokeWidth="1.1" />
      {[-1, 1].map((d) => (
        <path key={d} d={`M 0 -4 q ${d * 6} 2 ${d * 7} 7`} stroke="#7cb057" strokeWidth="0.8" fill="none" />
      ))}
      <circle cx="0" cy="1" r="3.4" fill="#a4552a" />
    </g>
  );
}

export function Kumkum() {
  /* A mound of it, with the thumb-press that is always in the middle. */
  return (
    <g>
      <path d="M -10 2 q 10 -12 20 0 z" fill="#c62828" />
      <ellipse cx="0" cy="2" rx="10" ry="2.6" fill="#8e1f1f" />
      <ellipse cx="0" cy="-1.5" rx="2.6" ry="1.5" fill="#8e1f1f" opacity="0.65" />
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
      {lit && <ellipse cx="0" cy="-16" rx="46" ry="40" fill="#f7c85a" opacity="0.16" />}
      <ellipse cx="0" cy="-28" rx="19" ry="16" fill="#b8632f" />
      <ellipse cx="-22" cy="-27" rx="9" ry="13" fill="#a4552a" />
      <ellipse cx="22" cy="-27" rx="9" ry="13" fill="#a4552a" />
      {/* Trunk, curling to his left. */}
      <path
        d="M 0 -21 q 3 15 -9 19 q -9 3 -9 -6"
        stroke="#a4552a"
        strokeWidth="6"
        fill="none"
        strokeLinecap="round"
      />
      <path d="M -20 -11 q 12 15 40 0 q 5 15 -20 18 q -25 -3 -20 -18 z" fill="#b8632f" />
      {/* Crown and tilak. */}
      <path d="M -10 -42 l 10 -14 l 10 14 z" fill="#f7c85a" />
      <circle cx="0" cy="-57" r="2.6" fill="#e0562d" />
      <path d="M 0 -36 l 0 7" stroke="#8f4a22" strokeWidth="2" strokeLinecap="round" />
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
