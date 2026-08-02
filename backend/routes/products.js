const express = require('express');
const { v4: uuid } = require('uuid');
const db = require('../data/db');
const { requireAuth, optionalAuth } = require('../middleware/auth');
const { imageUpload, storeUploadedFile } = require('../utils/imageUploadHandler');
const { sendMail } = require('../utils/mailer');
const { hasEarlyAccessPerk } = require('../utils/loyalty');

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

    res.json({ success: true, count: products.length, products });
  } catch (err) {
    next(err);
  }
});

// GET /api/products/categories
router.get('/categories', async (req, res, next) => {
  try {
    const [categories, products] = await Promise.all([db.list('categories'), db.list('products')]);
    const sorted = categories.slice().sort((a, b) => (a.sort || 0) - (b.sort || 0));
    res.json({
      success: true,
      categories: sorted.map((c) => ({
        slug: c.id,
        label: c.label,
        image: c.image,
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
    res.json({
      success: true,
      batch: {
        productId: product.id,
        productName: product.name,
        image: product.image,
        batchNumber: product.batchNumber,
        productionDate: product.productionDate || null,
        bestBeforeDate: product.bestBeforeDate || null,
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

    if (ADMIN_EMAIL) {
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

module.exports = router;
