/**
 * Minimal pub-sub connecting the lazy-route Suspense fallback (App.jsx's
 * RouteFallback, mounted once per layout's <Outlet>) to the top progress bar
 * (TopProgressBar, mounted once at the app root, outside any Suspense
 * boundary so it can never itself be the thing that's loading). They're
 * necessarily separate components — one lives inside the boundary that
 * suspends, one deliberately doesn't — so a plain window event is simpler
 * here than threading state through context for two possible signals.
 *
 * A counter, not a boolean: nested Suspense boundaries (a layout's own
 * Outlet-level one, plus the top-level one behind it) can both be in flight
 * briefly during a cross-layout navigation, and the bar should only
 * disappear once every one of them has resolved.
 */
let pending = 0;

export function startRouteLoad() {
  pending += 1;
  window.dispatchEvent(new CustomEvent('route-load-start'));
}

export function endRouteLoad() {
  pending = Math.max(0, pending - 1);
  if (pending === 0) window.dispatchEvent(new CustomEvent('route-load-end'));
}
