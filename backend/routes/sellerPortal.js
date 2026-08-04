const express = require('express');
const fs = require('fs');
const multer = require('multer');
const { v4: uuid } = require('uuid');
const db = require('../data/db');
const { requireAuth } = require('../middleware/auth');
const { imageUpload, storeUploadedFile } = require('../utils/imageUploadHandler');
const { UPLOADS_DIR } = require('../data/seed');
const cloudinary = require('../utils/cloudinary');
const { compressVideoAndStore } = require('../utils/mediaStore');
const { notifyUser } = require('../utils/notify');
const { sendMail } = require('../utils/mailer');
const { getSummary: getSellerSummary, computeSellerShares } = require('../utils/sellers');

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || process.env.CONTACT_NOTIFY_EMAIL;

const router = express.Router();

// Video needs disk storage (compressVideoAndStore transcodes from a path) and
// a much bigger cap than the 10 MB image limit — same setup admin banners use.
const videoUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOADS_DIR),
    filename: (req, file, cb) => {
      const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-60);
      cb(null, `${Date.now()}-${safe}`);
    },
  }),
  limits: { fileSize: 60 * 1024 * 1024 }, // 60 MB
  fileFilter: (req, file, cb) => {
    const ok = /\.(mp4|webm|ogg|mov)$/i.test(file.originalname);
    cb(ok ? null : new Error('Only mp4, webm, ogg or mov video files are allowed.'), ok);
  },
});

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

const slugify = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Seller-supplied links (lab report, storefront website) end up in an href on
 * a public page. Anything that isn't plain http/https — `javascript:` above
 * all — is dropped rather than stored, so a seller can't turn their own
 * listing into a script link. Returns '' for anything rejected. */
function safeUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(withScheme);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
  } catch {
    return '';
  }
}

// Optional trust markers on a listing, the same ones the store fills in for
// its own products (see admin.js) — they drive the batch panel on the product
// page and the public /batch/:number passport. A seller's are their own
// claims, so the product page credits them by name.
const COMPLIANCE_FIELDS = ['batchNumber', 'productionDate', 'bestBeforeDate', 'fssaiLicense', 'inciIngredients'];

function readCompliance(body, existing = {}) {
  const out = {};
  for (const f of COMPLIANCE_FIELDS) {
    out[f] = body[f] !== undefined ? String(body[f] || '').trim().slice(0, 300) : (existing[f] || '');
  }
  out.labReportUrl = body.labReportUrl !== undefined ? safeUrl(body.labReportUrl) : (existing.labReportUrl || '');
  return out;
}

// A seller whose product doesn't fit any existing category can propose a new
// one (`newCategory`) instead of picking from the list. It's created straight
// away so the listing has somewhere to live, but flagged `pending` — the
// public category list hides pending ones, so nobody can push an unreviewed
// tile onto the shop's category nav. An admin clears the flag in
// Admin → Categories. A label or slug that already matches reuses that
// category rather than minting a near-duplicate ("Cold Pressed Oils" next to
// the existing "Cold-Pressed Oils").
async function resolveCategory(body, seller) {
  const proposed = (body.newCategory || '').trim();
  if (!proposed) return { slug: body.category || '' };
  if (proposed.length < 2 || proposed.length > 60) {
    return { error: 'A category name needs to be between 2 and 60 characters.' };
  }
  const slug = slugify(proposed);
  if (!slug) return { error: 'Use some letters or numbers in the category name.' };

  const categories = await db.list('categories');
  const existing = categories.find(
    (c) => c.id === slug || (c.label || '').trim().toLowerCase() === proposed.toLowerCase()
  );
  if (existing) return { slug: existing.id };

  await db.put('categories', {
    id: slug,
    label: proposed,
    image: '',
    sort: categories.length,
    pending: true,
    proposedBy: seller.id,
    proposedByName: seller.sellerBusinessName || '',
    createdAt: new Date().toISOString(),
  });
  if (ADMIN_EMAIL) {
    sendMail({
      to: ADMIN_EMAIL,
      subject: `New category proposed: ${proposed}`,
      text: `${seller.sellerBusinessName || 'A seller'} listed a product under a new category "${proposed}".\n\n`
        + 'It stays hidden from the shop\'s category nav until you approve it in Admin → Categories.',
    }).catch(() => {});
  }
  return { slug, created: true };
}

