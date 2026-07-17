const express = require('express');
const { v4: uuid } = require('uuid');
const db = require('../data/db');
const { requireAuth } = require('../middleware/auth');

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

// GET /api/products?category=&search=&sort=&combo=true
router.get('/', async (req, res, next) => {
  try {
    let products = await db.list('products');
    const { category, search, sort, combo } = req.query;

    if (category && category !== 'all') {
      products = products.filter((p) => p.category === category);
    }

    if (combo === 'true') {
      products = products.filter((p) => Array.isArray(p.comboItems) && p.comboItems.length > 0);
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
      products = [...products].sort((a, b) => a.sizes[0].price - b.sizes[0].price);
    } else if (sort === 'price-desc') {
      products = [...products].sort((a, b) => b.sizes[0].price - a.sizes[0].price);
    } else if (sort === 'rating') {
      products = [...products].sort((a, b) => b.rating - a.rating);
    }

    res.json({ success: true, count: products.length, products });
  } catch (err) {
    next(err);
  }
});

// GET /api/products/categories
router.get('/categories', async (req, res, next) => {
  try {
    const categories = (await db.list('categories')).sort((a, b) => (a.sort || 0) - (b.sort || 0));
    res.json({
      success: true,
      categories: categories.map((c) => ({ slug: c.id, label: c.label, image: c.image })),
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/products/:id
router.get('/:id', async (req, res, next) => {
  try {
    const product = await db.get('products', req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }
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

// POST /api/products/:id/reviews  { rating, text? } — one review per customer per
// product; re-submitting updates their existing review instead of duplicating it.
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
      createdAt: existing?.createdAt || new Date().toISOString(),
    };
    await db.put('reviews', review);
    await recomputeRating(req.params.id);

    res.status(existing ? 200 : 201).json({ success: true, review });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
