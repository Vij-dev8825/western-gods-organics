/**
 * knownRoutes.js decides which URLs answer 200 and which answer 404. It is a
 * hand-written copy of the route table in frontend/src/App.jsx, and the failure
 * mode when the two drift apart is silent: a page added to the React app but
 * not here keeps working perfectly in a browser while quietly telling every
 * search engine it does not exist.
 *
 * So this reads App.jsx and checks the real thing, rather than a second
 * hand-written list that could drift in its own right.
 *
 * Run: node --test backend/utils/
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const { isKnownRoute, normalise } = require('./knownRoutes');

const APP_JSX = path.join(__dirname, '..', '..', 'frontend', 'src', 'App.jsx');

/** Every absolute `<Route path="...">` in App.jsx. Relative paths (the nested
 * admin/seller children, e.g. "orders") are skipped — they resolve under a
 * parent that SUBTREE_PREFIXES already covers wholesale. "*" is the app's own
 * catch-all, which is precisely the case that should 404. */
function routePathsFromApp() {
  const src = fs.readFileSync(APP_JSX, 'utf8');
  return [...src.matchAll(/<Route\s+[^>]*path="([^"]+)"/g)]
    .map((m) => m[1])
    .filter((p) => p.startsWith('/'));
}

/** "/product/:id" -> "/product/sample-id", so the path can be tested as a URL. */
function withSampleParams(routePath) {
  return routePath.replace(/:[^/]+/g, 'sample-id');
}

test('App.jsx declares at least the routes we expect to find', () => {
  const paths = routePathsFromApp();
  assert.ok(paths.length > 20, `expected a real route table, parsed ${paths.length} paths`);
  assert.ok(paths.includes('/shop'), 'sanity check: /shop should be in App.jsx');
});

test('every route React can render is served as 200, not 404', () => {
  const missing = routePathsFromApp()
    .map(withSampleParams)
    .filter((p) => !isKnownRoute(p));

  assert.deepStrictEqual(
    missing,
    [],
    `these routes exist in App.jsx but knownRoutes.js would 404 them:\n  ${missing.join('\n  ')}\n` +
      'Add them to STATIC_ROUTES / DYNAMIC_PARENTS in knownRoutes.js.'
  );
});

test('paths the app has no route for are 404', () => {
  for (const p of [
    '/xyzzy',
    '/this-page-does-not-exist-12345',
    '/favicon.ico',
    '/BingSiteAuth.xml',
    '/wp-login.php',
    '/shop/extra/segments/here',
    '/product',            // parent alone is not a page — /product/:id is
    '/product/a/b',        // too many segments
  ]) {
    assert.strictEqual(isKnownRoute(p), false, `${p} should not be a known route`);
  }
});

test('a trailing slash is the same URL, not a 404', () => {
  assert.strictEqual(isKnownRoute('/shop/'), true);
  assert.strictEqual(isKnownRoute('/'), true);
  assert.strictEqual(normalise('/shop/'), '/shop');
  assert.strictEqual(normalise('/'), '/');
});

test('nested admin and seller routes stay reachable', () => {
  for (const p of ['/admin', '/admin/orders', '/admin/products/new', '/seller/dashboard']) {
    assert.strictEqual(isKnownRoute(p), true, `${p} should be a known route`);
  }
});
