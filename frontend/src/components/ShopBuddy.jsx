/** A small cartoon mascot for the shopping guide — an oil bottle with a
 * face, on-brand rather than a generic shopping-cart character, matching
 * the same hand-drawn-SVG-plus-CSS-keyframes style as ChakkiWheel and the
 * festival motifs elsewhere in this app (no animation library anywhere in
 * this codebase, this doesn't start). `cheer` mode (both arms up) is meant
 * for the moment someone finishes the guide, paired with the confetti burst
 * in HowToShop.jsx — everywhere else it just waves and idles. */
export default function ShopBuddy({ mood = 'wave', className = '' }) {
  const cheering = mood === 'cheer';
  return (
    <svg viewBox="0 0 100 130" className={`shop-buddy ${className}`} aria-hidden="true">
      {/* cap */}
      <rect x="38" y="4" width="24" height="13" rx="4" fill="#5b3a14" />
      {/* neck */}
      <rect x="42" y="15" width="16" height="10" fill="#e8b84b" />
      {/* leaf */}
      <path d="M50 4 C 45 -5, 35 -3, 35 6 C 35 12, 45 12, 50 4 Z" fill="#4a8f42" />
      {/* body */}
      <rect x="18" y="24" width="64" height="78" rx="24" fill="#e8b84b" stroke="#a76a0a" strokeWidth="2" />
      {/* label band */}
      <rect x="18" y="54" width="64" height="22" fill="#fffdf6" opacity="0.92" />
      <rect x="30" y="61" width="40" height="3" rx="1.5" fill="#a76a0a" opacity="0.5" />
      {/* face */}
      <circle cx="37" cy="42" r="4" fill="#3a2410" />
      <circle cx="63" cy="42" r="4" fill="#3a2410" />
      <path d="M38 50 Q50 59 62 50" stroke="#3a2410" strokeWidth="3" fill="none" strokeLinecap="round" />
      {/* cheeks */}
      <circle cx="28" cy="48" r="4" fill="#d1495b" opacity="0.28" />
      <circle cx="72" cy="48" r="4" fill="#d1495b" opacity="0.28" />
      {/* left arm — stays down in both moods */}
      <path
        d="M20 82 Q2 88 6 106"
        stroke="#a76a0a"
        strokeWidth="7"
        fill="none"
        strokeLinecap="round"
        className={cheering ? 'shop-buddy-arm-left-cheer' : 'shop-buddy-arm-left'}
      />
      {/* right arm — waves normally, thrown up when cheering */}
      <path
        d={cheering ? 'M80 82 Q98 62 90 40' : 'M80 82 Q98 74 92 54'}
        stroke="#a76a0a"
        strokeWidth="7"
        fill="none"
        strokeLinecap="round"
        className={cheering ? '' : 'shop-buddy-arm-right'}
      />
    </svg>
  );
}
