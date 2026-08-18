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

/** Checked per call, not once at import: someone can turn on "reduce motion"
 *  while the tab is open, and a shop should respect that immediately. */
export function canAnimateTransitions() {
  return (
    typeof document !== 'undefined' &&
    typeof document.startViewTransition === 'function' &&
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches
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
