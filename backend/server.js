require('dotenv').config();
const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const db = require('./data/db');
const { seed, UPLOADS_DIR } = require('./data/seed');

const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const cartRoutes = require('./routes/cart');
const wishlistRoutes = require('./routes/wishlist');
const orderRoutes = require('./routes/orders');
const bulkEnquiryRoutes = require('./routes/bulkEnquiry');
const contactRoutes = require('./routes/contact');
const bannerRoutes = require('./routes/banners');
const chatRoutes = require('./routes/chat');
const notificationRoutes = require('./routes/notifications');
const adminRoutes = require('./routes/admin');
const configRoutes = require('./routes/config');
const couponRoutes = require('./routes/coupons');
const subscriptionRoutes = require('./routes/subscriptions');
const loyaltyRoutes = require('./routes/loyalty');
const impactRoutes = require('./routes/impact');
const { processDueSubscriptions } = require('./utils/subscriptions');
const { processAbandonedCarts } = require('./utils/abandonedCarts');
const { processReorderNudges } = require('./utils/reorderNudges');
const { processReviewRequests } = require('./utils/reviewRequests');
const { checkShopHealth } = require('./utils/shopHealth');
const { processDeliveryUnboxingNudges } = require('./utils/deliveryUnboxingNudge');
const feedbackRoutes = require('./routes/feedback');
const pookalamRoutes = require('./routes/pookalam');
const whatsappBaileys = require('./utils/whatsappBaileys');
const mediaRoutes = require('./routes/media');
const clientErrorRoutes = require('./routes/clientErrors');
const catalogRoutes = require('./routes/catalog');
const botMeta = require('./utils/botMeta');
const blogRoutes = require('./routes/blog');
const pageBannerRoutes = require('./routes/pageBanners');
const sitemapRoutes = require('./routes/sitemap');
const pincodeRoutes = require('./routes/pincode');
const currencyRoutes = require('./routes/currency');
const saleBannerRoutes = require('./routes/saleBanner');
const announcementRoutes = require('./routes/announcements');
const flowerRoutes = require('./routes/flowers');
const stockNotifyRoutes = require('./routes/stockNotify');
const homepageReviewsRoutes = require('./routes/homepageReviews');
const aiAssistantRoutes = require('./routes/aiAssistant');
const webhookRoutes = require('./routes/webhooks');
const giftCardRoutes = require('./routes/giftCards');
const affiliateRoutes = require('./routes/affiliates');
const sellerPortalRoutes = require('./routes/sellerPortal');

const app = express();

// Render terminates TLS and proxies to this app over plain HTTP, setting
// X-Forwarded-Proto: https — without this, req.protocol always reports
// 'http' (breaking absolute URLs built from it, e.g. the catalog feed below).
app.set('trust proxy', 1);

/**
 * One address for the site.
 *
 * Both westerngodsorganic.com and www.westerngodsorganic.com answered 200 with
 * identical content, which to a search engine is two sites competing with each
 * other — every link, every mention and every ounce of authority split in half,
 * and neither copy ranking as well as one would. The sitemap and the meta tags
 * this app serves to crawlers both say www, so www is the address and the bare
 * name is a permanent redirect to it.
 *
 * Deliberately narrow, because this runs before everything and a mistake here
 * takes the whole site down:
 *
 * - Only the exact apex is redirected. Any other host — localhost, the LAN
 *   address, the host's own internal name, an IP — passes straight through, so
 *   development and whatever MilesWeb does for health checks are untouched.
 * - www is not in the list, so a redirect can never loop back on itself.
 * - GET and HEAD only. A 301 on a POST invites the client to retry it as a GET
 *   without its body, which on a checkout route means a lost order.
 */
const CANONICAL_HOST = 'www.westerngodsorganic.com';
const REDIRECT_HOSTS = new Set(['westerngodsorganic.com']);

app.use((req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return next();
  const host = String(req.headers.host || '').toLowerCase().split(':')[0];
  if (!REDIRECT_HOSTS.has(host)) return next();
  return res.redirect(301, `https://${CANONICAL_HOST}${req.originalUrl}`);
});

app.use(cors());
// Captures the raw bytes alongside the parsed body — needed by the Razorpay
// webhook route, which must verify a signature over the exact raw payload
// (a re-serialized JSON.stringify of req.body is not guaranteed byte-identical).
app.use(express.json({ limit: '2mb', verify: (req, res, buf) => { req.rawBody = buf; } }));
app.use(morgan('dev'));

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'Western Gods Organics API is running.', db: db.getMode() });
});

