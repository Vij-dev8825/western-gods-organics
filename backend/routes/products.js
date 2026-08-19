const express = require('express');
const { v4: uuid } = require('uuid');
const db = require('../data/db');
const { requireAuth, optionalAuth } = require('../middleware/auth');
const { imageUpload, storeUploadedFile } = require('../utils/imageUploadHandler');
const { sendMail } = require('../utils/mailer');
const { hasEarlyAccessPerk } = require('../utils/loyalty');
const { notifyUser } = require('../utils/notify');
const { listOpen: listOpenPressings, describe: describePressing } = require('../utils/pressings');
const { listUpcoming: listUpcomingFestivals } = require('../utils/festivals');

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || process.env.CONTACT_NOTIFY_EMAIL;

const router = express.Router();

async function recomputeRating(productId) {
  const reviews = (await db.list('reviews')).filter((r) => r.productId === productId);
  const product = await db.get('products', productId);
  if (!product) return;
  product.reviewsCount = reviews.length;
  product.rating = reviews.length
    ? Math.round((reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length) * 10) / 10
    : 0;
  await db.put('products', product);
}

const PRICE_BANDS = {
  under200: [0, 200],
  '200to400': [200, 400],
  '400to600': [400, 600],
  above600: [600, Infinity],
};

// Matches ProductCard's own default-selected size (sizes[1] if present, else
// sizes[0]) so any price-based filtering/sorting matches the price actually
// on screen — using a different size (e.g. the cheapest) looked "wrong" to
// shoppers whenever that wasn't the size the card happened to display.
function displayPrice(p) {
  return (p.sizes[1] || p.sizes[0]).price;
}

function isEarlyAccessLocked(product) {
  return !!product.earlyAccessUntil && new Date(product.earlyAccessUntil).getTime() > Date.now();
}

// Silver/Gold reward members (see utils/loyalty.js) get to shop a product
// before its earlyAccessUntil date — admins can always preview it too.
async function userHasEarlyAccess(req) {
  if (!req.user) return false;
  if (req.user.role === 'admin') return true;
  return hasEarlyAccessPerk(req.user.id);
}

// A seller's own soft-hidden listing, or a still-on-probation listing (see
// routes/sellerPortal.js/admin.js), is invisible to everyone except an admin
// or the seller who owns it — store products (no sellerId) are never
// affected by either check.
// Resolves each distinct sellerId in one pass rather than one db.get per
// product. Both the visibility check and the name attachment below read from
// the result, so a request loads each seller record at most once.
async function loadSellers(products) {
  const ids = [...new Set(products.filter((p) => p.sellerId).map((p) => p.sellerId))];
  if (!ids.length) return {};
  const rows = await Promise.all(ids.map((id) => db.get('users', id)));
  return Object.fromEntries(ids.map((id, i) => [id, rows[i]]));
}

function isHiddenFromViewer(product, req, sellerById = {}) {
  if (product.active === false) return true;
  const isOwner = req.user?.id === product.sellerId;
  const isAdmin = req.user?.role === 'admin';
  if (isOwner || isAdmin) return false;
  if (product.sellerModerationStatus === 'pending') return true;
  // Vacation mode — the seller has paused their whole shop, so every listing
  // of theirs drops out at once without touching each product's own `active`
  // flag (which they'll want back exactly as it was when they return).
  if (product.sellerId && sellerById[product.sellerId]?.sellerOnVacation) return true;
  return false;
}

// sellerMode rides along with the name because it decides what the shopper is
// told: a 'marketplace' seller is the seller of record ("Sold by"), a
// 'supplier' sells to us and we sell it on under our own food licence, so they
// get credit as the maker ("Sourced from") and nothing more.
function attachSellerNames(products, sellerById) {
  return products.map((p) => (p.sellerId
    ? {
      ...p,
      sellerName: sellerById[p.sellerId]?.sellerBusinessName || null,
      sellerMode: sellerById[p.sellerId]?.sellerMode || 'supplier',
    }
    : p));
}

