/**
 * This is a client-rendered SPA on one static index.html — every real
 * per-route <title>/description/OG tag is written by SeoMeta.jsx AFTER
 * JavaScript runs (see App.jsx, SeoMeta.jsx). A visitor's browser runs that
 * JS and sees the right tags. Anything that fetches the page WITHOUT running
 * JS — Bing, WhatsApp/Facebook/Twitter link previews, Slack/Discord/Telegram
 * unfurls, most AI tools that "read a link" — sees only index.html's generic,
 * site-wide tags, on every single page including a specific product.
 *
 * Full server-side rendering would fix this properly but is a much bigger,
 * riskier change (touches the build/deploy pipeline). This is the narrow,
 * safe slice: for a known list of non-JS crawlers only, on a known list of
 * content routes, substitute the right title/description/OG tags into the
 * same static HTML before it's sent. A real browser's request is completely
 * unaffected — see server.js, which only calls into this module for
 * requests whose User-Agent matches BOT_UA_REGEX.
 */
const db = require('../data/db');
const CANONICAL_ORIGIN = 'https://www.westerngodsorganic.com';
const DEFAULT_IMAGE = `${CANONICAL_ORIGIN}/favicon-96x96.png`;

// Common crawlers and link-unfurl bots. Deliberately conservative (named
// bots only) — an unmatched User-Agent just falls through to today's
// unchanged behavior, which is the safe direction to err in.
const BOT_UA_REGEX = /bot|crawl|spider|slurp|facebookexternalhit|whatsapp|telegrambot|discordbot|slackbot|linkedinbot|pinterest|redditbot|embedly|quora|skypeuripreview|vkshare|w3c_validator/i;

function isBot(userAgent) {
  return BOT_UA_REGEX.test(userAgent || '');
}

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

// Mirrors getProductImage's own rule (frontend/src/utils/productImages.js):
// an admin-uploaded/media image is a real fetchable URL; a bundled seed
// asset name (e.g. "castor-oil.jpeg") only resolves to something inside the
// built JS bundle, which a crawler can't fetch as an image — so those fall
// back to the site logo rather than linking a broken picture.
function resolveImage(image) {
  if (!image) return null;
  if (image.startsWith('http')) return image;
  if (image.startsWith('/uploads/') || image.startsWith('/api/media/')) return `${CANONICAL_ORIGIN}${image}`;
  return null;
}

function replaceTag(html, pattern, replacement) {
  return pattern.test(html) ? html.replace(pattern, replacement) : html;
}

/** Substitutes the page-specific tags into the cached index.html string.
 * Regexes target index.html's own known-static tags exactly as written
 * there, so this stays a plain string swap — no HTML parser needed, and no
 * risk of corrupting the rest of the document. */
