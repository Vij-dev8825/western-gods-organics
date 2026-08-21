/**
 * Weather for the hero, once a festival is on.
 *
 * Petals drift down through Onam, embers rise through Deepavali, colour hangs
 * in the air at Holi. It sits over the hero video and nothing else, because a
 * page that is snowing everywhere is a page nobody can read — this is meant to
 * be noticed on arrival and then forgotten.
 *
 * Everything moves in CSS. There is no animation frame loop and no canvas, so
 * a phone with the tab open is not burning battery on twelve drifting petals;
 * the compositor handles it and the main thread never hears about it.
 *
 * Positions, sizes and delays are hashed from the index rather than rolled at
 * random, so nothing re-scatters on a re-render and the arrangement is the
 * same one the designer looked at. Delays are negative, so the petals are
 * already mid-fall when the page arrives instead of all starting at the top
 * together.
 *
 * It renders nothing under Reduce Motion — not a hidden layer, nothing at all,
 * so the sprites are never even fetched. The stylesheet hides it too, in case
 * this component is ever rendered somewhere that has not checked.
 */
import { useEffect, useState } from 'react';

/** Deterministic 0..1 from an integer. Same hash the motifs use. */
function rnd(i) {
  let x = Math.imul(i ^ 0x9e3779b9, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

/** The flowers that fall for Onam — the shop's own photographs, the same ones
 *  the pookalam is laid with. Light, small-petalled ones only: a sunflower
 *  tumbling past the hero looks like a bug, not a blessing. */
const PETALS = [
  'chendumalli', 'jamanthi', 'red-chethi', 'mulla',
  'vadamalli', 'golden-hibiscus', 'shankhupushpam',
];

/** Which weather each festival gets. Anything not listed gets none, which is
 *  the right answer — a generic shimmer on a festival nobody designed for
 *  looks like a rendering fault. */
const WEATHER = {
  onam: 'petals',
  vishu: 'petals',
  deepavali: 'embers',
  karthigai: 'embers',
  holi: 'colour',
  pongal: 'embers',
};

const GULAL = ['#FF2D8A', '#FF8A00', '#22C55E', '#2E7DF7', '#8B5CF6', '#F5D90A'];

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(
    () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
  );
  useEffect(() => {
    if (typeof matchMedia !== 'function') return undefined;
    const mq = matchMedia('(prefers-reduced-motion: reduce)');
    const on = () => setReduced(mq.matches);
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, []);
  return reduced;
}

export default function FestivalAtmosphere({ theme }) {
  const reduced = usePrefersReducedMotion();
  if (reduced || !theme) return null;

  const kind = WEATHER[theme.id];
  if (!kind) return null;

  const count = kind === 'colour' ? 9 : 14;

  return (
    <div className={`fest-weather fest-weather-${kind}`} aria-hidden="true">
      {Array.from({ length: count }, (_, i) => {
        /* Four independent hashes per particle so size does not correlate with
           position — one seed reused would line them up on a diagonal. */
        const left = rnd(i * 4 + 1) * 100;
        const dur = 11 + rnd(i * 4 + 2) * 13;
        const delay = -rnd(i * 4 + 3) * dur;
        const scale = 0.55 + rnd(i * 4 + 4) * 0.75;
        const drift = (rnd(i * 4 + 5) * 2 - 1) * 60;

        const style = {
          left: `${left}%`,
          animationDuration: `${dur}s`,
          animationDelay: `${delay}s`,
          '--drift': `${drift}px`,
          '--scale': scale,
          '--spin': `${(rnd(i * 4 + 6) * 2 - 1) * 320}deg`,
        };

        if (kind === 'petals') {
          const flower = PETALS[i % PETALS.length];
          return (
            <img
              key={i}
              className="fest-petal"
              src={`/flowers/${flower}.webp`}
              alt=""
              /* Eager: these are in the hero, above the fold and visible on
                 arrival. Lazy-loading them only delays the one moment they
                 are meant to be seen, and pops them in afterwards. */
              loading="eager"
              decoding="async"
              width="34"
              height="34"
              style={style}
              /* A name that does not match a file put two broken-image squares
                 in the hero. Decoration must fail invisibly — one petal fewer
                 is nothing, a broken icon over the headline is a defect. */
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          );
        }

        if (kind === 'colour') {
          return (
            <span
              key={i}
              className="fest-puff"
              style={{ ...style, background: GULAL[i % GULAL.length] }}
            />
          );
        }

        return (
          <span
            key={i}
            className="fest-ember"
            style={{ ...style, background: theme.palette.glow }}
          />
        );
      })}
    </div>
  );
}