// GET /api/products?category=&search=&sort=&combo=true&price=&isNew=true
router.get('/', optionalAuth, async (req, res, next) => {
  try {
    let products = await db.list('products');
    const { category, search, sort, combo, price, isNew } = req.query;

    if (category && category !== 'all') {
      products = products.filter((p) => p.category === category);
    }

    if (combo === 'true') {
      products = products.filter((p) => Array.isArray(p.comboItems) && p.comboItems.length > 0);
    }

    if (isNew === 'true') {
      products = products.filter((p) => p.isNew);
    }

    if (price && PRICE_BANDS[price]) {
      const [min, max] = PRICE_BANDS[price];
      products = products.filter((p) => {
        const dp = displayPrice(p);
        return dp >= min && dp <= max;
      });
    }

    if (search) {
      const q = search.toLowerCase();
      products = products.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.shortDescription || '').toLowerCase().includes(q) ||
          (p.tags || []).some((t) => t.toLowerCase().includes(q))
      );
    }

    if (sort === 'price-asc') {
      products = [...products].sort((a, b) => displayPrice(a) - displayPrice(b));
    } else if (sort === 'price-desc') {
      products = [...products].sort((a, b) => displayPrice(b) - displayPrice(a));
    } else if (sort === 'rating') {
      products = [...products].sort((a, b) => b.rating - a.rating);
    }

    // Only pay the tier-lookup cost when an early-access item is actually in
    // play — the common case (no active early-access campaign) stays free.
    if (products.some(isEarlyAccessLocked) && !(await userHasEarlyAccess(req))) {
      products = products.filter((p) => !isEarlyAccessLocked(p));
    }

    const sellerById = await loadSellers(products);
    products = products.filter((p) => !isHiddenFromViewer(p, req, sellerById));
    products = attachSellerNames(products, sellerById);

    res.json({ success: true, count: products.length, products });
  } catch (err) {
    next(err);
  }
});

