/* Cross-page morph for the product photograph.
 *
 * Tapping a product card grows its photo into the product page's hero image
 * rather than replacing one page with another. The browser does the
 * interpolation: give the same `view-transition-name` to an element on the
 * outgoing page and an element on the incoming one, and it tweens the two
 * boxes into each other.
 *
 * Why this is hand-rolled rather than <Link viewTransition>: React Router
 * ships that prop, but the code that actually calls startViewTransition lives
 * inside RouterProvider — the data router. This app mounts <BrowserRouter>,
 * where the option is accepted and then never read, so the prop would be
 * silently inert. Migrating the router to fix an animation is not a trade
 * worth making, so we drive the API directly.
 */

/** Applied as a class rather than an inline style because the *incoming* page
 *  has to carry the name during its own synchronous render — the browser
 *  snapshots immediately after the update callback returns, long before any
 *  effect could run. A class in JSX is there from the first commit; an
 *  imperative tag would arrive too late. */
export const HERO_CLASS = 'vt-product-hero';

/** One name, reused for whichever photo is currently making the journey.
 *  A per-product name would seem tidier but breaks the moment a product
 *  appears twice — the related-products row on a product page can show the
 *  item that is already the hero above it. */
export function claimHero(el) {
  // Exactly one element may hold the name. Two sharing it aborts the whole
  // transition and the page jump-cuts instead, so take it off everyone else
  // first — including the hero of the page being left, which is exactly the
  // collision a related-product tap would otherwise cause.
  document.querySelectorAll('.' + HERO_CLASS).forEach((node) => {
    if (node !== el) node.classList.remove(HERO_CLASS);
  });
  if (el) el.classList.add(HERO_CLASS);
}

/** The one question that outranks everything else here. Checked per call, not
 *  once at import: someone can turn this on while the tab is open — and on
 *  Android, Battery Saver turns it on for them — so a shop should respect it
 *  immediately rather than at page load. */
export function motionAllowed() {
  return (
    typeof window !== 'undefined' &&
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/** Whether the *native* path is available. Safari only shipped View
 *  Transitions in 18.2, so a large share of real iPhones answer no — hence
 *  flipFrom below, which does the same job with an API Safari has had since
 *  13. */
export function canAnimateTransitions() {
  return (
    typeof document !== 'undefined' &&
    typeof document.startViewTransition === 'function' &&
    motionAllowed()
  );
}

/** The same morph, done by hand, for every browser without View Transitions.
 *
 *  FLIP: the element is already sitting where it belongs (Last), so put it
 *  back where it came from with a transform (Invert) and animate that away
 *  (Play). Nothing reflows — it is one composited transform — and because the
 *  element is really in its final position the whole time, layout, taps and
 *  scrolling are all correct from the first frame.
 *
 *  Returns the animation, or null when it declined: no element, no source
 *  rectangle, motion turned off, or the two boxes already close enough that
 *  animating between them would only look like a twitch. */
export function flipFrom(el, from, { duration = 340 } = {}) {
  if (!el || !from || !motionAllowed()) return null;
  if (typeof el.animate !== 'function') return null;

  const to = el.getBoundingClientRect();
  if (!to.width || !to.height || !from.width || !from.height) return null;

  const dx = from.left - to.left;
  const dy = from.top - to.top;
  const sx = from.width / to.width;
  const sy = from.height / to.height;
  if (![dx, dy, sx, sy].every(Number.isFinite)) return null;
  // Below this the movement is indistinguishable from a flicker.
  if (Math.abs(dx) < 2 && Math.abs(dy) < 2 && Math.abs(sx - 1) < 0.02 && Math.abs(sy - 1) < 0.02) {
    return null;
  }

  // transform-origin is pinned to the corner the offsets were measured from
  // and held constant across both frames. Left at its default centre, the
  // scale would pull away from the middle and the arithmetic above would be
  // describing a different box than the one that actually moves.
  return el.animate(
    [
      {
        transformOrigin: 'top left',
        transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`,
        opacity: 0.85,
      },
      { transformOrigin: 'top left', transform: 'none', opacity: 1 },
    ],
    {
      duration,
      // Travels fast, settles slow — the shape of something arriving rather
      // than something being played.
      easing: 'cubic-bezier(0.32, 0.72, 0, 1)',
    }
  );
}

/** Runs `update` inside a view transition where the browser supports one, and
 *  plainly where it doesn't — so an unsupporting browser still navigates, it
 *  just cuts instead of tweening. Returns the transition, or null if none was
 *  started. */
export function runViewTransition(update) {
  if (!canAnimateTransitions()) {
    update();
    return null;
  }
  return document.startViewTransition(update);
}
