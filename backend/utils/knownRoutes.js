/**
 * Which URLs this site actually has.
 *
 * The SPA catch-all in server.js answers *every* path that isn't /api or
 * /uploads with index.html and a 200. That is right for the routes React knows
 * about and wrong for everything else: /xyzzy, /favicon.ico, a product that was
 * deleted, a mistyped link in someone's WhatsApp forward — all of them came
 * back "200 OK, here is a page". A crawler reading that learns the site has an
 * unlimited number of pages, all with the same title and the same body, and
 * none of them real. Google calls this a soft 404, spends crawl budget
 * discovering more of them, and trusts what it finds here less for it — which
 * is the last thing a site that is not yet indexed can afford.
 *
 * So the shape of the URL is checked before the shell is served. A path React
 * has a route for still gets index.html and a 200, exactly as before. Anything
 * else gets the same HTML with a 404 status — the visitor still sees the app's
 * own not-found page, and the crawler is told the truth about the URL.
 *
 * Kept deliberately in step with the <Route path> list in frontend/src/App.jsx:
 * a route added there and forgotten here starts returning 404 to search engines
 * while still looking fine in a browser, which is a silent failure. The test in
 * knownRoutes.test.js reads App.jsx and fails if the two drift apart.
 */

// Exact paths — one entry per non-parameterised <Route path> in App.jsx.
const STATIC_ROUTES = new Set([
  '/',
  // Storefront
  '/shop',
  '/categories',
  '/combos',
  '/gifting',
  '/blog',
  '/guides',
  '/guide',
  '/finder',
  '/bulk-enquiry',
  '/contact',
  '/import',
  '/store-locator',
  '/impact',
  '/pressings',
  '/sourcing',
  '/our-story',
  '/whats-new',
  '/how-to-use',
  '/how-to-shop',
  '/getting-started',
  '/festivals',
  '/onam',
  '/vinayagar',
  '/sellers',
  '/sell-with-us',
  // Policy
  '/policy',
  '/refund-policy',
  '/terms',
  // Account (robots.txt already disallows most of these; they are still real
  // pages, and a signed-in visitor reaching one must not get a 404)
  '/login',
  '/cart',
  '/wishlist',
  '/profile',
  '/orders',
  '/notifications',
  '/subscriptions',
  '/rewards',
  '/gift-cards',
  '/affiliate',
  '/feedback',
]);

// `/thing/:param` routes — a single extra non-empty segment is a real URL.
// Whether the *record* behind it exists is a separate question, answered by
// resolveRouteStatus below for the two that a crawler can reach from outside.
const DYNAMIC_PARENTS = new Set([
  '/product',
  '/blog',
  '/sellers',
  '/batch',
  '/invoice',
  '/order-success',
  '/feedback',
]);

// Areas with their own nested router inside the React app, where the parent
// owns every path beneath it and this module cannot enumerate them.
const SUBTREE_PREFIXES = ['/admin', '/seller'];

/** Trailing slashes and a missing leading slash are the same URL to a visitor;
 * they should not be the difference between 200 and 404. */
function normalise(pathname) {
  let p = String(pathname || '/');
  if (!p.startsWith('/')) p = `/${p}`;
  if (p.length > 1 && p.endsWith('/')) p = p.replace(/\/+$/, '');
  return p || '/';
}

/** True when React has a route that will render something for this path.
 * Structural only — no database, no I/O, safe to call on every request. */
function isKnownRoute(pathname) {
  const p = normalise(pathname);
  if (STATIC_ROUTES.has(p)) return true;
  if (SUBTREE_PREFIXES.some((prefix) => p === prefix || p.startsWith(`${prefix}/`))) return true;

  const segments = p.split('/').filter(Boolean);
  if (segments.length === 2 && DYNAMIC_PARENTS.has(`/${segments[0]}`)) return true;

  return false;
}

module.exports = { isKnownRoute, normalise, STATIC_ROUTES, DYNAMIC_PARENTS, SUBTREE_PREFIXES };