// GET /api/seller/categories — approved categories plus any this seller has
// proposed and is still waiting on, so their own pending category is pickable
// for the next listing instead of having to be typed out again.
router.get('/categories', requireAuth, requireSeller, async (req, res, next) => {
  try {
    const categories = (await db.list('categories'))
      .filter((c) => !c.pending || c.proposedBy === req.sellerUser.id)
      .sort((a, b) => (a.sort || 0) - (b.sort || 0))
      .map((c) => ({ slug: c.id, label: c.label, pending: !!c.pending }));
    res.json({ success: true, categories });
  } catch (err) {
    next(err);
  }
});

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
        ...readProfile(user),
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

// Two groups of seller-editable detail. PUBLIC_* is shown to shoppers on the
// storefront page; BUSINESS_* is contact/compliance/payout information only
// the seller and the store team ever see (it is never returned by the public
// /storefront/:id route below). The platform fee rate and probation counter
// are in neither list — those stay admin-only.
const PUBLIC_PROFILE_FIELDS = {
  bio: { key: 'sellerBio', max: 1000 },
  location: { key: 'sellerLocation', max: 120 },
  // `url: true` — rendered as an href on the public storefront, so it goes
  // through safeUrl and anything that isn't http/https is discarded.
  website: { key: 'sellerWebsite', max: 200, url: true },
  instagram: { key: 'sellerInstagram', max: 100 },
};

const BUSINESS_PROFILE_FIELDS = {
  contactEmail: { key: 'sellerContactEmail', max: 160 },
  contactPhone: { key: 'sellerContactPhone', max: 20 },
  address: { key: 'sellerAddress', max: 400 },
  gstin: { key: 'sellerGstin', max: 20 },
  fssai: { key: 'sellerFssai', max: 30 },
  upiId: { key: 'sellerUpiId', max: 80 },
  bankAccountName: { key: 'sellerBankAccountName', max: 120 },
  bankAccountNumber: { key: 'sellerBankAccountNumber', max: 30 },
  bankIfsc: { key: 'sellerBankIfsc', max: 15 },
};

function readProfile(user) {
  const out = { businessName: user.sellerBusinessName || '', logo: user.sellerLogo || '' };
  for (const [field, { key }] of Object.entries({ ...PUBLIC_PROFILE_FIELDS, ...BUSINESS_PROFILE_FIELDS })) {
    out[field] = user[key] || '';
  }
  return out;
}

// PUT /api/seller/profile — a seller edits their own storefront and business
// details. Every field is optional except the business name; anything the
// request omits is left untouched rather than blanked, so a partial save from
// one section can't wipe the other.
router.put('/profile', requireAuth, requireSeller, async (req, res, next) => {
  try {
    const user = req.sellerUser;
    const businessName = (req.body.businessName || '').trim().slice(0, 120);
    if (businessName.length < 2) {
      return res.status(400).json({ success: false, message: 'Enter your business name.' });
    }
    if (req.body.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(req.body.contactEmail.trim())) {
      return res.status(400).json({ success: false, message: 'Enter a valid contact email address.' });
    }
    user.sellerBusinessName = businessName;
    for (const [field, { key, max, url }] of Object.entries({ ...PUBLIC_PROFILE_FIELDS, ...BUSINESS_PROFILE_FIELDS })) {
      if (req.body[field] === undefined) continue;
      user[key] = url ? safeUrl(req.body[field]) : String(req.body[field]).trim().slice(0, max);
    }
    if (req.body.logo !== undefined) user.sellerLogo = req.body.logo || '';
    await db.put('users', user);
    res.json({ success: true, profile: readProfile(user) });
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
      // Public fields only — contact/compliance/payout detail from
      // BUSINESS_PROFILE_FIELDS is deliberately never exposed here.
      seller: {
        id: seller.id,
        businessName: seller.sellerBusinessName,
        bio: seller.sellerBio || '',
        location: seller.sellerLocation || '',
        logo: seller.sellerLogo || '',
        website: seller.sellerWebsite || '',
        instagram: seller.sellerInstagram || '',
      },
      products: products.map((p) => ({ ...p, sellerName: seller.sellerBusinessName })),
    });
  } catch (err) {
    next(err);
  }
});