// GET /api/products/categories
router.get('/categories', async (req, res, next) => {
  try {
    const [categories, products] = await Promise.all([db.list('categories'), db.list('products')]);
    // `pending` is set on a category a seller proposed while listing a product
    // — it stays off the shop's category nav until an admin approves it.
    const sorted = categories
      .filter((c) => !c.pending)
      .sort((a, b) => (a.sort || 0) - (b.sort || 0));
    res.json({
      success: true,
      categories: sorted.map((c) => ({
        slug: c.id,
        label: c.label,
        image: c.image,
        description: c.description || '',
        count: products.filter((p) => p.category === c.id).length,
      })),
      totalCount: products.length,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/products/batch/:batchNumber — public "batch passport" lookup,
// meant to be reached via a QR code printed on the physical bottle/pack.
// Only the current batch on file is shown — the product record holds the
// latest batch info, not a history of past ones.
router.get('/batch/:batchNumber', async (req, res, next) => {
  try {
    const products = await db.list('products');
    const product = products.find((p) => p.batchNumber === req.params.batchNumber);
    if (!product) {
      return res.status(404).json({ success: false, message: 'No product found for this batch number.' });
    }
    // A marketplace seller fills in their own batch details, so the passport
    // says whose claims these are rather than presenting them as the store's.
    const seller = product.sellerId ? await db.get('users', product.sellerId) : null;
    res.json({
      success: true,
      batch: {
        productId: product.id,
        productName: product.name,
        image: product.image,
        sellerName: seller?.sellerBusinessName || null,
        batchNumber: product.batchNumber,
        productionDate: product.productionDate || null,
        bestBeforeDate: product.bestBeforeDate || null,
        growerName: product.growerName || null,
        growerVillage: product.growerVillage || null,
        fssaiLicense: product.fssaiLicense || null,
        labReportUrl: product.labReportUrl || null,
        inciIngredients: product.inciIngredients || null,
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/products/reviews/gallery?limit=24 — most recent review photos
// across every product, newest first, for the UGC shoppable wall on
// Home/ProductDetail. One entry per photo (a review with several photos
// contributes several tiles), so the wall reads as a photo grid rather than
// a review list.
router.get('/reviews/gallery', async (req, res, next) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 24, 60);
    const [reviews, products] = await Promise.all([db.list('reviews'), db.list('products')]);
    const withPhotos = reviews
      .filter((r) => r.images && r.images.length)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    const gallery = [];
    outer: for (const r of withPhotos) {
      const product = products.find((p) => p.id === r.productId);
      if (!product) continue;
      for (const image of r.images) {
        gallery.push({
          image,
          reviewId: r.id,
          productId: product.id,
          productName: product.name,
          productImage: product.image,
          userName: r.userName,
          rating: r.rating,
          text: r.text,
        });
        if (gallery.length >= limit) break outer;
      }
    }
    res.json({ success: true, gallery });
  } catch (err) {
    next(err);
  }
});

// GET /api/products/reviews/recent?limit=8 — the best of what customers have
// actually written, for the homepage.
//
// The photo wall next to it shows pictures and the Google widget shows quotes
// an admin typed in by hand; neither surfaces the hundreds of written reviews
// already sitting in the database. This does, and because it reads them live
// it stays current on its own — the strongest sales copy on the site is the
// part nobody has to write.
const HOMEPAGE_REVIEW_MIN_RATING = 4;
const HOMEPAGE_REVIEW_MIN_CHARS = 40;

router.get('/reviews/recent', async (req, res, next) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 8, 24);
    const [reviews, products] = await Promise.all([db.list('reviews'), db.list('products')]);

    const seenProducts = new Set();
    const picked = reviews
      // A three-star review is honest feedback but it isn't a recommendation,
      // and a two-word one says nothing to a stranger deciding whether to buy.
      .filter((r) => r.rating >= HOMEPAGE_REVIEW_MIN_RATING)
      .filter((r) => (r.text || '').trim().length >= HOMEPAGE_REVIEW_MIN_CHARS)
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
      .reduce((out, r) => {
        if (out.length >= limit) return out;
        // One per product, so the row reads as a range of things people buy
        // rather than five reviews of the same bottle.
        if (seenProducts.has(r.productId)) return out;
        const product = products.find((p) => p.id === r.productId);
        if (!product) return out;
        seenProducts.add(r.productId);
        out.push({
          id: r.id,
          rating: r.rating,
          text: r.text,
          userName: r.userName,
          createdAt: r.createdAt,
          image: r.images?.[0] || null,
          productId: product.id,
          productName: product.name,
          productImage: product.image,
        });
        return out;
      }, []);

    res.json({ success: true, reviews: picked });
  } catch (err) {
    next(err);
  }
});

const SUGGESTION_LIMIT = 3;

/**
 * GET /api/products/also-bought?ids=a,b,c — up to three things worth adding to
 * a cart that already holds `ids`.
 *
 * Three sources, best first, and the `basis` it comes back with decides what
 * the cart is allowed to call it. A shop with no orders cannot honestly say
 * "often bought together", so it doesn't — it falls through to something that
 * is true on day one instead.
 *
 *   bought-together — distinct past orders containing a cart item and this one.
 *                     Real co-purchase; needs orders to exist.
 *   kit             — the rest of a kit one of the cart's items belongs to.
 *                     Real curation the shop already keeps; needs no orders.
 *   parcel          — the cheapest thing from a category the cart doesn't
 *                     touch. Claims nothing about behaviour, only the fact
 *                     that the box is already going out, which is always true.
 *
 * Registered above /:id so "also-bought" isn't read as a product id.
 */
router.get('/also-bought', optionalAuth, async (req, res, next) => {
  try {
    const inCart = new Set(
      String(req.query.ids || '').split(',').map((s) => s.trim()).filter(Boolean)
    );
    if (!inCart.size) return res.json({ success: true, basis: 'none', products: [] });

    const all = await db.list('products');
    const byId = new Map(all.map((p) => [p.id, p]));
    const sellerById = await loadSellers(all);

    // Anything the shopper couldn't buy right now is not a suggestion: hidden
    // or paused listings, an early-access product they don't have access to,
    // and — the one most likely to embarrass — a product with no stock in any
    // size. Suggesting a sold-out bottle is worse than suggesting nothing.
    const hasEarlyAccess = await userHasEarlyAccess(req);
    const sellable = (p) =>
      p &&
      !inCart.has(p.id) &&
      !isHiddenFromViewer(p, req, sellerById) &&
      (!isEarlyAccessLocked(p) || hasEarlyAccess) &&
      (p.sizes || []).some((s) => Number(s.stock) > 0);

    // 1. Real co-purchase. Counted once per order, so one bulk order of six
    //    soaps can't outrank six different people buying one each.
    const orders = await db.list('orders');
    const together = new Map();
    for (const order of orders) {
      if (order.status === 'cancelled') continue;
      const ids = new Set((order.items || []).map((it) => it.productId));
      let touchesCart = false;
      for (const id of inCart) if (ids.has(id)) { touchesCart = true; break; }
      if (!touchesCart) continue;
      for (const id of ids) {
        if (inCart.has(id)) continue;
        together.set(id, (together.get(id) || 0) + 1);
      }
    }
    let basis = 'bought-together';
    let picked = [...together.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([id]) => byId.get(id))
      .filter(sellable);

    // 2. The rest of a kit something in the cart belongs to. Deliberately the
    //    kit's other components and not the kit product itself — someone who
    //    already has the oil in their cart does not want to buy it again
    //    inside a box.
    if (!picked.length) {
      const mates = new Set();
      for (const p of all) {
        const parts = Array.isArray(p.comboProductIds) ? p.comboProductIds : [];
        if (!parts.some((id) => inCart.has(id))) continue;
        for (const id of parts) if (!inCart.has(id)) mates.add(id);
      }
      picked = [...mates].map((id) => byId.get(id)).filter(sellable);
      if (picked.length) basis = 'kit';
    }

    // 3. Cheapest sellable item from a category the cart doesn't already
    //    cover — one per category, so this is a spread rather than three
    //    variants of the same thing.
    if (!picked.length) {
      const cartCategories = new Set(
        [...inCart].map((id) => byId.get(id)?.category).filter(Boolean)
      );
      const cheapestPerCategory = new Map();
      for (const p of all) {
        if (!p.category || cartCategories.has(p.category) || !sellable(p)) continue;
        const from = Math.min(...(p.sizes || []).filter((s) => Number(s.stock) > 0).map((s) => Number(s.price)));
        if (!Number.isFinite(from)) continue;
        const held = cheapestPerCategory.get(p.category);
        if (!held || from < held.from) cheapestPerCategory.set(p.category, { product: p, from });
      }
      picked = [...cheapestPerCategory.values()].sort((a, b) => a.from - b.from).map((e) => e.product);
      if (picked.length) basis = 'parcel';
    }

    if (!picked.length) return res.json({ success: true, basis: 'none', products: [] });
    res.json({
      success: true,
      basis,
      products: attachSellerNames(picked.slice(0, SUGGESTION_LIMIT), sellerById),
    });
  } catch (err) {
    next(err);
  }
});

// Genuine (not fabricated) "recently ordered" count for PDP urgency copy —
// distinct non-cancelled orders containing this product within the window,
// not a per-line count, so a single bulk order can't inflate the number.
const RECENT_ORDER_WINDOW_HOURS = 48;
async function getRecentOrderCount(productId) {
  const orders = await db.list('orders');
  const cutoff = Date.now() - RECENT_ORDER_WINDOW_HOURS * 60 * 60 * 1000;
  return orders.filter(
    (o) =>
      o.status !== 'cancelled' &&
      new Date(o.createdAt).getTime() >= cutoff &&
      o.items.some((it) => it.productId === productId)
  ).length;
}

// Everything with a fixed path must be declared above the /:id route below.
// Express matches in declaration order and /:id swallows any single-segment
// path, so a fixed route registered after it is unreachable — which is what
// happened to this one: /api/products/festivals answered "Product not found"
// and the festival calendar rendered empty no matter what the admin entered.
// (/pressings/open survived only by having two segments.)
/**
 * GET /api/products/festivals — the season ahead, public.
 *
 * Products are resolved here rather than on the client so the page can't show
 * something delisted or out of stock as a festival recommendation.
 */
router.get('/festivals', async (req, res, next) => {
  try {
    const [festivals, products] = await Promise.all([listUpcomingFestivals(), db.list('products')]);
    const byId = Object.fromEntries(products.map((p) => [p.id, p]));
    res.json({
      success: true,
      festivals: festivals.map((f) => ({
        id: f.id,
        name: f.name,
        date: f.date,
        note: f.note,
        daysAway: f.daysAway,
        orderBy: f.orderBy,
        orderingClosed: f.orderingClosed,
        // Public on purpose. A coupon code is meant to be handed out, and the
        // pookalam at /onam is a celebration rather than a lock — anyone who
        // opens the network tab can read this without laying a petal, exactly
        // as they could on any play-for-a-code promotion. Guarding it would
        // mean a per-session token flow protecting something that ends up on
        // coupon sites the first time one person shares it. The real limits
        // on an offer are the ones set on the coupon itself: expiry, minimum
        // order, per-customer use.
        couponCode: f.couponCode || '',
        products: (f.productIds || [])
          .map((id) => byId[id])
          .filter(Boolean)
          .map((p) => ({
            id: p.id,
            name: p.name,
            image: p.image,
            price: (p.sizes || [])[0]?.price ?? null,
            inStock: (p.sizes || []).some((s) => (Number(s.stock) || 0) > 0),
          })),
      })),
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/products/:id
router.get('/:id', optionalAuth, async (req, res, next) => {
  try {
    const product = await db.get('products', req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }
    if (isEarlyAccessLocked(product) && !(await userHasEarlyAccess(req))) {
      return res.json({
        success: true,
        earlyAccess: true,
        product: {
          id: product.id,
          name: product.name,
          image: product.image,
          shortDescription: product.shortDescription,
          earlyAccessUntil: product.earlyAccessUntil,
        },
      });
    }
    const sellerById = await loadSellers([product]);
    if (isHiddenFromViewer(product, req, sellerById)) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }
    if (product.sellerId) {
      product.sellerName = sellerById[product.sellerId]?.sellerBusinessName || null;
      product.sellerMode = sellerById[product.sellerId]?.sellerMode || 'supplier';
    }
    product.recentOrderCount = await getRecentOrderCount(product.id);
    res.json({ success: true, product });
  } catch (err) {
    next(err);
  }
});

// GET /api/products/:id/reviews
router.get('/:id/reviews', async (req, res, next) => {
  try {
    const reviews = (await db.list('reviews'))
      .filter((r) => r.productId === req.params.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    res.json({ success: true, reviews });
  } catch (err) {
    next(err);
  }
});

// POST /api/products/reviews/photo — multipart 'file' → { url }, uploaded
// ahead of the review itself so the submit form can send back plain URLs.
router.post('/reviews/photo', requireAuth, imageUpload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'An image file is required.' });
    const url = await storeUploadedFile(req.file);
    res.status(201).json({ success: true, url });
  } catch (err) {
    next(err);
  }
});

// POST /api/products/:id/reviews  { rating, text?, images? } — one review per
// customer per product; re-submitting updates their existing review instead
// of duplicating it.
router.post('/:id/reviews', requireAuth, async (req, res, next) => {
  try {
    const product = await db.get('products', req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }
    const rating = Number(req.body.rating);
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, message: 'Rating must be between 1 and 5.' });
    }
    const text = (req.body.text || '').trim().slice(0, 1000);
    const images = Array.isArray(req.body.images)
      ? req.body.images.filter((u) => typeof u === 'string' && u.trim()).slice(0, 4)
      : [];

    const reviews = await db.list('reviews');
    const existing = reviews.find((r) => r.productId === req.params.id && r.userId === req.user.id);
    const author = await db.get('users', req.user.id);

    const review = {
      id: existing?.id || uuid(),
      productId: req.params.id,
      userId: req.user.id,
      userName: author?.name || 'Customer',
      rating,
      text,
      images,
      createdAt: existing?.createdAt || new Date().toISOString(),
    };
    await db.put('reviews', review);
    await recomputeRating(req.params.id);

    res.status(existing ? 200 : 201).json({ success: true, review });
  } catch (err) {
    next(err);
  }
});

// GET /api/products/:id/questions — public, answered questions only (an
// unanswered one sitting on a product page with no reply looks worse than
// just not showing it yet; admin sees pending ones in Admin → Leads).
router.get('/:id/questions', async (req, res, next) => {
  try {
    const questions = (await db.list('product-questions'))
      .filter((q) => q.productId === req.params.id && q.answer)
      .sort((a, b) => b.answeredAt.localeCompare(a.answeredAt));
    res.json({ success: true, questions });
  } catch (err) {
    next(err);
  }
});

// POST /api/products/:id/questions  { question }
router.post('/:id/questions', requireAuth, async (req, res, next) => {
  try {
    const product = await db.get('products', req.params.id);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found.' });

    const question = (req.body.question || '').trim().slice(0, 500);
    if (question.length < 5) {
      return res.status(400).json({ success: false, message: 'Please enter a question (at least 5 characters).' });
    }

    const author = await db.get('users', req.user.id);
    const record = {
      id: uuid(),
      productId: req.params.id,
      userId: req.user.id,
      userName: author?.name || 'Customer',
      question,
      answer: null,
      answeredAt: null,
      createdAt: new Date().toISOString(),
    };
    await db.put('product-questions', record);

    // A question on a seller's own listing goes to that seller to answer
    // (see routes/sellerPortal.js GET/PATCH /questions) — the store admin
    // can still see and answer it too, but shouldn't have to relay it.
    const seller = product.sellerId ? await db.get('users', product.sellerId) : null;
    if (seller?.isSeller) {
      await notifyUser(seller, {
        title: `New question on ${product.name}`,
        message: `${record.userName} asked: "${question}"\n\nAnswer it from your seller dashboard.`,
        meta: { productId: product.id },
        channels: { inapp: true, email: true },
      });
    } else if (ADMIN_EMAIL) {
      sendMail({
        to: ADMIN_EMAIL,
        subject: `New product question: ${product.name}`,
        text: `${record.userName} asked about ${product.name}:\n\n"${question}"\n\nAnswer it in Admin → Enquiries & Leads → Product Questions.`,
      }).catch(() => {});
    }

    res.status(201).json({ success: true, question: record });
  } catch (err) {
    next(err);
  }
});

// GET /api/products/pressings/open?productId=... — upcoming mill runs a
// customer can still reserve a share of. Public: the whole point is that
// someone browsing a sold-out oil can see when the next batch is pressed.
router.get('/pressings/open', async (req, res, next) => {
  try {
    const pressings = await listOpenPressings({ productId: req.query.productId });
    res.json({ success: true, pressings });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/products/pressings/calendar — the mill's schedule, public.
 *
 * Deliberately wider than /pressings/open, which exists to answer "can I
 * reserve this" and so hides runs that are full. A calendar answering "when is
 * this made" wants those: a run fully spoken for is the most persuasive thing
 * on the page, and hiding it would make a busy mill look like an idle one. It
 * also looks backwards — what came off the press recently is what makes
 * "fresh" checkable rather than a claim.
 */
const RECENT_PRESSING_DAYS = 60;

router.get('/pressings/calendar', async (req, res, next) => {
  try {
    const [pressings, orders, products] = await Promise.all([
      db.list('pressings'),
      db.list('orders'),
      db.list('products'),
    ]);
    const imageById = Object.fromEntries(products.map((p) => [p.id, p.image]));
    const now = Date.now();
    const recentCutoff = now - RECENT_PRESSING_DAYS * 24 * 60 * 60 * 1000;

    // Only what the mill is willing to say in public: no reservation counts,
    // which would expose how a given run is selling.
    const publicView = (p) => ({
      id: p.id,
      productId: p.productId,
      productName: p.productName,
      productImage: imageById[p.productId] || '',
      size: p.size,
      pressDate: p.pressDate,
      note: p.note || '',
      batchNumber: p.batchNumber || '',
      unitsOffered: p.unitsOffered,
      // Public on purpose. A clip of the press actually turning is the single
      // most convincing thing on this page, and showing it only to the people
      // who already bought would waste it on the ones needing least convincing.
      videoUrl: p.videoUrl || '',
    });

    const upcoming = [];
    for (const p of pressings) {
      if (p.status !== 'open' || new Date(p.pressDate).getTime() <= now) continue;
      const { unitsRemaining } = await describePressing(p, orders);
      upcoming.push({ ...publicView(p), soldOut: unitsRemaining <= 0, unitsRemaining });
    }
    upcoming.sort((a, b) => new Date(a.pressDate) - new Date(b.pressDate));

    const recent = pressings
      .filter((p) => p.status === 'pressed' && new Date(p.pressDate).getTime() >= recentCutoff)
      .sort((a, b) => new Date(b.pressDate) - new Date(a.pressDate))
      .map(publicView);

    res.json({ success: true, upcoming, recent });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