function injectMeta(html, { title, description, image, url, type }) {
  const safeTitle = escapeHtml(title);
  const safeDesc = escapeHtml(description);
  const img = image || DEFAULT_IMAGE;

  let out = html;
  out = replaceTag(out, /<title>[^<]*<\/title>/, `<title>${safeTitle}</title>`);
  out = replaceTag(out, /(<meta name="description" content=")[^"]*(")/, `$1${safeDesc}$2`);
  out = replaceTag(out, /(<meta property="og:type" content=")[^"]*(")/, `$1${escapeHtml(type)}$2`);
  out = replaceTag(out, /(<meta property="og:title" content=")[^"]*(")/, `$1${safeTitle}$2`);
  out = replaceTag(out, /(<meta property="og:description" content=")[^"]*(")/, `$1${safeDesc}$2`);
  out = replaceTag(out, /(<meta property="og:image" content=")[^"]*(")/, `$1${img}$2`);
  out = replaceTag(out, /(<meta property="og:url" content=")[^"]*(")/, `$1${url}$2`);
  out = replaceTag(out, /(<meta name="twitter:title" content=")[^"]*(")/, `$1${safeTitle}$2`);
  out = replaceTag(out, /(<meta name="twitter:description" content=")[^"]*(")/, `$1${safeDesc}$2`);
  out = replaceTag(out, /(<meta name="twitter:image" content=")[^"]*(")/, `$1${img}$2`);
  return out;
}

// A product a bot shouldn't be told about — same visibility rule
// routes/products.js applies to a plain guest: deactivated, still in
// seller-moderation review, or belonging to a paused seller.
async function isProductPubliclyVisible(product) {
  if (!product || product.active === false || product.sellerModerationStatus === 'pending') return false;
  if (product.sellerId) {
    const seller = await db.get('users', product.sellerId);
    if (seller?.sellerOnVacation) return false;
  }
  return true;
}

const STATIC_ROUTE_META = {
  '/shop': {
    title: 'Shop All Products | Western Gods Organics',
    description: 'Browse our cold-pressed oils, handmade herbal soaps and stone-ground herbal powders — 100% natural, shipped across India and worldwide.',
  },
  '/categories': {
    title: 'Shop by Category — Oils, Soaps & Herbal Powders | Western Gods Organics',
    description: 'Explore our cold-pressed oils, handmade herbal soaps and stone-ground herbal powders by category — traditional, natural, and chemical-free.',
  },
};

/** Returns {title, description, image, url, type} for a route worth
 * customizing, or null to leave index.html exactly as it is (the default,
 * safe outcome for every route not explicitly handled below, and for
 * anything that fails to load — a missing product shouldn't break the page,
 * it should just fall back to the site's own default tags).
 *
 * `pathname` is path-only (no query) — a `/shop?category=X` link is handled
 * as a special case below via `query`, since that's exactly the URL shape
 * the sitemap lists one entry per category under (see sitemap.js) and each
 * one deserves its own title/description, not the generic "Shop All
 * Products" every other query on /shop correctly falls back to. */
async function getMetaForRoute(pathname, query = {}) {
  const url = `${CANONICAL_ORIGIN}${pathname}${query.category ? `?category=${encodeURIComponent(query.category)}` : ''}`;

  if (pathname === '/shop' && query.category && query.category !== 'all') {
    const categories = await db.list('categories');
    const cat = categories.find((c) => c.id === query.category && !c.pending);
    if (!cat) return null;
    return {
      title: `${cat.label} | Western Gods Organics`,
      description: (cat.description || STATIC_ROUTE_META['/shop'].description).slice(0, 160),
      image: resolveImage(cat.image),
      url,
      type: 'website',
    };
  }

  if (STATIC_ROUTE_META[pathname]) {
    return { ...STATIC_ROUTE_META[pathname], url, type: 'website' };
  }

  const productMatch = pathname.match(/^\/product\/([^/]+)$/);
  if (productMatch) {
    const product = await db.get('products', decodeURIComponent(productMatch[1]));
    if (!(await isProductPubliclyVisible(product))) return null;
    return {
      title: `${product.name} | Western Gods Organics`,
      description: (product.shortDescription || product.description || '').slice(0, 160),
      image: resolveImage(product.image),
      url,
      type: 'product',
    };
  }

  const blogMatch = pathname.match(/^\/blog\/([^/]+)$/);
  if (blogMatch) {
    const post = await db.get('blog-posts', decodeURIComponent(blogMatch[1]));
    if (!post || post.published === false) return null;
    return {
      title: `${post.title} | Western Gods Organics Blog`,
      description: (post.excerpt || '').slice(0, 160),
      image: resolveImage(post.image),
      url,
      type: 'article',
    };
  }

  const sellerMatch = pathname.match(/^\/sellers\/([^/]+)$/);
  if (sellerMatch) {
    const seller = await db.get('users', decodeURIComponent(sellerMatch[1]));
    if (!seller?.isSeller) return null;
    return {
      title: `${seller.sellerBusinessName} | Western Gods Organics`,
      description: (seller.sellerBio || `Products from ${seller.sellerBusinessName}, selling on Western Gods Organics.`).slice(0, 160),
      image: resolveImage(seller.sellerLogo),
      url,
      type: 'website',
    };
  }

  return null;
}

module.exports = { isBot, injectMeta, getMetaForRoute };