/* -------------------------- Seller <-> admin chat -------------------------- */
// Deliberately its OWN collection, not the `chat-messages` one used by
// customer support: a seller is also a customer, so reusing that collection
// would splice their business conversation into the same thread as any
// shopper support they've ever raised. Same message shape either way.

// GET /api/seller/chat/unread — count of admin replies not yet opened.
router.get('/chat/unread', requireAuth, requireSeller, async (req, res, next) => {
  try {
    const unread = (await db.list('seller-messages')).filter(
      (m) => m.sellerId === req.sellerUser.id && m.from === 'admin' && !m.readBySeller
    ).length;
    res.json({ success: true, unread });
  } catch (err) {
    next(err);
  }
});

// GET /api/seller/chat — my thread with the store team (marks admin replies read).
router.get('/chat', requireAuth, requireSeller, async (req, res, next) => {
  try {
    const messages = (await db.list('seller-messages'))
      .filter((m) => m.sellerId === req.sellerUser.id)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    for (const m of messages) {
      if (m.from === 'admin' && !m.readBySeller) {
        m.readBySeller = true;
        await db.put('seller-messages', m);
      }
    }
    res.json({ success: true, messages });
  } catch (err) {
    next(err);
  }
});

// POST /api/seller/chat  { text }
router.post('/chat', requireAuth, requireSeller, async (req, res, next) => {
  try {
    const text = (req.body.text || '').trim();
    if (!text) return res.status(400).json({ success: false, message: 'Message cannot be empty.' });
    if (text.length > 2000) return res.status(400).json({ success: false, message: 'Message is too long.' });

    const message = {
      id: uuid(),
      sellerId: req.sellerUser.id,
      from: 'seller',
      text,
      readByAdmin: false,
      readBySeller: true,
      createdAt: new Date().toISOString(),
    };
    await db.put('seller-messages', message);
    res.status(201).json({ success: true, message });

    // Best-effort, detached from the response — the in-app unread badge only
    // helps while the admin panel is actually open. Mirrors routes/chat.js.
    if (ADMIN_EMAIL) {
      sendMail({
        to: ADMIN_EMAIL,
        subject: `Seller message from ${req.sellerUser.sellerBusinessName}`,
        text: `${req.sellerUser.sellerBusinessName} (${req.sellerUser.phone}) wrote:\n\n${text}\n\nReply in Admin → Sellers → Chat.`,
      }).catch(() => {});
    }
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

// POST /api/seller/upload-video — a short demo/how-it's-made clip for a
// listing. Mirrors the admin banner upload: Cloudinary when configured,
// otherwise transcode to a size-capped MP4 held in the DB so it survives a
// host that wipes local disk on redeploy.
// Multer rejects (wrong type, over the size cap) surface as thrown errors —
// turn them into a readable 400 rather than a generic 500.
function handleVideoUpload(req, res, next) {
  videoUpload.single('file')(req, res, (err) => {
    if (!err) return next();
    const tooBig = err.code === 'LIMIT_FILE_SIZE';
    res.status(400).json({
      success: false,
      message: tooBig ? 'That video is over the 60 MB limit — please upload a shorter clip.' : err.message,
    });
  });
}

router.post('/upload-video', requireAuth, requireSeller, handleVideoUpload, async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'A video file is required.' });
    let url;
    if (cloudinary.isConfigured()) {
      const uploaded = await cloudinary.uploadFile(req.file.path, { resourceType: 'video' });
      url = uploaded.url;
    } else {
      url = await compressVideoAndStore(req.file.path, { keepAudio: true });
    }
    fs.unlink(req.file.path, () => {});
    res.status(201).json({ success: true, url });
  } catch (err) {
    if (req.file?.path) fs.unlink(req.file.path, () => {});
    next(err);
  }
});

