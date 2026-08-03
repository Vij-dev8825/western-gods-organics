const express = require('express');
const { v4: uuid } = require('uuid');
const db = require('../data/db');
const { requireAuth } = require('../middleware/auth');
const { imageUpload, storeUploadedFile } = require('../utils/imageUploadHandler');
const { notifyUser } = require('../utils/notify');
const { sendMail } = require('../utils/mailer');
const { getSummary: getSellerSummary } = require('../utils/sellers');

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || process.env.CONTACT_NOTIFY_EMAIL;

const router = express.Router();

// Re-checks isSeller fresh from the DB on every request (never the JWT's
// role, which is embedded at login and wouldn't reflect a same-session
// approval) — same convention as isWholesale/isAffiliate elsewhere. Stashes
// the fresh user record on req.sellerUser so handlers don't re-fetch it.
async function requireSeller(req, res, next) {
  try {
    const user = await db.get('users', req.user.id);
    if (!user?.isSeller) {
      return res.status(403).json({ success: false, message: 'This account is not an approved seller.' });
    }
    req.sellerUser = user;
    next();
  } catch (err) {
    next(err);
  }
}

function validateSellerProduct(body) {
  if (!body.name || String(body.name).trim().length < 2) return 'Enter a product name.';
  if (!body.category) return 'Choose a category.';
  if (!Array.isArray(body.sizes) || body.sizes.length === 0) return 'Add at least one size with a price.';
  for (const s of body.sizes) {
    if (!s.label || s.price == null) return 'Every size needs a label and a price.';
  }
  return null;
}

// POST /api/seller/apply  { businessName, phone?, whatTheySell }
router.post('/apply', requireAuth, async (req, res, next) => {
  try {
    const user = await db.get('users', req.user.id);
    if (!user) return res.status(404).json({ success: false, message: 'Account not found.' });
    if (user.isSeller) {
      return res.status(400).json({ success: false, message: 'This account is already an approved seller.' });
    }
    const hasPending = (await db.list('seller-applications')).some(
      (a) => a.userId === req.user.id && a.status === 'pending'
    );
    if (hasPending) {
      return res.status(400).json({ success: false, message: 'You already have an application under review.' });
    }

    const businessName = (req.body.businessName || '').trim().slice(0, 120);
    const whatTheySell = (req.body.whatTheySell || '').trim().slice(0, 500);
    const phone = (req.body.phone || user.phone || '').trim();
    if (businessName.length < 2) return res.status(400).json({ success: false, message: 'Enter your business name.' });
    if (whatTheySell.length < 5) return res.status(400).json({ success: false, message: "Tell us a bit about what you'll sell." });

    const application = {
      id: uuid(),
      userId: req.user.id,
      businessName,
      phone,
      whatTheySell,
      status: 'pending',
      platformFeeRate: null,
      reviewNote: '',
      createdAt: new Date().toISOString(),
      decidedAt: null,
    };
    await db.put('seller-applications', application);

    if (ADMIN_EMAIL) {
      sendMail({
        to: ADMIN_EMAIL,
        subject: `New seller application: ${businessName}`,
        text: `${user.name || 'A customer'} (${phone}) applied to sell: ${whatTheySell}\n\nReview in Admin → Sellers.`,
      }).catch(() => {});
    }

    res.status(201).json({ success: true, application });
  } catch (err) {
    next(err);
  }
});

// GET /api/seller/me — always 200; `status` drives the frontend's render
// branch: 'none' | 'pending' | 'rejected' | 'approved'.
router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const user = await db.get('users', req.user.id);
    if (user?.isSeller) {
      const summary = await getSellerSummary(user.id);
      return res.json({
        success: true,
        status: 'approved',
        businessName: user.sellerBusinessName,
        bio: user.sellerBio || '',
        location: user.sellerLocation || '',
        logo: user.sellerLogo || '',
        platformFeeRate: user.sellerPlatformFeeRate || 0,
        probationRemaining: user.sellerProbationRemaining || 0,
        ...summary,
      });
    }
    const applications = (await db.list('seller-applications'))
      .filter((a) => a.userId === req.user.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const latest = applications[0];
    if (!latest) return res.json({ success: true, status: 'none' });
    res.json({ success: true, status: latest.status, businessName: latest.businessName, reviewNote: latest.reviewNote || '' });
  } catch (err) {
    next(err);
  }
});