app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/bulk-enquiry', bulkEnquiryRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/banners', bannerRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/config', configRoutes);
app.use('/api/coupons', couponRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/loyalty', loyaltyRoutes);
app.use('/api/impact', impactRoutes);
app.use('/api/media', mediaRoutes);
app.use('/api/client-errors', clientErrorRoutes);
app.use('/api/catalog', catalogRoutes);
app.use('/api/blog', blogRoutes);
app.use('/api/page-banners', pageBannerRoutes);
app.use('/sitemap.xml', sitemapRoutes);
app.use('/api/pincode', pincodeRoutes);
app.use('/api/currency', currencyRoutes);
app.use('/api/sale-banner', saleBannerRoutes);
app.use('/api/announcements', announcementRoutes);
app.use('/api/flowers', flowerRoutes);
app.use('/api/stock-notify', stockNotifyRoutes);
app.use('/api/homepage-reviews', homepageReviewsRoutes);
app.use('/api/ai-assistant', aiAssistantRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/gift-cards', giftCardRoutes);
app.use('/api/affiliates', affiliateRoutes);
app.use('/api/seller', sellerPortalRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/pookalam', pookalamRoutes);

// Uploaded banner videos/images
app.use('/uploads', express.static(UPLOADS_DIR, { maxAge: '7d' }));

// Stable, versioned product photos for external feeds (WhatsApp/Meta catalog) —
// unlike bundled frontend assets, these keep a fixed filename/URL across builds.
app.use('/catalog-images', express.static(path.join(__dirname, 'public', 'catalog-images'), { maxAge: '7d' }));

// In production (single Render service) the API also serves the built frontend.
const distDir = path.join(__dirname, '..', 'frontend', 'dist');
if (fs.existsSync(distDir)) {
  // Vite stamps a content hash into every filename under /assets, so a given
  // URL there can never change meaning — a new build writes new filenames.
  // Without saying so, the browser revalidates each one on every navigation,
  // which is a full round-trip per file before anything can render. That cost
  // is invisible on a fast connection and brutal on a slow one, where latency
  // rather than bandwidth is what makes a site feel dead. Everything else
  // (index.html above all) must stay revalidated, or a deploy would never
  // reach anyone who had already visited.
  app.use(
    '/assets',
    express.static(path.join(distDir, 'assets'), {
      immutable: true,
      maxAge: '1y',
      // A miss here is a stale index.html asking for a chunk this build no
      // longer has. Falling through to the SPA catch-all would answer with
      // HTML and a 200, which the browser then tries to run as JavaScript;
      // failing outright lets it recover by refetching index.html.
      fallthrough: false,
    })
  );
  app.use(express.static(distDir));
  const indexPath = path.join(distDir, 'index.html');

  app.get(/^\/(?!api|uploads).*/, async (req, res) => {
    // Everyday browser traffic: byte-identical to before this change, same
    // sendFile call, same fast path. The meta-injection code below only ever
    // runs for a request whose User-Agent matches a known non-JS crawler.
    if (!botMeta.isBot(req.get('user-agent'))) {
      return res.sendFile(indexPath);
    }
    try {
      // Read fresh on every bot request rather than caching at boot — a
      // frontend-only deploy (rebuild, no backend restart) replaces this
      // file with one referencing newly hashed JS chunks; a cached copy
      // would keep pointing bots at chunks the new build just deleted until
      // the process happened to restart. The file is a few KB and the OS
      // keeps it page-cached, so this costs nothing worth trading
      // correctness for.
      const indexTemplate = fs.readFileSync(indexPath, 'utf8');
      const meta = await botMeta.getMetaForRoute(req.path, req.query);
      res.set('Content-Type', 'text/html');
      res.send(meta ? botMeta.injectMeta(indexTemplate, meta) : indexTemplate);
    } catch (err) {
      // A lookup failure here must never be worse than doing nothing —
      // fall back to the exact same page every crawler already gets today.
      console.error('[botMeta] falling back to default template:', err.message);
      res.sendFile(indexPath);
    }
  });
}

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found.' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  const message =
    err instanceof require('multer').MulterError || /allowed/.test(err.message || '')
      ? err.message
      : 'Something went wrong on our end.';
  res.status(err.status || 500).json({ success: false, message });
});

const PORT = process.env.PORT || 5000;

(async () => {
  try {
    const mode = await db.init();
    await seed();
    app.listen(PORT, () => {
      console.log(`Western Gods Organics API listening on http://localhost:${PORT} (db: ${mode})`);
    });

    // Connects (or resumes) the linked-WhatsApp session in the background —
    // never blocks server startup; see /api/admin/whatsapp for pairing status.
    whatsappBaileys.init().catch((err) => console.error('[whatsapp] init failed:', err));

    // No worker/cron process on Render's free plan — piggyback on this
    // long-lived request process instead (kept alive by the external
    // keep-alive ping). Runs once on boot, then hourly.
    processDueSubscriptions().catch((err) => console.error('processDueSubscriptions failed:', err));
    setInterval(() => {
      processDueSubscriptions().catch((err) => console.error('processDueSubscriptions failed:', err));
    }, 60 * 60 * 1000);

    processAbandonedCarts().catch((err) => console.error('processAbandonedCarts failed:', err));
    setInterval(() => {
      processAbandonedCarts().catch((err) => console.error('processAbandonedCarts failed:', err));
    }, 60 * 60 * 1000);

    processDeliveryUnboxingNudges().catch((err) => console.error('processDeliveryUnboxingNudges failed:', err));
    setInterval(() => {
      processDeliveryUnboxingNudges().catch((err) => console.error('processDeliveryUnboxingNudges failed:', err));
    }, 60 * 60 * 1000);

    // Reorder timing is day-granular, not hourly, so this runs once a day
    // rather than piggybacking on the hourly cadence above.
    processReorderNudges().catch((err) => console.error('processReorderNudges failed:', err));
    setInterval(() => {
      processReorderNudges().catch((err) => console.error('processReorderNudges failed:', err));
    }, 24 * 60 * 60 * 1000);

    // Review requests are day-granular too — a week after delivery, give or
    // take a few hours, is the same moment either way.
    processReviewRequests().catch((err) => console.error('processReviewRequests failed:', err));
    setInterval(() => {
      processReviewRequests().catch((err) => console.error('processReviewRequests failed:', err));
    }, 24 * 60 * 60 * 1000);

    // Hourly, because the failures it looks for are the quiet ones — every
    // size out of stock, both payment methods off, Razorpay keys missing. The
    // shop keeps loading perfectly while none of it can take money, and the
    // only other symptom is an absence of orders.
    checkShopHealth().catch((err) => console.error('checkShopHealth failed:', err));
    setInterval(() => {
      checkShopHealth().catch((err) => console.error('checkShopHealth failed:', err));
    }, 60 * 60 * 1000);
  } catch (err) {
    console.error('Failed to start:', err);
    process.exit(1);
  }
})();
