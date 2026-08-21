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

/**
 * What falls, rises or bursts for each festival.
 *
 * Every entry in the registry has one, so no festival arrives with a bare
 * hero. They are drawn from five effects rather than eighteen bespoke ones —
 * the point is that the sky matches the day, not that each has its own
 * engine — and each festival is mapped to the one that is true of it:
 * flowers where flowers are laid, sparks where lamps are lit, crackers where
 * crackers are let off, colour at Holi, and a quiet glint for the days whose
 * character is light rather than noise.
 */
const WEATHER = {
  /* Flowers are laid, so flowers fall. */
  onam: 'petals',
  vishu: 'petals',
  bihu: 'petals',
  newyear: 'petals',

  /* Deepavali is the one night of the year the sky is full of them. */
  deepavali: 'crackers',

  /* Lamps and fires: sparks going up, not down. */
  karthigai: 'embers',
  gurpurab: 'embers',
  chhath: 'embers',
  pongal: 'embers',

  holi: 'colour',

  /* Days of light and ceremony rather than noise — a slow glint is enough,
     and anything busier would be putting fireworks over a prayer. */
  vinayagar: 'sparkle',
  navratri: 'sparkle',
  ayudha: 'sparkle',
  rakhi: 'sparkle',
  eid: 'sparkle',
  christmas: 'sparkle',
  shivratri: 'sparkle',
  krishna: 'sparkle',
  aadi: 'sparkle',
  generic: 'sparkle',
};

/** Firework colours. Deliberately not the festival palette: a cracker is not
 *  brand-coloured, and a sky of nothing but marigold reads as a bug. */
const SPARK_COLOURS = ['#FFD24A', '#FF6A2B', '#FF3D6E', '#5EC8FF', '#B57BFF', '#8CFF6A'];

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

/**
 * `variant` picks where this is being hung.
 *
 *   ambient  (default) fixed to the viewport and painted behind every page,
 *            so the weather follows you around the shop. Held well back,
 *            because most of the site is cream and reading happens on top.
 *   hero     absolute inside the hero, above its video and below its
 *            headline. The ambient layer cannot be seen there at all — the
 *            hero video is opaque and paints over anything at z-index -1 —
 *            so the home page hangs its own.
 */
export default function FestivalAtmosphere({ theme, variant = 'ambient' }) {
  const reduced = usePrefersReducedMotion();
  if (reduced || !theme) return null;

  const kind = WEATHER[theme.id];
  if (!kind) return null;

  /* Crackers are bursts, not particles — four going off at different moments
     reads as a sky, and more reads as a wall. */
  const count = kind === 'crackers' ? 5 : kind === 'colour' ? 9 : 14;

  return (
    <div className={`fest-weather fest-weather-${variant} fest-weather-${kind}`} aria-hidden="true">
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

        if (kind === 'crackers') {
          /* A burst is a point with twelve streaks flying out of it. The
             container blinks on its own cycle; the streaks inside carry the
             angle they travel along. */
          return (
            <span
              key={i}
              className="fest-burst"
              style={{
                left: `${8 + rnd(i * 4 + 1) * 84}%`,
                top: `${6 + rnd(i * 4 + 2) * 45}%`,
                animationDuration: `${2.6 + rnd(i * 4 + 3) * 2.4}s`,
                animationDelay: `${-rnd(i * 4 + 4) * 4}s`,
                color: SPARK_COLOURS[i % SPARK_COLOURS.length],
                '--scale': 0.7 + rnd(i * 4 + 5) * 0.7,
              }}
            >
              {/* The flash the streaks come out of. Without it a burst reads
                  as a ring of dots rather than something that went off. */}
              <b />
              {Array.from({ length: 12 }, (_, k) => (
                <i key={k} style={{ '--a': `${k * 30}deg`, '--d': `${52 + rnd(i * 13 + k) * 34}px` }} />
              ))}
            </span>
          );
        }

        if (kind === 'sparkle') {
          return (
            <span
              key={i}
              className="fest-glint"
              style={{
                ...style,
                top: `${5 + rnd(i * 4 + 7) * 80}%`,
                background: theme.palette.glow,
              }}
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