// PUT /api/seller/profile  { businessName, bio, location } — a seller edits
// their own public-facing details (shown on their storefront page). The
// platform fee rate and probation counter are deliberately NOT editable here
// — those stay admin-only.
router.put('/profile', requireAuth, requireSeller, async (req, res, next) => {
  try {
    const user = req.sellerUser;
    const businessName = (req.body.businessName || '').trim().slice(0, 120);
    if (businessName.length < 2) {
      return res.status(400).json({ success: false, message: 'Enter your business name.' });
    }
    user.sellerBusinessName = businessName;
    user.sellerBio = (req.body.bio || '').trim().slice(0, 1000);
    user.sellerLocation = (req.body.location || '').trim().slice(0, 120);
    if (req.body.logo !== undefined) user.sellerLogo = req.body.logo || '';
    await db.put('users', user);
    res.json({
      success: true,
      profile: {
        businessName: user.sellerBusinessName,
        bio: user.sellerBio,
        location: user.sellerLocation,
        logo: user.sellerLogo || '',
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/seller/storefront/:id — PUBLIC. A seller's own page: their profile
// plus their live listings (never their pending/deactivated ones, which stay
// visible only to themselves via GET /products and to admins).
router.get('/storefront/:id', async (req, res, next) => {
  try {
    const seller = await db.get('users', req.params.id);
    if (!seller?.isSeller) {
      return res.status(404).json({ success: false, message: 'Seller not found.' });
    }
    const products = (await db.list('products')).filter(
      (p) => p.sellerId === seller.id && p.active !== false && p.sellerModerationStatus !== 'pending'
    );
    res.json({
      success: true,
      seller: {
        id: seller.id,
        businessName: seller.sellerBusinessName,
        bio: seller.sellerBio || '',
        location: seller.sellerLocation || '',
        logo: seller.sellerLogo || '',
      },
      products: products.map((p) => ({ ...p, sellerName: seller.sellerBusinessName })),
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/seller/support  { subject, message } — a seller's question to the
// store team; queued for the admin in Admin → Sellers → Support.
router.post('/support', requireAuth, requireSeller, async (req, res, next) => {
  try {
    const subject = (req.body.subject || '').trim().slice(0, 160);
    const message = (req.body.message || '').trim().slice(0, 2000);
    if (subject.length < 2) return res.status(400).json({ success: false, message: 'Enter a subject.' });
    if (message.length < 5) return res.status(400).json({ success: false, message: 'Enter your message.' });

    const enquiry = {
      id: uuid(),
      sellerId: req.sellerUser.id,
      sellerName: req.sellerUser.sellerBusinessName,
      sellerPhone: req.sellerUser.phone,
      subject,
      message,
      status: 'open',
      createdAt: new Date().toISOString(),
    };
    await db.put('seller-support', enquiry);

    if (ADMIN_EMAIL) {
      sendMail({
        to: ADMIN_EMAIL,
        subject: `Seller support: ${subject}`,
        text: `${enquiry.sellerName} (${enquiry.sellerPhone}) wrote:\n\n${message}\n\nReply in Admin → Sellers → Support.`,
      }).catch(() => {});
    }
    res.status(201).json({ success: true, enquiry });
  } catch (err) {
    next(err);
  }
});

// GET /api/seller/questions — shopper questions asked on this seller's own
// products (see routes/products.js POST /:id/questions), so the seller can
// answer them rather than the store admin having to relay.
router.get('/questions', requireAuth, requireSeller, async (req, res, next) => {
  try {
    const products = (await db.list('products')).filter((p) => p.sellerId === req.sellerUser.id);
    const nameById = Object.fromEntries(products.map((p) => [p.id, p.name]));
    const questions = (await db.list('product-questions'))
      .filter((q) => nameById[q.productId])
      .map((q) => ({ ...q, productName: nameById[q.productId] }))
      .sort((a, b) => {
        if (!a.answer !== !b.answer) return a.answer ? 1 : -1;
        return b.createdAt.localeCompare(a.createdAt);
      });
    res.json({ success: true, questions });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/seller/questions/:id  { answer } — ownership-checked against the
// question's product, so a seller can only answer questions on their own.
router.patch('/questions/:id', requireAuth, requireSeller, async (req, res, next) => {
  try {
    const question = await db.get('product-questions', req.params.id);
    if (!question) return res.status(404).json({ success: false, message: 'Question not found.' });
    const product = await db.get('products', question.productId);
    if (!product || product.sellerId !== req.sellerUser.id) {
      return res.status(404).json({ success: false, message: 'Question not found.' });
    }

    const answer = (req.body.answer || '').trim().slice(0, 1000);
    if (answer.length < 2) return res.status(400).json({ success: false, message: 'Enter an answer.' });
    question.answer = answer;
    question.answeredAt = new Date().toISOString();
    await db.put('product-questions', question);

    if (question.userId) {
      const asker = await db.get('users', question.userId);
      if (asker) {
        await notifyUser(asker, {
          title: `Your question was answered: ${product.name}`,
          message: `Q: ${question.question}\nA: ${answer}`,
          meta: { productId: product.id },
          channels: { inapp: true, email: true },
        });
      }
    }
    res.json({ success: true, question });
  } catch (err) {
    next(err);
  }
});

// POST /api/seller/upload-image — same upload mechanism the admin panel and
// customer review-photo upload already use (backend/utils/imageUploadHandler.js
// has zero auth/role awareness), just mounted behind the seller gate.
router.post('/upload-image', requireAuth, requireSeller, imageUpload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'An image file is required.' });
    const url = await storeUploadedFile(req.file);
    res.status(201).json({ success: true, url });
  } catch (err) {
    next(err);
  }
});

// GET /api/seller/products — the caller's own listings only.
router.get('/products', requireAuth, requireSeller, async (req, res, next) => {
  try {
    const products = (await db.list('products')).filter((p) => p.sellerId === req.sellerUser.id);
    res.json({ success: true, products });
  } catch (err) {
    next(err);
  }
});

// POST /api/seller/products — deliberately lean field subset (no combos,
// early access, country prices, wholesale pricing, or batch/compliance
// fields — those stay store-level curation, set only via the admin panel).
// While the seller is in their probation window, new listings are held for
// admin review (see admin.js's PATCH /seller-products/:id/moderate); once
// sellerProbationRemaining hits 0 they go live immediately.
router.post('/products', requireAuth, requireSeller, async (req, res, next) => {
  try {
    const error = validateSellerProduct(req.body);
    if (error) return res.status(400).json({ success: false, message: error });

    const slug = String(req.body.name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const id = `${slug}-${uuid().slice(0, 8)}`;
    const probationActive = (req.sellerUser.sellerProbationRemaining || 0) > 0;

    const product = {
      id,
      name: req.body.name,
      category: req.body.category,
      shortDescription: req.body.shortDescription || '',
      description: req.body.description || '',
      shortDescriptions: {},
      descriptions: {},
      image: req.body.image || '',
      images: Array.isArray(req.body.images) && req.body.images.length ? req.body.images : (req.body.image ? [req.body.image] : []),
      sizes: req.body.sizes.map((s) => ({
        label: s.label,
        price: Number(s.price),
        mrp: Number(s.mrp || s.price),
        stock: Number(s.stock || 0),
        wholesalePrice: null,
      })),
      rating: 0,
      reviewsCount: 0,
      tags: [],
      comboItems: [],
      comboProductIds: [],
      isNew: false,
      earlyAccessUntil: null,
      countryPrices: {},
      batchNumber: '',
      productionDate: '',
      bestBeforeDate: '',
      fssaiLicense: '',
      inciIngredients: '',
      labReportUrl: '',
      marketPricePer100: null,
      sellerId: req.sellerUser.id,
      sellerModerationStatus: probationActive ? 'pending' : 'approved',
      active: true,
      createdAt: new Date().toISOString(),
    };
    await db.put('products', product);
    res.status(201).json({ success: true, product });
  } catch (err) {
    next(err);
  }
});

// PUT /api/seller/products/:id — ownership-checked; only the same lean
// field subset can be changed, everything else on the record (id, sellerId,
// moderation status, rating, etc.) is preserved untouched via the spread.
// Editing an already-live listing never re-enters moderation.
router.put('/products/:id', requireAuth, requireSeller, async (req, res, next) => {
  try {
    const existing = await db.get('products', req.params.id);
    if (!existing || existing.sellerId !== req.sellerUser.id) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }
    const error = validateSellerProduct(req.body);
    if (error) return res.status(400).json({ success: false, message: error });

    const updated = {
      ...existing,
      name: req.body.name,
      category: req.body.category,
      shortDescription: req.body.shortDescription || '',
      description: req.body.description || '',
      image: req.body.image || '',
      images: Array.isArray(req.body.images) && req.body.images.length ? req.body.images : (req.body.image ? [req.body.image] : []),
      sizes: req.body.sizes.map((s) => ({
        label: s.label,
        price: Number(s.price),
        mrp: Number(s.mrp || s.price),
        stock: Number(s.stock || 0),
        wholesalePrice: null,
      })),
      updatedAt: new Date().toISOString(),
    };
    await db.put('products', updated);
    res.json({ success: true, product: updated });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/seller/products/:id/deactivate  { active } — ownership-checked
// soft-hide/reactivate. No hard delete exposed to sellers, so past order
// line-items stay resolvable.
router.patch('/products/:id/deactivate', requireAuth, requireSeller, async (req, res, next) => {
  try {
    const product = await db.get('products', req.params.id);
    if (!product || product.sellerId !== req.sellerUser.id) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }
    product.active = req.body.active !== false;
    await db.put('products', product);
    res.json({ success: true, product });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
