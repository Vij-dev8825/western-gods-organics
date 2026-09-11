const express = require('express');
const db = require('../data/db');

const router = express.Router();

const SITE_URL = 'https://www.westerngodsorganic.com';

const STATIC_PATHS = [
  { path: '/', priority: '1.0', changefreq: 'daily' },
  { path: '/shop', priority: '0.9', changefreq: 'daily' },
  { path: '/categories', priority: '0.8', changefreq: 'weekly' },
  { path: '/combos', priority: '0.8', changefreq: 'weekly' },
  { path: '/gifting', priority: '0.7', changefreq: 'weekly' },
  { path: '/blog', priority: '0.7', changefreq: 'weekly' },
  { path: '/guides', priority: '0.7', changefreq: 'weekly' },
  { path: '/bulk-enquiry', priority: '0.5', changefreq: 'monthly' },
  { path: '/contact', priority: '0.5', changefreq: 'monthly' },
  { path: '/import', priority: '0.4', changefreq: 'monthly' },
  { path: '/store-locator', priority: '0.4', changefreq: 'monthly' },
  { path: '/impact', priority: '0.5', changefreq: 'weekly' },
  // Changes whenever a run is scheduled or pressed, so it's worth recrawling
  // more often than the other standing pages.
  { path: '/pressings', priority: '0.6', changefreq: 'daily' },
  { path: '/sourcing', priority: '0.5', changefreq: 'monthly' },
  // Pages that answer a question someone is already searching for — the quiz
  // that picks an oil for them, the oil guide, the mill's own story — which
  // until now were reachable only from the footer, where links go to be
  // ignored.
  //
  // Everything listed here renders its content to a signed-out visitor, which
  // is the whole test for belonging in a sitemap. That rules out more than the
  // obvious account screens: /rewards, /affiliate and /gift-cards all look like
  // marketing pages but sit behind ProtectedRoute, so a crawler following them
  // lands on the login form and learns that this file points at pages that
  // aren't there. /sell-with-us is out too — it is a redirect to /seller.
  { path: '/finder', priority: '0.7', changefreq: 'weekly' },
  { path: '/guide', priority: '0.7', changefreq: 'monthly' },
  { path: '/our-story', priority: '0.6', changefreq: 'monthly' },
  { path: '/how-to-use', priority: '0.6', changefreq: 'monthly' },
  { path: '/whats-new', priority: '0.6', changefreq: 'weekly' },
  { path: '/festivals', priority: '0.5', changefreq: 'weekly' },
  { path: '/getting-started', priority: '0.5', changefreq: 'monthly' },
  { path: '/how-to-shop', priority: '0.4', changefreq: 'monthly' },
  { path: '/policy', priority: '0.2', changefreq: 'yearly' },
  { path: '/refund-policy', priority: '0.2', changefreq: 'yearly' },
  { path: '/terms', priority: '0.2', changefreq: 'yearly' },
];

function urlEntry(loc, { priority = '0.5', changefreq = 'monthly', lastmod } = {}) {
  return (
    `  <url>\n    <loc>${loc}</loc>\n` +
    (lastmod ? `    <lastmod>${lastmod}</lastmod>\n` : '') +
    `    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`
  );
}

// GET /sitemap.xml — static pages plus every product and published blog post,
// so Google can discover product/blog URLs without having to execute JS to
// crawl links inside the React app.
router.get('/', async (req, res, next) => {
  try {
    const [allProducts, posts, categories, users] = await Promise.all([
      db.list('products'), db.list('blog-posts'), db.list('categories'), db.list('users'),
    ]);

    // Only URLs a visitor can actually reach. A sitemap full of pages that
    // resolve to "not found" is worse than a short one — it teaches the
    // crawler the file can't be trusted. Deactivated listings, seller items
    // still in review, and everything belonging to a seller who has paused
    // their shop are all hidden by routes/products.js, so none of them belong
    // here either.
    const pausedSellers = new Set(users.filter((u) => u.sellerOnVacation).map((u) => u.id));
    const products = allProducts.filter((p) => p.active !== false
      && p.sellerModerationStatus !== 'pending'
      && !(p.sellerId && pausedSellers.has(p.sellerId)));

    const entries = [
      ...STATIC_PATHS.map((p) => urlEntry(`${SITE_URL}${p.path}`, p)),
      // One entry per category. These are the pages that stand a chance on a
      // search like "herbal powders" — the generic /categories index doesn't
      // target any single term. Proposed-but-unapproved categories are left
      // out, same as they are on the shop itself.
      ...categories
        .filter((c) => !c.pending)
        .map((c) =>
          urlEntry(`${SITE_URL}/shop?category=${encodeURIComponent(c.id)}`, {
            priority: '0.8',
            changefreq: 'weekly',
          })
        ),
      urlEntry(`${SITE_URL}/sellers`, { priority: '0.6', changefreq: 'weekly' }),
      ...products.map((p) =>
        urlEntry(`${SITE_URL}/product/${p.id}`, {
          priority: '0.8',
          changefreq: 'weekly',
          lastmod: (p.updatedAt || p.createdAt)?.slice(0, 10),
        })
      ),
      // One per pressing run the catalogue actually cites. These are the only
      // pages here whose content is unique to a date — this oil, pressed on
      // this day, from this farm — which is the one thing a shop reselling the
      // same commodity cannot publish. Derived from the catalogue rather than
      // a hand-kept list, so it is empty while no product carries a batch
      // number and fills in by itself the moment they do.
      ...[...new Set(products.map((p) => p.batchNumber).filter(Boolean))].map((b) =>
        urlEntry(`${SITE_URL}/batch/${encodeURIComponent(b)}`, {
          priority: '0.6',
          changefreq: 'monthly',
        })
      ),
      ...posts
        .filter((p) => p.published)
        .map((p) =>
          urlEntry(`${SITE_URL}/blog/${p.id}`, {
            priority: '0.6',
            changefreq: 'monthly',
            lastmod: p.createdAt?.slice(0, 10),
          })
        ),
    ];

    const xml =
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
      `${entries.join('\n')}\n` +
      '</urlset>';

    res.set('Content-Type', 'application/xml');
    res.send(xml);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
