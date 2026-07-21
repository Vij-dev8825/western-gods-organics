const express = require('express');
const db = require('../data/db');

const router = express.Router();

const SITE_URL = 'https://yamuna-organics.onrender.com';

const STATIC_PATHS = [
  { path: '/', priority: '1.0', changefreq: 'daily' },
  { path: '/shop', priority: '0.9', changefreq: 'daily' },
  { path: '/categories', priority: '0.8', changefreq: 'weekly' },
  { path: '/combos', priority: '0.8', changefreq: 'weekly' },
  { path: '/blog', priority: '0.7', changefreq: 'weekly' },
  { path: '/bulk-enquiry', priority: '0.5', changefreq: 'monthly' },
  { path: '/contact', priority: '0.5', changefreq: 'monthly' },
  { path: '/import', priority: '0.4', changefreq: 'monthly' },
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
    const [products, posts] = await Promise.all([db.list('products'), db.list('blog-posts')]);

    const entries = [
      ...STATIC_PATHS.map((p) => urlEntry(`${SITE_URL}${p.path}`, p)),
      ...products.map((p) => urlEntry(`${SITE_URL}/product/${p.id}`, { priority: '0.8', changefreq: 'weekly' })),
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