// GET /api/seller/orders — every order containing one of this seller's
// products, newest first.
//
// Deliberately withholds the customer's identity: the store fulfils these
// orders, so a seller has no reason to see a shopper's name, phone, email or
// street address. They get the city/state for context and nothing more. If
// sellers ever dispatch directly, this is the one place that has to change.
//
// `earned` is the real ledger entry once the order is delivered and credited;
// before that it's `estimated`, computed by the same function that will do the
// crediting, so the two can never disagree.
router.get('/orders', requireAuth, requireSeller, async (req, res, next) => {
  try {
    const sellerId = req.sellerUser.id;
    const [orders, ledger] = await Promise.all([db.list('orders'), db.list('seller-ledger')]);
    const earnedByOrder = Object.fromEntries(
      ledger.filter((e) => e.sellerId === sellerId && e.orderId).map((e) => [e.orderId, e.amount])
    );

    const mine = [];
    const cache = {}; // one products/users read for the whole loop, not per order
    for (const order of orders) {
      const share = (await computeSellerShares(order, cache))[sellerId];
      if (!share) continue;
      mine.push({
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        placedAt: order.createdAt,
        items: share.items,
        subtotal: share.subtotal,
        estimated: share.amount,
        earned: earnedByOrder[order.id] ?? null,
        destination: [order.address?.city, order.address?.state].filter(Boolean).join(', '),
        returnStatus: order.returnRequest?.status || null,
      });
    }
    mine.sort((a, b) => new Date(b.placedAt) - new Date(a.placedAt));
    res.json({ success: true, orders: mine });
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
    const category = await resolveCategory(req.body, req.sellerUser);
    if (category.error) return res.status(400).json({ success: false, message: category.error });
    const error = validateSellerProduct({ ...req.body, category: category.slug });
    if (error) return res.status(400).json({ success: false, message: error });

    const id = `${slugify(req.body.name)}-${uuid().slice(0, 8)}`;
    const probationActive = (req.sellerUser.sellerProbationRemaining || 0) > 0;

    const product = {
      id,
      name: req.body.name,
      category: category.slug,
      shortDescription: req.body.shortDescription || '',
      description: req.body.description || '',
      shortDescriptions: {},
      descriptions: {},
      image: req.body.image || '',
      images: Array.isArray(req.body.images) && req.body.images.length ? req.body.images : (req.body.image ? [req.body.image] : []),
      video: req.body.video || '',
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
      ...readCompliance(req.body),
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
    const category = await resolveCategory(req.body, req.sellerUser);
    if (category.error) return res.status(400).json({ success: false, message: category.error });
    const error = validateSellerProduct({ ...req.body, category: category.slug });
    if (error) return res.status(400).json({ success: false, message: error });

    const updated = {
      ...existing,
      name: req.body.name,
      category: category.slug,
      shortDescription: req.body.shortDescription || '',
      description: req.body.description || '',
      image: req.body.image || '',
      images: Array.isArray(req.body.images) && req.body.images.length ? req.body.images : (req.body.image ? [req.body.image] : []),
      video: req.body.video ?? existing.video ?? '',
      sizes: req.body.sizes.map((s) => ({
        label: s.label,
        price: Number(s.price),
        mrp: Number(s.mrp || s.price),
        stock: Number(s.stock || 0),
        wholesalePrice: null,
      })),
      ...readCompliance(req.body, existing),
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
