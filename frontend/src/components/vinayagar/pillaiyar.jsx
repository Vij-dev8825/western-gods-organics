/**
 * Vinayagar, as a supplied illustration.
 *
 * Declared once as a <symbol> and placed with <use>, the same way the eight
 * offerings are, for the same two reasons: a caller can size it with one
 * transform, and the picture data appears once in the copy the share export
 * rasterises no matter how many times it is drawn.
 *
 * That last part is load-bearing. A serialised SVG is rasterised from a blob
 * URL, and a blob-URL document will not fetch anything external — an <image>
 * pointing at /assets/… inside one renders as nothing at all, silently. The
 * board's share() walks the clone and inlines every <image> as a data URI
 * before serialising, and this symbol is picked up by that same pass.
 *
 * Lives in its own file so the homepage festival motif can use the figure
 * without pulling in the eight offering photographs that offerings.jsx
 * imports.
 *
 * Drawn around its own origin, spanning roughly x -30..30 and y -84..12, so a
 * caller places it with a translate and scales it with one transform — the
 * same footprint the drawn figure had, so neither call site had to move.
 */

import pillaiyarImg from '../../assets/vinayagar/pillaiyar.png';

/* Intrinsic size of the cut-out, so the symbol's viewBox matches it and
 * nothing is stretched. Kept at 280px tall deliberately: the source was a
 * 173px thumbnail, so anything larger is bytes with no detail behind them —
 * an earlier 420px version cost 225 kB against this one's 24 kB and looked
 * identical. 280 still covers the largest this is ever drawn, which is the
 * share export rasterising the board at twice size. */
const ART = { w: 174, h: 280 };
const DRAW_H = 96;
const DRAW_W = DRAW_H * (ART.w / ART.h);

export function PillaiyarDefs() {
  return (
    <>
      <symbol id="vinPillaiyar" viewBox={`0 0 ${ART.w} ${ART.h}`}>
        <image href={pillaiyarImg} x="0" y="0" width={ART.w} height={ART.h} />
      </symbol>
      <radialGradient id="vinLineHalo" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0%" stopColor="#f7c85a" stopOpacity="0.5" />
        <stop offset="100%" stopColor="#f7c85a" stopOpacity="0" />
      </radialGradient>
    </>
  );
}

/** Named for the line drawing it replaced, because both call sites already
 * import it under this name and the shape of the thing has not changed. */
export function PillaiyarLine({ lit = false }) {
  return (
    <g>
      {lit && <circle cx="0" cy="-36" r="74" fill="url(#vinLineHalo)" />}
      {/* Stands on something rather than floating. */}
      <ellipse cx="0" cy="12" rx={DRAW_W * 0.34} ry="4" fill="#2a1a12" opacity="0.16" />
      <use href="#vinPillaiyar" x={-DRAW_W / 2} y={12 - DRAW_H} width={DRAW_W} height={DRAW_H} />
    </g>
  );
}
