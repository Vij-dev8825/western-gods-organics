const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { v4: uuid } = require('uuid');
const db = require('../data/db');
const { requireAdmin } = require('../middleware/auth');
const { notifyUser, broadcast } = require('../utils/notify');
const { UPLOADS_DIR } = require('../data/seed');
const cloudinary = require('../utils/cloudinary');
const {
  compressAndStore,
  compressVideoAndStore,
  BANNER_VIDEO_MAX_HEIGHT,
  BANNER_VIDEO_BITRATE,
} = require('../utils/mediaStore');
const { processDueSubscriptions } = require('../utils/subscriptions');
const { processAbandonedCarts } = require('../utils/abandonedCarts');
const { processReorderNudges } = require('../utils/reorderNudges');
const { processReviewRequests } = require('../utils/reviewRequests');
const { PAGES: PAGE_BANNER_PAGES } = require('./pageBanners');
const { sendMail } = require('../utils/mailer');
const { sendWhatsApp } = require('../utils/whatsapp');
const { getCountries, getFullLiveRates } = require('./currency');
const { translateProductText } = require('../utils/translateProduct');
const { suggestProductAnswer } = require('../utils/aiAnswerSuggestion');
const { listAll: listAllPressings, countReserved } = require('../utils/pressings');
const { imageUpload, storeUploadedFile } = require('../utils/imageUploadHandler');
const { cutOutFlower } = require('../utils/flowerCutout');
const { buildBatchLabelPdf } = require('../utils/batchLabels');
const { buildProfitReport } = require('../utils/profit');
const pookalamContest = require('../utils/pookalam');
const { sendInvoiceForOrder } = require('../utils/sendInvoice');
const { buildProcurementPlan } = require('../utils/procurement');
const { listAll: listAllFestivals, DEFAULT_LEAD_DAYS: FESTIVAL_LEAD_DAYS } = require('../utils/festivals');
const { buildRateCardPdf } = require('../utils/rateCard');
const { buildPriceListPdf } = require('../utils/priceList');
const { buildCatalogMargins } = require('../utils/catalogMargin');
const { sendWhatsAppFile } = require('../utils/whatsapp');
const { buildInvoicePdf, invoiceFileName } = require('../utils/invoicePdf');
const { ordersCsv, productsCsv, customersCsv } = require('../utils/csvExport');
const { creditPointsForOrder, reversePointsForOrder } = require('../utils/loyalty');
const { issueBottleReturnCredit, buildOrderItems, createOrderRecord } = require('../utils/orderBuilder');
const { findUserByPhone, resolveGuestUser } = require('../utils/customers');
const { listFeedback, openFeedback, markHandled, feedbackSummary } = require('../utils/orderFeedback');
const { restoreStockForOrder, applyStockForOrder } = require('../utils/stock');
const whatsappBaileys = require('../utils/whatsappBaileys');
const whatsappOrdering = require('../utils/whatsappOrdering');
const { getPaymentMethodsConfig } = require('../utils/paymentMethods');
const { getShippingSettings } = require('../utils/shippingSettings');
const { getInvoiceSettings } = require('../utils/invoiceSettings');
const { cancelGiftCard } = require('../utils/giftCards');
const { generateUniqueAffiliateCode, getCommissionSummary, recordPayout, creditCommissionForOrder, reverseCommissionForOrder } = require('../utils/affiliates');
const { getSummary: getSellerSummary, recordPayout: recordSellerPayout, creditSellerEarningsForOrder, reverseSellerEarningsForOrder } = require('../utils/sellers');
const { auditAdminMutations, listAuditLog } = require('../utils/auditLog');
const { listClientErrors } = require('../utils/clientErrors');

/** Undoes everything a delivery credited — the customer's points, the
 * referring affiliate's commission and each seller's share — when that sale
 * turns out not to have stood. Each of the three is individually idempotent,
 * so calling this twice on the same order is harmless. */
async function reverseCreditsForOrder(order, reason) {
  await reversePointsForOrder(order, reason);
  await reverseCommissionForOrder(order, reason);
  await reverseSellerEarningsForOrder(order, reason);
}
const {
  getEligibleRecipients,
  sendBroadcast: sendWhatsAppBroadcast,
  getBroadcastLog,
  WINDOW_MS: WHATSAPP_BROADCAST_WINDOW_MS,
} = require('../utils/whatsappBroadcast');

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || process.env.CONTACT_NOTIFY_EMAIL;
const ADMIN_PHONE = process.env.ADMIN_PHONE;

const router = express.Router();
router.use(requireAdmin);
// After the gate, so entries always have an actor and unauthenticated probes
// never reach it. Covers every mutation below, including ones added later.
router.use(auditAdminMutations);

/* --------------------------------- Uploads -------------------------------- */

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-60);
    cb(null, `${Date.now()}-${safe}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB
  fileFilter: (req, file, cb) => {
    const ok = /\.(mp4|webm|ogg|jpe?g|png|webp)$/i.test(file.originalname);
    cb(ok ? null : new Error('Only mp4/webm/ogg video or jpg/png/webp image files are allowed.'), ok);
  },
});

/* -------------------------------- Dashboard ------------------------------- */

// GET /api/admin/stats
router.get('/stats', async (req, res, next) => {
  try {
    const [users, products, orders, enquiries, contacts, chats, comments, posts] = await Promise.all([
      db.list('users'),
      db.list('products'),
      db.list('orders'),
      db.list('bulk-enquiries'),
      db.list('contacts'),
      db.list('chat-messages'),
      db.list('blog-comments'),
      db.list('blog-posts'),
    ]);

    const revenue = orders.reduce((sum, o) => sum + (o.total || 0), 0);

    // Recent sales velocity (units/day, aggregated across all customers) for
    // each product+size, over a trailing window — used below to turn "stock
    // is low right now" into "here's roughly how long that'll last", so a
    // restock can be timed instead of reacting after the fact. Cancelled
    // orders are excluded since they were never actually fulfilled demand.
    const FORECAST_WINDOW_DAYS = 30;
    const forecastCutoff = Date.now() - FORECAST_WINDOW_DAYS * 24 * 60 * 60 * 1000;
    const recentItems = orders
      .filter((o) => o.status !== 'cancelled' && new Date(o.createdAt).getTime() >= forecastCutoff)
      .flatMap((o) => o.items);

    const lowStock = [];
    for (const p of products) {
      for (const s of p.sizes || []) {
        if (s.stock <= 10) {
          const unitsSoldRecently = recentItems
            .filter((it) => it.productId === p.id && it.size === s.label)
            .reduce((sum, it) => sum + it.quantity, 0);
          const perDay = unitsSoldRecently / FORECAST_WINDOW_DAYS;
          const daysLeft = perDay > 0 ? Math.round(s.stock / perDay) : null;
          lowStock.push({ productId: p.id, name: p.name, size: s.label, stock: s.stock, daysLeft });
        }
      }
    }

    const today = new Date().toISOString().slice(0, 10);
    const todayOrders = orders.filter((o) => o.createdAt?.slice(0, 10) === today);
    const postTitleById = Object.fromEntries(posts.map((p) => [p.id, p.title]));

    // Daily orders/revenue for the last 14 days — not filtered by status,
    // matching the same unfiltered convention the revenue/todayRevenue tiles
    // above already use, so this never appears to disagree with them for the
    // same day.
    const TREND_DAYS = 14;
    const salesTrend = [];
    for (let i = TREND_DAYS - 1; i >= 0; i--) {
      const dateStr = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const dayOrders = orders.filter((o) => o.createdAt?.slice(0, 10) === dateStr);
      salesTrend.push({
        date: dateStr,
        orders: dayOrders.length,
        revenue: dayOrders.reduce((sum, o) => sum + (o.total || 0), 0),
      });
    }

    // Best-selling products (units + revenue) over the same trailing window
    // and cancelled-excluded item list already computed above for the
    // low-stock forecast — aggregated per product (across all its sizes)
    // for a "what's actually driving sales" view the point-in-time tiles
    // above don't show.
    const salesByProduct = {};
    for (const it of recentItems) {
      const agg = (salesByProduct[it.productId] ||= { unitsSold: 0, revenue: 0 });
      agg.unitsSold += it.quantity;
      agg.revenue += it.quantity * it.price;
    }
    const productNameById = Object.fromEntries(products.map((p) => [p.id, p.name]));
    const bestSellers = Object.entries(salesByProduct)
      .map(([productId, agg]) => ({ productId, name: productNameById[productId] || 'Unknown product', ...agg }))
      .sort((a, b) => b.unitsSold - a.unitsSold)
      .slice(0, 10);

    res.json({
      success: true,
      dbMode: db.getMode(),
      stats: {
        customers: users.filter((u) => u.role !== 'admin').length,
        products: products.length,
        orders: orders.length,
        revenue,
        pendingOrders: orders.filter((o) => o.status === 'placed').length,
        todayOrders: todayOrders.length,
        todayRevenue: todayOrders.reduce((sum, o) => sum + (o.total || 0), 0),
        newEnquiries: enquiries.filter((e) => e.status === 'new').length,
        contacts: contacts.length,
        unreadChats: chats.filter((m) => m.from === 'user' && !m.readByAdmin).length,
      },
      lowStock,
      salesTrend,
      bestSellers,
      recentOrders: orders.slice(-8).reverse(),
      recentEnquiries: enquiries.slice(-5).reverse(),
      recentContacts: contacts.slice(-5).reverse(),
      recentComments: comments
        .slice(-5)
        .reverse()
        .map((c) => ({ ...c, postTitle: postTitleById[c.postId] || 'Unknown post' })),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/admin/today — everything currently waiting on a person.
 *
 * Deliberately not a smaller /stats. The dashboard answers "how is the shop
 * doing" — trends, best sellers, recent everything — and you read it when you
 * want to know something. This answers "what do I have to do right now", and
 * it should be the first screen open in the morning and empty by evening.
 *
 * So the rule for anything here: it must be actionable and it must be able to
 * reach zero. Revenue is neither, and is not included. Counts that only ever
 * grow belong on the dashboard.
 */
router.get('/today', async (req, res, next) => {
  try {
    const [
      orders, products, questions, enquiries, chats,
      sellerApps, payoutRequests, sellerMessages, stockNotify, users,
    ] = await Promise.all([
      db.list('orders'),
      db.list('products'),
      db.list('product-questions'),
      db.list('bulk-enquiries'),
      db.list('chat-messages'),
      db.list('seller-applications'),
      db.list('seller-payout-requests'),
      db.list('seller-messages'),
      db.list('stock-notify'),
      db.list('users'),
    ]);

    const productById = Object.fromEntries(products.map((p) => [p.id, p]));
    const userNameById = Object.fromEntries(users.map((u) => [u.id, u.name || u.phone || 'Someone']));
    const slim = (o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      total: o.total,
      itemCount: (o.items || []).reduce((n, i) => n + (i.quantity || 0), 0),
      customer: o.address?.name || o.guestName || userNameById[o.userId] || 'Guest',
      city: o.address?.city || '',
      paymentMethod: o.paymentMethod,
      createdAt: o.createdAt,
    });

    // Oldest first everywhere below: the thing someone has been waiting
    // longest for is the thing that should be done next, which is the reverse
    // of the newest-first ordering every listing screen uses.
    const byOldest = (a, b) => String(a.createdAt).localeCompare(String(b.createdAt));

    // On a busy day a queue can run to hundreds, and a screen that renders all
    // of them is the wall of information this page exists to replace. Each
    // list is trimmed to the oldest few, but the total is always reported
    // alongside so the page can say how many are behind it — a truncation
    // nobody is told about reads as "that's all of them", which is worse than
    // showing everything.
    const LIST_CAP = 8;
    const capped = (rows) => ({ list: rows.slice(0, LIST_CAP), total: rows.length });

    const toConfirm = capped(orders.filter((o) => o.status === 'placed').sort(byOldest).map(slim));
    const toShip = capped(orders.filter((o) => o.status === 'confirmed').sort(byOldest).map(slim));
    const inTransit = orders.filter((o) => o.status === 'shipped').length;

    // Same "≤ 10 units" line the dashboard's low-stock card draws, kept
    // deliberately in step with it — two different definitions of "low" across
    // two admin screens is how you end up trusting neither.
    const lowStock = [];
    for (const p of products) {
      for (const s of p.sizes || []) {
        if (s.stock <= 10) lowStock.push({ productId: p.id, name: p.name, size: s.label, stock: s.stock });
      }
    }
    lowStock.sort((a, b) => a.stock - b.stock);

    // Someone asked to be told when this came back. If it has, that promise is
    // now owed — and nothing else in the admin surfaces it.
    const waiting = {};
    for (const w of stockNotify) {
      const key = `${w.productId}|${w.size}`;
      (waiting[key] ||= { productId: w.productId, size: w.size, people: 0 }).people += 1;
    }
    const waitingForStock = capped(
      Object.values(waiting)
        .map((w) => {
          const product = productById[w.productId];
          const size = product?.sizes?.find((s) => s.label === w.size);
          return { ...w, name: product?.name || 'Unknown product', stock: size?.stock ?? 0 };
        })
        .filter((w) => w.stock > 0)
        .sort((a, b) => b.people - a.people)
    );

    res.json({
      success: true,
      toConfirm,
      toShip,
      inTransit,
      lowStock: capped(lowStock),
      waitingForStock,
      unansweredQuestions: capped(
        questions
          .filter((q) => !q.answeredAt)
          .sort(byOldest)
          .map((q) => ({
            id: q.id,
            text: q.text,
            productId: q.productId,
            productName: productById[q.productId]?.name || 'Unknown product',
            createdAt: q.createdAt,
          }))
      ),
      newEnquiries: capped(
        enquiries
          .filter((e) => e.status === 'new')
          .sort(byOldest)
          .map((e) => ({ id: e.id, name: e.name, quantity: e.quantity, unit: e.unit, productCategory: e.productCategory }))
      ),
      sellerApplications: capped(
        sellerApps
          .filter((a) => a.status === 'pending')
          .sort(byOldest)
          .map((a) => ({ id: a.id, businessName: a.businessName, whatTheySell: a.whatTheySell }))
      ),
      payoutRequests: capped(
        payoutRequests
          .filter((r) => r.status === 'pending')
          .sort(byOldest)
          .map((r) => ({ id: r.id, businessName: r.businessName, amount: r.amount }))
      ),
      // A customer who said something went wrong is the most time-sensitive
      // thing on this page — a leaking bottle put right the same day is a
      // story they tell; found a week later it is a refund and a bad review.
      unhappyCustomers: capped(
        (await openFeedback()).sort(byOldest).map((f) => ({
          id: f.id,
          orderNumber: f.orderNumber,
          customerName: f.customerName,
          customerPhone: f.customerPhone,
          rating: f.rating,
          issues: f.issues,
          comment: f.comment,
          createdAt: f.createdAt,
        }))
      ),
      unreadChats: chats.filter((m) => m.from === 'user' && !m.readByAdmin).length,
      unreadSellerMessages: sellerMessages.filter((m) => m.from === 'seller' && !m.readByAdmin).length,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/products/:id/batch-labels.pdf?count=18 — a printable sheet of
// QR labels for this product's current batch, each pointing at that batch's
// public passport page. Opened in a tab and printed, so it's a GET rather than
// a POST — which also keeps it clear of the host's block on authenticated
// POSTs to admin routes.
router.get('/products/:id/batch-labels.pdf', async (req, res, next) => {
  try {
    const product = await db.get('products', req.params.id);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found.' });

    const requested = Number(req.query.count);
    // One full sheet by default. Capped so a stray digit in the address bar
    // can't ask the server to render ten thousand pages.
    const count = Math.min(Math.max(Number.isFinite(requested) ? Math.round(requested) : 18, 1), 600);
    const siteUrl = (process.env.SITE_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');

    const pdf = await buildBatchLabelPdf({ product, siteUrl, count });
    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', `inline; filename="batch-${product.batchNumber}-labels.pdf"`);
    res.send(pdf);
  } catch (err) {
    if (/no batch number/i.test(err.message)) {
      return res.status(400).json({ success: false, message: err.message });
    }
    next(err);
  }
});

/* -------------------------------- Uploads --------------------------------- */

// POST /api/admin/upload-image — multipart 'file' → { url } for use as a
// product/category image (banners have their own dedicated upload below).
// Shared with the customer-facing review-photo upload in routes/products.js.
router.post('/upload-image', imageUpload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'An image file is required.' });
    const url = await storeUploadedFile(req.file);
    res.status(201).json({ success: true, url });
  } catch (err) {
    next(err);
  }
});

/* -------------------------------- Products -------------------------------- */

function validateProduct(body) {
  if (!body.name || !body.category) return 'Name and category are required.';
  if (!Array.isArray(body.sizes) || body.sizes.length === 0) return 'At least one size with price is required.';
  for (const s of body.sizes) {
    if (!s.label || s.price == null) return 'Every size needs a label and a price.';
  }
  return null;
}

// Per-country display-price overrides, e.g. { US: { '500 ml': 4.99 } }.
// Keyed by country code; values are already in that country's local
// currency (not INR). Invalid/blank entries are silently dropped.
function normalizeCountryPrices(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [code, sizes] of Object.entries(raw)) {
    if (!sizes || typeof sizes !== 'object') continue;
    const sizeOut = {};
    for (const [label, val] of Object.entries(sizes)) {
      const num = Number(val);
      if (label && val !== '' && val != null && Number.isFinite(num) && num > 0) sizeOut[label] = num;
    }
    if (Object.keys(sizeOut).length) out[code] = sizeOut;
  }
  return out;
}

// Per-language description overrides, e.g. { hi: '...', ta: '...' }. English
// isn't a key here — it stays in the base name/description/shortDescription
// fields and is the fallback whenever a language has no translation yet.
const TRANSLATABLE_LANG_CODES = ['hi', 'ta', 'te', 'kn'];

function sanitizeLangMap(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const code of TRANSLATABLE_LANG_CODES) {
    const val = raw[code];
    if (typeof val === 'string' && val.trim()) out[code] = val.trim();
  }
  return out;
}

// POST /api/admin/products
router.post('/products', async (req, res, next) => {
  try {
    const error = validateProduct(req.body);
    if (error) return res.status(400).json({ success: false, message: error });

    const id = req.body.id || req.body.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    if (await db.get('products', id)) {
      return res.status(409).json({ success: false, message: `A product with id "${id}" already exists.` });
    }

    const product = {
      id,
      name: req.body.name,
      category: req.body.category,
      shortDescription: req.body.shortDescription || '',
      description: req.body.description || '',
      // In Tamil Nadu the Tamil name is the name — நல்லெண்ணெய், not a
      // translation of "Cold-Pressed Sesame Oil". Optional per product; a
      // blank map falls back to the English name everywhere.
      names: sanitizeLangMap(req.body.names),
      // Ten seconds of oil coming off the press is the most persuasive thing
      // this shop owns, and it belongs on the page where someone is deciding.
      // Named `video` because ProductDetail has rendered product.video since
      // long before this — the markup was there, nothing ever filled it.
      video: req.body.video || '',
      shortDescriptions: sanitizeLangMap(req.body.shortDescriptions),
      descriptions: sanitizeLangMap(req.body.descriptions),
      image: req.body.image || '',
      images: Array.isArray(req.body.images) && req.body.images.length ? req.body.images : (req.body.image ? [req.body.image] : []),
      sizes: req.body.sizes.map((s) => ({
        label: s.label,
        price: Number(s.price),
        mrp: Number(s.mrp || s.price),
        stock: Number(s.stock || 0),
        wholesalePrice: s.wholesalePrice !== '' && s.wholesalePrice != null ? Number(s.wholesalePrice) : null,
        // What this unit costs to make and pack. null, not 0, when unrecorded —
        // Admin → Profit excludes an order it can't cost rather than reporting
        // it as free to produce.
        costPrice: s.costPrice !== '' && s.costPrice != null ? Number(s.costPrice) : null,
        // Seed (or milk, or flowers) that goes in to get one of these out —
        // in the product's own materialUnit. Optional; Admin → Procurement
        // still lists the run without it, just not the kilos.
        materialPerUnit: s.materialPerUnit !== '' && s.materialPerUnit != null ? Number(s.materialPerUnit) : null,
      })),
      rating: Number(req.body.rating || 0),
      reviewsCount: Number(req.body.reviewsCount || 0),
      tags: req.body.tags || [],
      comboItems: Array.isArray(req.body.comboItems) ? req.body.comboItems.filter(Boolean) : [],
      // Real product ids this combo bundles — unlike comboItems (free-text,
      // display only), this is a structured link used to cross-sell the kit
      // from each of its component products' own pages (see ProductDetail.jsx).
      comboProductIds: Array.isArray(req.body.comboProductIds) ? req.body.comboProductIds.filter(Boolean) : [],
      isNew: Boolean(req.body.isNew),
      // Silver/Gold reward members can shop this product before this date —
      // see utils/loyalty.js hasEarlyAccessPerk and routes/products.js.
      earlyAccessUntil: req.body.earlyAccessUntil || null,
      countryPrices: normalizeCountryPrices(req.body.countryPrices),
      batchNumber: req.body.batchNumber || '',
      productionDate: req.body.productionDate || '',
      bestBeforeDate: req.body.bestBeforeDate || '',
      // Who grew what went into this batch. "Organic" is a word anyone can
      // print; a grower's name and village is a specific, checkable claim, and
      // it is the kind a mill buying direct can actually make.
      growerName: req.body.growerName || '',
      growerVillage: req.body.growerVillage || '',
      // What this is made from, as you'd say it on the phone to the grower —
      // "Groundnut", "Neem seed", "Hibiscus". Admin → Procurement adds these
      // up across scheduled runs into one buying list.
      rawMaterial: req.body.rawMaterial || '',
      materialUnit: req.body.materialUnit || 'kg',
      fssaiLicense: req.body.fssaiLicense || '',
      inciIngredients: req.body.inciIngredients || '',
      labReportUrl: req.body.labReportUrl || '',
      marketPricePer100: req.body.marketPricePer100 ? Number(req.body.marketPricePer100) : null,
      // Null for every store-created product (this route) — set only by
      // POST /api/seller/products, which builds its own separate, leaner
      // product object (see routes/sellerPortal.js).
      sellerId: null,
      createdAt: new Date().toISOString(),
    };
    await db.put('products', product);
    res.status(201).json({ success: true, product });
  } catch (err) {
    next(err);
  }
});

// PUT /api/admin/products/:id  (body may include notifyCustomers: true to
// announce price drops to everyone by in-app + email)
router.put('/products/:id', async (req, res, next) => {
  try {
    const existing = await db.get('products', req.params.id);
    if (!existing) return res.status(404).json({ success: false, message: 'Product not found.' });

    const error = validateProduct({ ...existing, ...req.body });
    if (error) return res.status(400).json({ success: false, message: error });

    const updated = {
      ...existing,
      ...req.body,
      id: existing.id,
      sizes: (req.body.sizes || existing.sizes).map((s) => ({
        label: s.label,
        price: Number(s.price),
        mrp: Number(s.mrp || s.price),
        stock: Number(s.stock || 0),
        wholesalePrice: s.wholesalePrice !== '' && s.wholesalePrice != null ? Number(s.wholesalePrice) : null,
        // What this unit costs to make and pack. null, not 0, when unrecorded —
        // Admin → Profit excludes an order it can't cost rather than reporting
        // it as free to produce.
        costPrice: s.costPrice !== '' && s.costPrice != null ? Number(s.costPrice) : null,
        // Seed (or milk, or flowers) that goes in to get one of these out —
        // in the product's own materialUnit. Optional; Admin → Procurement
        // still lists the run without it, just not the kilos.
        materialPerUnit: s.materialPerUnit !== '' && s.materialPerUnit != null ? Number(s.materialPerUnit) : null,
      })),
      countryPrices: normalizeCountryPrices(req.body.countryPrices ?? existing.countryPrices),
      names: sanitizeLangMap(req.body.names ?? existing.names),
      video: req.body.video ?? existing.video ?? '',
      shortDescriptions: sanitizeLangMap(req.body.shortDescriptions ?? existing.shortDescriptions),
      descriptions: sanitizeLangMap(req.body.descriptions ?? existing.descriptions),
      comboProductIds: Array.isArray(req.body.comboProductIds ?? existing.comboProductIds)
        ? (req.body.comboProductIds ?? existing.comboProductIds).filter(Boolean)
        : [],
      updatedAt: new Date().toISOString(),
    };
    delete updated.notifyCustomers;
    await db.put('products', updated);

    // Detect price drops for the announcement.
    const drops = [];
    for (const s of updated.sizes) {
      const before = existing.sizes.find((x) => x.label === s.label);
      if (before && s.price < before.price) drops.push(`${s.label}: ₹${before.price} → ₹${s.price}`);
    }

    let notified = null;
    if (req.body.notifyCustomers && drops.length) {
      notified = await broadcast({
        title: `Price drop: ${updated.name}`,
        message: `${updated.name} is now cheaper — ${drops.join(', ')}. Order at the new price today!`,
        channels: { inapp: true, email: true },
        meta: { productId: updated.id },
      });
    }

    // Automatically tells anyone who's wishlisted this product about a price
    // drop, independent of the "notify everyone" checkbox above — targeted
    // at people who actually wanted this item, not a broadcast, so it works
    // even when the admin doesn't remember (or want) to notify everyone.
    if (drops.length) {
      const wishlists = await db.list('wishlists');
      const wishlisterIds = wishlists.filter((w) => (w.items || []).includes(updated.id)).map((w) => w.id);
      for (const userId of wishlisterIds) {
        const user = await db.get('users', userId);
        if (user) {
          await notifyUser(user, {
            title: `Price drop on your wishlist: ${updated.name}`,
            message: `${updated.name} just got cheaper — ${drops.join(', ')}. It's on your wishlist!`,
            meta: { productId: updated.id },
            channels: { inapp: true, email: true },
          });
        }
      }
    }

    // Notify anyone who asked to be told when a now-restocked size returns,
    // then clear those requests out (one-shot, re-subscribe if it runs out again).
    const restockedLabels = updated.sizes
      .filter((s) => existing.sizes.find((x) => x.label === s.label && x.stock <= 0) && s.stock > 0)
      .map((s) => s.label);
    if (restockedLabels.length) {
      const pending = (await db.list('stock-notify')).filter(
        (n) => n.productId === updated.id && restockedLabels.includes(n.size)
      );
      for (const sub of pending) {
        if (sub.userId) {
          const user = await db.get('users', sub.userId);
          if (user) {
            await notifyUser(user, {
              title: `Back in stock: ${updated.name}`,
              message: `${updated.name} (${sub.size}) is back in stock — order now before it sells out again!`,
              meta: { productId: updated.id },
              channels: { inapp: true, email: true },
            });
          }
        } else if (sub.email) {
          await sendMail({
            to: sub.email,
            subject: `Back in stock: ${updated.name}`,
            text: `${updated.name} (${sub.size}) is back in stock at Western Gods Organics.\n\nOrder now: ${process.env.SITE_URL || 'https://westerngodsorganic.com'}/product/${updated.id}`,
          }).catch(() => {});
        }
        await db.remove('stock-notify', sub.id);
      }
    }

    // Alert the admin the moment a size crosses down into low stock (same
    // ≤10 threshold as the Dashboard's "Low stock" widget), so a restock can
    // happen before it silently runs out — instead of finding out from a
    // customer's back-in-stock signup after the fact.
    const LOW_STOCK_THRESHOLD = 10;
    const newlyLowStock = updated.sizes.filter((s) => {
      const before = existing.sizes.find((x) => x.label === s.label);
      return before && before.stock > LOW_STOCK_THRESHOLD && s.stock <= LOW_STOCK_THRESHOLD;
    });
    if (newlyLowStock.length) {
      const lines = newlyLowStock.map((s) => `${s.label}: ${s.stock} unit(s) left`).join('\n');
      const message = `${updated.name} just dropped to low stock:\n\n${lines}\n\nRestock soon to avoid running out.`;
      if (ADMIN_EMAIL) {
        await sendMail({ to: ADMIN_EMAIL, subject: `Low stock: ${updated.name}`, text: message }).catch(() => {});
      }
      if (ADMIN_PHONE) {
        await sendWhatsApp(ADMIN_PHONE, `*Low stock: ${updated.name}*\n${message}`).catch(() => {});
      }
    }

    res.json({ success: true, product: updated, notified });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/admin/products/:id
router.delete('/products/:id', async (req, res, next) => {
  try {
    await db.remove('products', req.params.id);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/products/translate-description  { name, shortDescription, description }
// Stateless — translates whatever text is currently in the form (including
// unsaved edits) and returns suggestions for the admin to review before
// clicking Save. Doesn't touch the database itself.
router.post('/products/translate-description', async (req, res, next) => {
  try {
    const { name, shortDescription, description } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Product name is required.' });
    const result = await translateProductText({ name, shortDescription, description });
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
});

// POST /api/admin/products/translate-all — best-effort bulk pass: translates
// and saves every product that's missing one or more of the 4 languages,
// leaving products that already have all 4 (e.g. hand-edited ones) untouched
// so it never clobbers a manual correction. Meant to be triggered explicitly
// from a confirm dialog in Admin, not run silently.
router.post('/products/translate-all', async (req, res, next) => {
  try {
    const products = await db.list('products');
    const LANGS = ['hi', 'ta', 'te', 'kn'];
    const todo = products.filter((p) => LANGS.some((l) => !p.descriptions?.[l] || !p.shortDescriptions?.[l]));

    let translated = 0;
    const errors = [];
    for (const product of todo) {
      try {
        const result = await translateProductText({
          name: product.name,
          shortDescription: product.shortDescription,
          description: product.description,
        });
        await db.put('products', {
          ...product,
          shortDescriptions: { ...result.shortDescriptions, ...product.shortDescriptions },
          descriptions: { ...result.descriptions, ...product.descriptions },
          updatedAt: new Date().toISOString(),
        });
        translated += 1;
      } catch (err) {
        errors.push({ id: product.id, name: product.name, message: err.message });
      }
    }

    res.json({ success: true, total: todo.length, translated, skipped: products.length - todo.length, errors });
  } catch (err) {
    next(err);
  }
});

/* ------------------------------- Categories ------------------------------- */

// GET /api/admin/categories (includes inactive/sort data)
router.get('/categories', async (req, res, next) => {
  try {
    const categories = (await db.list('categories')).sort((a, b) => (a.sort || 0) - (b.sort || 0));
    res.json({ success: true, categories });
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/categories  { label, image?, id? }
router.post('/categories', async (req, res, next) => {
  try {
    if (!req.body.label) return res.status(400).json({ success: false, message: 'Label is required.' });
    const id = req.body.id || req.body.label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    if (await db.get('categories', id)) {
      return res.status(409).json({ success: false, message: `Category "${id}" already exists.` });
    }
    const categories = await db.list('categories');
    const category = {
      id,
      label: req.body.label,
      image: req.body.image || '',
      // Body copy shown on the category's own /shop?category= page — this is
      // what a category needs to genuinely rank for its own term rather than
      // being a bare list of products with no supporting text.
      description: req.body.description || '',
      sort: categories.length,
    };
    await db.put('categories', category);
    res.status(201).json({ success: true, category });
  } catch (err) {
    next(err);
  }
});

// PUT /api/admin/categories/:id
router.put('/categories/:id', async (req, res, next) => {
  try {
    const existing = await db.get('categories', req.params.id);
    if (!existing) return res.status(404).json({ success: false, message: 'Category not found.' });
    const category = { ...existing, ...req.body, id: existing.id };
    await db.put('categories', category);
    res.json({ success: true, category });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/admin/categories/:id
router.delete('/categories/:id', async (req, res, next) => {
  try {
    const products = await db.list('products');
    if (products.some((p) => p.category === req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'This category still has products. Move or delete them first.',
      });
    }
    await db.remove('categories', req.params.id);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

/* ---------------------------------- Blog ----------------------------------- */

// GET /api/admin/blog (includes unpublished drafts)
router.get('/blog', async (req, res, next) => {
  try {
    const [posts, comments] = await Promise.all([db.list('blog-posts'), db.list('blog-comments')]);
    const sorted = posts
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((p) => ({ ...p, commentsCount: comments.filter((c) => c.postId === p.id).length }));
    res.json({ success: true, posts: sorted });
  } catch (err) {
    next(err);
  }
});

function slugify(title) {
  return String(title).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// POST /api/admin/blog  { title, category, image, excerpt, content, published? }
router.post('/blog', async (req, res, next) => {
  try {
    if (!req.body.title || !req.body.content) {
      return res.status(400).json({ success: false, message: 'Title and content are required.' });
    }
    const id = req.body.id || slugify(req.body.title);
    if (await db.get('blog-posts', id)) {
      return res.status(409).json({ success: false, message: `A post with slug "${id}" already exists.` });
    }
    const post = {
      id,
      title: req.body.title,
      category: req.body.category || '',
      image: req.body.image || '',
      excerpt: req.body.excerpt || '',
      content: req.body.content,
      published: req.body.published !== false,
      createdAt: new Date().toISOString(),
    };
    await db.put('blog-posts', post);
    res.status(201).json({ success: true, post });
  } catch (err) {
    next(err);
  }
});

// PUT /api/admin/blog/:id
router.put('/blog/:id', async (req, res, next) => {
  try {
    const existing = await db.get('blog-posts', req.params.id);
    if (!existing) return res.status(404).json({ success: false, message: 'Post not found.' });
    const post = { ...existing, ...req.body, id: existing.id };
    await db.put('blog-posts', post);
    res.json({ success: true, post });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/admin/blog/:id
router.delete('/blog/:id', async (req, res, next) => {
  try {
    await db.remove('blog-posts', req.params.id);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/admin/blog-comments/:id — moderation (remove spam/inappropriate comments)
router.delete('/blog-comments/:id', async (req, res, next) => {
  try {
    await db.remove('blog-comments', req.params.id);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/blog-settings
router.get('/blog-settings', async (req, res, next) => {
  try {
    const settings = await db.get('blog-settings', 'main');
    res.json({ success: true, settings: settings || { id: 'main', bannerImage: '' } });
  } catch (err) {
    next(err);
  }
});

// PUT /api/admin/blog-settings  { bannerImage, bannerTitle?, bannerSubtitle? }
router.put('/blog-settings', async (req, res, next) => {
  try {
    const settings = {
      id: 'main',
      bannerImage: req.body.bannerImage || '',
      bannerTitle: req.body.bannerTitle || '',
      bannerSubtitle: req.body.bannerSubtitle || '',
    };
    await db.put('blog-settings', settings);
    res.json({ success: true, settings });
  } catch (err) {
    next(err);
  }
});

/* ------------------------------ Page banners ------------------------------ */
// Shop / Categories / Combos / Contact / Bulk Enquiry — same banner-image +
// title/subtitle-override pattern as the blog banner above, one per page.

// GET /api/admin/page-banners/:page
router.get('/page-banners/:page', async (req, res, next) => {
  try {
    if (!PAGE_BANNER_PAGES.includes(req.params.page)) {
      return res.status(404).json({ success: false, message: 'Unknown page.' });
    }
    const settings = await db.get('page-banners', req.params.page);
    res.json({
      success: true,
      settings: settings || { id: req.params.page, bannerImage: '', bannerTitle: '', bannerSubtitle: '' },
    });
  } catch (err) {
    next(err);
  }
});

// PUT /api/admin/page-banners/:page  { bannerImage, bannerTitle?, bannerSubtitle? }
router.put('/page-banners/:page', async (req, res, next) => {
  try {
    if (!PAGE_BANNER_PAGES.includes(req.params.page)) {
      return res.status(404).json({ success: false, message: 'Unknown page.' });
    }
    const settings = {
      id: req.params.page,
      bannerImage: req.body.bannerImage || '',
      bannerTitle: req.body.bannerTitle || '',
      bannerSubtitle: req.body.bannerSubtitle || '',
    };
    await db.put('page-banners', settings);
    res.json({ success: true, settings });
  } catch (err) {
    next(err);
  }
});

/* --------------------------------- Coupons -------------------------------- */

// GET /api/admin/coupons
router.get('/coupons', async (req, res, next) => {
  try {
    const coupons = (await db.list('coupons')).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    res.json({ success: true, coupons });
  } catch (err) {
    next(err);
  }
});

/**
 * Works out where a promo popup's button should point, or says why it can't.
 *
 * The first version of this quietly blanked anything it did not like, which
 * meant typing "onam" instead of "/onam" lost the link with no complaint and
 * no button on the site — a saved form that silently dropped a field. So it
 * now fixes up the two things people actually type (a bare page name, and the
 * site's own full URL pasted from the address bar) and returns an error for
 * anything genuinely off-site rather than swallowing it.
 *
 * Blank stays blank: no button is a real choice, not a mistake.
 */
function normalisePromoLink(raw) {
  const v = String(raw || '').trim();
  if (!v) return { link: '' };

  let candidate = v;
  const own = /^https?:\/\/(?:www\.)?westerngodsorganic\.com(\/.*)?$/i.exec(v);
  if (own) candidate = own[1] || '/';
  else if (!v.startsWith('/') && /^[a-z0-9][a-z0-9\-/]*$/i.test(v)) candidate = '/' + v;

  // Must end up a path on this site with something after the slash. Bare "/"
  // is rejected too — a button from the homepage popup back to the homepage
  // is not a destination.
  if (!/^\/[^/]/.test(candidate)) {
    return {
      error: `"${v}" is not a page on this site. Use a path like /onam or /shop, or leave it blank for no button.`,
    };
  }
  return { link: candidate.slice(0, 200) };
}

// POST /api/admin/coupons  { code, type: 'percent'|'flat', value, minOrder?, expiresAt? }
router.post('/coupons', async (req, res, next) => {
  try {
    const code = (req.body.code || '').trim().toUpperCase();
    const type = req.body.type === 'flat' ? 'flat' : 'percent';
    const value = Number(req.body.value);
    if (!code) return res.status(400).json({ success: false, message: 'Coupon code is required.' });
    if (!value || value <= 0) return res.status(400).json({ success: false, message: 'Discount value must be greater than 0.' });
    if (type === 'percent' && value > 100) return res.status(400).json({ success: false, message: 'Percentage discount can\'t exceed 100.' });

    const coupons = await db.list('coupons');
    if (coupons.some((c) => c.code === code)) {
      return res.status(409).json({ success: false, message: `Coupon "${code}" already exists.` });
    }

    const promoLink = normalisePromoLink(req.body.promoLink);
    if (promoLink.error) return res.status(400).json({ success: false, message: promoLink.error });

    const coupon = {
      id: uuid(),
      code,
      type,
      value,
      minOrder: Number(req.body.minOrder) || 0,
      expiresAt: req.body.expiresAt || null,
      active: true,
      featured: !!req.body.featured,
      promoImage: req.body.promoImage || '',
      promoHeadline: req.body.promoHeadline || '',
      promoSubtext: req.body.promoSubtext || '',
      // Where the popup's button sends a shopper — e.g. /onam for the pookalam.
      // Deliberately restricted to a path on this site: a popup that can point
      // anywhere is a phishing surface, and every page worth sending someone
      // to from here is our own. Anything not starting with a single / is
      // dropped rather than saved half-valid.
      promoLink: promoLink.link,
      // Label for that button. Without one it reads "Take me there", which
      // tells a shopper nothing about what is on the other side.
      promoCta: String(req.body.promoCta || '').trim().slice(0, 40),
      createdAt: new Date().toISOString(),
    };
    await db.put('coupons', coupon);
    res.status(201).json({ success: true, coupon });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/admin/coupons/:id — edit a coupon, or flip one switch on it.
 *
 * Partial by design: the enable/disable and feature/unfeature links each send
 * a single key, and the edit form sends the lot. Only listed fields are read,
 * so a stray key in the body can no longer write itself into the record — this
 * used to spread req.body wholesale, which let a value that would have been
 * rejected on create arrive here unchecked.
 *
 * The discount is re-validated as a pair after merging, not field by field:
 * switching a ₹500-flat coupon to percentage has to fail, and it only looks
 * wrong once you see the new type next to the old value.
 */
router.patch('/coupons/:id', async (req, res, next) => {
  try {
    const existing = await db.get('coupons', req.params.id);
    if (!existing) return res.status(404).json({ success: false, message: 'Coupon not found.' });

    const body = req.body || {};
    const has = (k) => Object.prototype.hasOwnProperty.call(body, k);
    const next_ = { ...existing };

    if (has('code')) {
      const code = String(body.code || '').trim().toUpperCase();
      if (!code) return res.status(400).json({ success: false, message: 'Coupon code is required.' });
      if (code !== existing.code) {
        const clash = (await db.list('coupons')).some((c) => c.code === code && c.id !== existing.id);
        if (clash) return res.status(409).json({ success: false, message: `Coupon "${code}" already exists.` });
      }
      next_.code = code;
    }

    if (has('type')) next_.type = body.type === 'flat' ? 'flat' : 'percent';
    if (has('value')) next_.value = Number(body.value);
    if (has('minOrder')) next_.minOrder = Math.max(0, Number(body.minOrder) || 0);
    if (has('expiresAt')) next_.expiresAt = body.expiresAt || null;
    if (has('active')) next_.active = !!body.active;
    if (has('featured')) next_.featured = !!body.featured;
    if (has('promoImage')) next_.promoImage = String(body.promoImage || '');
    if (has('promoHeadline')) next_.promoHeadline = String(body.promoHeadline || '');
    if (has('promoSubtext')) next_.promoSubtext = String(body.promoSubtext || '');
    if (has('promoCta')) next_.promoCta = String(body.promoCta || '').trim().slice(0, 40);
    if (has('promoLink')) {
      const link = normalisePromoLink(body.promoLink);
      if (link.error) return res.status(400).json({ success: false, message: link.error });
      next_.promoLink = link.link;
    }

    if (!next_.value || next_.value <= 0) {
      return res.status(400).json({ success: false, message: 'Discount value must be greater than 0.' });
    }
    if (next_.type === 'percent' && next_.value > 100) {
      return res.status(400).json({ success: false, message: "Percentage discount can't exceed 100." });
    }

    await db.put('coupons', { ...next_, id: existing.id });
    res.json({ success: true, coupon: next_ });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/admin/coupons/:id
router.delete('/coupons/:id', async (req, res, next) => {
  try {
    await db.remove('coupons', req.params.id);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

/* --------------------------------- Banners -------------------------------- */

// GET /api/admin/banners — all banners including inactive
router.get('/banners', async (req, res, next) => {
  try {
    const banners = (await db.list('banners')).sort((a, b) => (a.sort || 0) - (b.sort || 0));
    res.json({ success: true, banners });
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/banners — multipart: file + title/subtitle fields
router.post('/banners', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'A video or image file is required.' });
    const banners = await db.list('banners');
    const isVideo = /\.(mp4|webm|ogg)$/i.test(req.file.filename);

    let url = `/uploads/${req.file.filename}`;
    let cloudinaryPublicId = null;
    if (cloudinary.isConfigured()) {
      const uploaded = await cloudinary.uploadFile(req.file.path, { resourceType: isVideo ? 'video' : 'image' });
      url = uploaded.url;
      cloudinaryPublicId = uploaded.publicId;
      fs.unlink(req.file.path, () => {});
    } else if (isVideo) {
      // No Cloudinary — transcode to a size-capped MP4 and store in the
      // database so it survives Render's disk wipes, same as images below.
      //
      // Banner settings rather than the general defaults: this clip loops
      // silently behind an overlay and is never the thing being studied, so
      // 720p at 1200k was buying detail nobody sees. Three of them load on the
      // home page.
      url = await compressVideoAndStore(req.file.path, {
        maxHeight: BANNER_VIDEO_MAX_HEIGHT,
        bitrate: BANNER_VIDEO_BITRATE,
      });
      fs.unlink(req.file.path, () => {});
    } else {
      // No Cloudinary and this is an image — compress and store in the
      // database so it survives Render's disk wipes.
      const buffer = fs.readFileSync(req.file.path);
      url = await compressAndStore(buffer);
      fs.unlink(req.file.path, () => {});
    }

    const banner = {
      id: uuid(),
      title: req.body.title || '',
      subtitle: req.body.subtitle || '',
      type: isVideo ? 'video' : 'image',
      url,
      cloudinaryPublicId,
      active: true,
      sort: banners.length,
      createdAt: new Date().toISOString(),
    };
    await db.put('banners', banner);
    res.status(201).json({ success: true, banner });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/admin/banners/:id  { title?, subtitle?, active?, sort? }
router.patch('/banners/:id', async (req, res, next) => {
  try {
    const banner = await db.get('banners', req.params.id);
    if (!banner) return res.status(404).json({ success: false, message: 'Banner not found.' });
    const { title, subtitle, active, sort } = req.body;
    if (title !== undefined) banner.title = title;
    if (subtitle !== undefined) banner.subtitle = subtitle;
    if (active !== undefined) banner.active = !!active;
    if (sort !== undefined) banner.sort = Number(sort);
    await db.put('banners', banner);
    res.json({ success: true, banner });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/admin/banners/:id (also removes the file)
router.delete('/banners/:id', async (req, res, next) => {
  try {
    const banner = await db.get('banners', req.params.id);
    if (banner) {
      if (banner.cloudinaryPublicId) {
        await cloudinary.destroyFile(banner.cloudinaryPublicId, banner.type === 'video' ? 'video' : 'image').catch(() => {});
      } else {
        const file = path.join(UPLOADS_DIR, path.basename(banner.url || ''));
        if (fs.existsSync(file)) fs.unlinkSync(file);
      }
      await db.remove('banners', req.params.id);
    }
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

/* ---------------------------------- Orders --------------------------------- */

// GET /api/admin/orders
// GET /api/admin/orders?search=&status=&from=&to=&page=&limit=
//
// Filtering and paging are opt-in: with no query params this still returns
// every order, because AdminReturns and AdminBottleReturns both read the whole
// list and filter it themselves. Pass `limit` and you get a page plus a
// `total` — which is what the Orders screen does, so it stays usable once
// there are thousands of orders rather than rendering all of them at once.
router.get('/orders', async (req, res, next) => {
  try {
    const [orders, users] = await Promise.all([db.list('orders'), db.list('users')]);
    // Map, not users.find() per order — that was O(orders × users), which at a
    // few thousand of each is millions of comparisons on every page load.
    const userById = new Map(users.map((u) => [u.id, u]));

    let list = orders
      .slice()
      .reverse()
      .map((o) => {
        const u = userById.get(o.userId);
        return { ...o, customer: u ? { name: u.name, phone: u.phone } : null };
      });

    const { search, status, from, to } = req.query;
    if (status) list = list.filter((o) => o.status === status);
    if (from) {
      const fromTs = new Date(from).getTime();
      list = list.filter((o) => new Date(o.createdAt).getTime() >= fromTs);
    }
    if (to) {
      // Inclusive of the whole end day, not midnight at its start — picking
      // the same date for both ends should find that day's orders.
      const toTs = new Date(to).getTime() + 24 * 60 * 60 * 1000;
      list = list.filter((o) => new Date(o.createdAt).getTime() < toTs);
    }
    if (search) {
      const q = String(search).trim().toLowerCase();
      // Both the account and the delivery address are searched: a guest
      // checkout has no user record at all, so the address is the only place
      // that customer's name and number exist.
      list = list.filter((o) =>
        (o.orderNumber || '').toLowerCase().includes(q)
        || (o.customer?.name || '').toLowerCase().includes(q)
        || (o.address?.name || '').toLowerCase().includes(q)
        || (o.customer?.phone || '').includes(q)
        || (o.address?.phone || '').includes(q)
        || (o.items || []).some((i) => (i.name || '').toLowerCase().includes(q)));
    }

    const total = list.length;
    const limit = Number(req.query.limit) > 0 ? Math.min(200, Number(req.query.limit)) : null;
    const page = Math.max(1, Number(req.query.page) || 1);
    if (limit) list = list.slice((page - 1) * limit, page * limit);

    res.json({ success: true, orders: list, total, page, limit });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/admin/orders/:id  { status } — notifies the customer
router.patch('/orders/:id', async (req, res, next) => {
  try {
    const order = await db.get('orders', req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });

    const allowed = ['placed', 'confirmed', 'shipped', 'delivered', 'cancelled'];
    if (!allowed.includes(req.body.status)) {
      return res.status(400).json({ success: false, message: `Status must be one of: ${allowed.join(', ')}` });
    }
    order.status = req.body.status;
    const justDelivered = order.status === 'delivered' && !order.deliveredAt;
    // Cancelling an order that was already marked delivered (and so already
    // paid out points, commission and seller shares) has to give all of that
    // back. deliveredAt, not status, is the test — status has already been
    // overwritten by the line above.
    const cancelledAfterDelivery = order.status === 'cancelled' && !!order.deliveredAt;
    if (justDelivered) {
      order.deliveredAt = new Date().toISOString();
    }
    await db.put('orders', order);
    if (justDelivered) {
      await creditPointsForOrder(order);
      await creditCommissionForOrder(order);
      await creditSellerEarningsForOrder(order);
      // Not awaited: rendering a PDF and pushing it over WhatsApp takes long
      // enough to be felt, and the admin marking a parcel delivered should not
      // wait on it. The status and every credit above are already saved, so a
      // failure here loses nothing — and leaves the order eligible to be
      // invoiced again, since invoiceSentAt is only stamped on real delivery.
      sendInvoiceForOrder(order).catch((err) => console.error('[invoice:send]', err.message));
    }
    if (cancelledAfterDelivery) await reverseCreditsForOrder(order, 'cancelled');

    // Stock goes back on a cancellation whatever stage it was cancelled at.
    // Even a parcel cancelled after delivery is the goods coming back to the
    // mill — and if they come back unfit to sell, the admin lowers the count
    // by hand, which is a judgement no code should be making for them.
    if (order.status === 'cancelled') await restoreStockForOrder(order);
    // ...and comes back off if the cancellation is undone. Gated on this order
    // having been restored by us, so an order placed before any of this existed
    // is never silently deducted years after the fact.
    else if (order.stockRestoredAt) await applyStockForOrder(order);

    const user = await db.get('users', order.userId);
    if (user) {
      await notifyUser(user, {
        title: `Order ${order.orderNumber} ${order.status}`,
        message: `Your order is now "${order.status}". Total ₹${order.total}.`,
        meta: { orderId: order.id },
        channels: { inapp: true, email: true, sms: order.status === 'shipped', whatsapp: true },
      });
    }
    if (ADMIN_EMAIL) {
      sendMail({
        to: ADMIN_EMAIL,
        subject: `Order ${order.orderNumber} status changed to "${order.status}"`,
        text: `Customer: ${user?.name || 'Unknown'} (${user?.phone || '—'})\nTotal: ₹${order.total}\nNew status: ${order.status}`,
      }).catch(() => {});
    }
    res.json({ success: true, order });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/admin/orders/:id/return  { status } — approve/reject/refund a
// customer's return request; notifies the customer.
const RETURN_STATUSES = ['requested', 'approved', 'rejected', 'refunded'];
router.patch('/orders/:id/return', async (req, res, next) => {
  try {
    const order = await db.get('orders', req.params.id);
    if (!order || !order.returnRequest) {
      return res.status(404).json({ success: false, message: 'No return request found for this order.' });
    }
    if (!RETURN_STATUSES.includes(req.body.status)) {
      return res.status(400).json({ success: false, message: `Status must be one of: ${RETURN_STATUSES.join(', ')}` });
    }

    order.returnRequest.status = req.body.status;
    order.returnRequest.updatedAt = new Date().toISOString();
    await db.put('orders', order);

    // The customer is getting their money back, so the points, commission and
    // seller shares that the delivery credited have to come back too.
    if (req.body.status === 'refunded') await reverseCreditsForOrder(order, 'refunded');

    const user = await db.get('users', order.userId);
    const messages = {
      approved: "Your return request has been approved. We'll be in touch about next steps.",
      rejected: 'Your return request was not approved. Contact support if you have questions.',
      refunded: `Your refund for order ${order.orderNumber} has been processed.`,
    };
    if (user && messages[order.returnRequest.status]) {
      await notifyUser(user, {
        title: `Return request update — order ${order.orderNumber}`,
        message: messages[order.returnRequest.status],
        meta: { orderId: order.id },
        channels: { inapp: true, email: true, whatsapp: true },
      });
    }

    res.json({ success: true, order });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/admin/orders/:id/bottle-return  { status } — approve/reject a
// customer's empty-bottle return; approving issues the refill credit coupon.
const BOTTLE_RETURN_STATUSES = ['requested', 'approved', 'rejected'];
router.patch('/orders/:id/bottle-return', async (req, res, next) => {
  try {
    const order = await db.get('orders', req.params.id);
    if (!order || !order.bottleReturn) {
      return res.status(404).json({ success: false, message: 'No bottle return request found for this order.' });
    }
    if (!BOTTLE_RETURN_STATUSES.includes(req.body.status)) {
      return res.status(400).json({ success: false, message: `Status must be one of: ${BOTTLE_RETURN_STATUSES.join(', ')}` });
    }

    const alreadyApproved = order.bottleReturn.status === 'approved';
    order.bottleReturn.status = req.body.status;
    order.bottleReturn.updatedAt = new Date().toISOString();
    await db.put('orders', order);

    let creditIssued = null;
    if (req.body.status === 'approved' && !alreadyApproved) {
      const coupon = await issueBottleReturnCredit(order.userId, order.bottleReturn.quantity);
      creditIssued = coupon?.value || null;
    } else if (req.body.status === 'rejected') {
      const user = await db.get('users', order.userId);
      if (user) {
        await notifyUser(user, {
          title: `Bottle return update — order ${order.orderNumber}`,
          message: 'Your bottle return request was not approved. Contact support if you have questions.',
          meta: { orderId: order.id },
          channels: { inapp: true, email: true, whatsapp: true },
        });
      }
    }

    res.json({ success: true, order, creditIssued });
  } catch (err) {
    next(err);
  }
});

/* ----------------------------- Payment methods ------------------------------ */

// GET /api/admin/payment-methods — which checkout payment options are
// currently turned on (independent of whether Razorpay is configured at all).
router.get('/payment-methods', async (req, res, next) => {
  try {
    const paymentMethods = await getPaymentMethodsConfig();
    res.json({ success: true, paymentMethods });
  } catch (err) {
    next(err);
  }
});

// PUT /api/admin/payment-methods  { cod, razorpay, codAdvance, prepaidDiscountPercent, gatewayFeePercent }
router.put('/payment-methods', async (req, res, next) => {
  try {
    // Clamped to 0-50: a typo'd 500 here would otherwise zero out every
    // prepaid order's total. buildOrderItems clamps again independently.
    const rawPrepaid = Number(req.body.prepaidDiscountPercent);
    // Reporting-only — this one never touches a customer's total, so a bad
    // value can misstate a report but can't mischarge anyone.
    const rawGateway = Number(req.body.gatewayFeePercent);
    const paymentMethods = {
      id: 'main',
      cod: !!req.body.cod,
      razorpay: !!req.body.razorpay,
      codAdvance: !!req.body.codAdvance,
      prepaidDiscountPercent: Number.isFinite(rawPrepaid) ? Math.min(Math.max(rawPrepaid, 0), 50) : 0,
      gatewayFeePercent: Number.isFinite(rawGateway) ? Math.min(Math.max(rawGateway, 0), 20) : 0,
    };
    await db.put('payment-methods', paymentMethods);
    res.json({ success: true, paymentMethods });
  } catch (err) {
    next(err);
  }
});

/* ------------------------------ Trade prospects ----------------------------- */
//
// Every lead the shop has recorded so far arrived on its own — a form filled
// in, an enquiry sent. Selling a case of oil to a tiffin centre is the other
// direction: you walk in, leave a sample, and come back on Thursday. That
// needs a list of who and when, which nothing here had.

const PROSPECT_STAGES = ['to_visit', 'visited', 'sampling', 'buying', 'not_interested'];

function readProspect(body, existing = {}) {
  const name = String(body.name || '').trim();
  if (!name) return { error: 'Give the place a name.' };
  const stage = PROSPECT_STAGES.includes(body.stage) ? body.stage : 'to_visit';
  const followUpAt = body.followUpAt ? String(body.followUpAt).slice(0, 10) : '';
  if (followUpAt && Number.isNaN(Date.parse(followUpAt))) {
    return { error: 'That follow-up date is not a real date.' };
  }
  return {
    prospect: {
      ...existing,
      name: name.slice(0, 120),
      kind: String(body.kind || '').slice(0, 40),
      area: String(body.area || '').slice(0, 80),
      phone: String(body.phone || '').replace(/[^\d+]/g, '').slice(0, 15),
      stage,
      followUpAt,
      // Append-only in practice — an admin types what was said and it stays.
      notes: String(body.notes || '').slice(0, 2000),
      updatedAt: new Date().toISOString(),
    },
  };
}

router.get('/trade-prospects', async (req, res, next) => {
  try {
    const all = await db.list('trade-prospects');
    const today = new Date().toISOString().slice(0, 10);
    const prospects = all
      .map((p) => ({ ...p, followUpDue: !!p.followUpAt && p.followUpAt <= today }))
      // Anything owed a call today comes first; then by stage order, so the
      // ones already warm sit above a list of cold names.
      .sort((a, b) => {
        if (a.followUpDue !== b.followUpDue) return a.followUpDue ? -1 : 1;
        const stageDiff = PROSPECT_STAGES.indexOf(a.stage) - PROSPECT_STAGES.indexOf(b.stage);
        return stageDiff || String(a.name).localeCompare(String(b.name));
      });
    res.json({ success: true, prospects, stages: PROSPECT_STAGES });
  } catch (err) {
    next(err);
  }
});

router.post('/trade-prospects', async (req, res, next) => {
  try {
    const { prospect, error } = readProspect(req.body);
    if (error) return res.status(400).json({ success: false, message: error });
    const saved = { id: uuid(), createdAt: new Date().toISOString(), ...prospect };
    await db.put('trade-prospects', saved);
    res.status(201).json({ success: true, prospect: saved });
  } catch (err) {
    next(err);
  }
});

router.put('/trade-prospects/:id', async (req, res, next) => {
  try {
    const existing = await db.get('trade-prospects', req.params.id);
    if (!existing) return res.status(404).json({ success: false, message: 'Not found.' });
    const { prospect, error } = readProspect(req.body, existing);
    if (error) return res.status(400).json({ success: false, message: error });
    await db.put('trade-prospects', { ...prospect, id: existing.id });
    res.json({ success: true, prospect: { ...prospect, id: existing.id } });
  } catch (err) {
    next(err);
  }
});

router.delete('/trade-prospects/:id', async (req, res, next) => {
  try {
    await db.del('trade-prospects', req.params.id);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/catalog-margins — what every size would earn if it sold today.
// Needs no orders, unlike Admin → Profit, so the costs an admin has just
// entered are visible immediately rather than after the first sale.
router.get('/catalog-margins', async (req, res, next) => {
  try {
    res.json({ success: true, ...(await buildCatalogMargins()) });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/price-list.pdf?note=…&validUntil=… — the rate card's everyday
// twin: retail prices, for a walk-in or for whoever messages asking "price?".
router.get('/price-list.pdf', async (req, res, next) => {
  try {
    const pdf = await buildPriceListPdf({ note: req.query.note || '', validUntil: req.query.validUntil || '' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="Western-Gods-price-list.pdf"');
    res.send(pdf);
  } catch (err) {
    // Nothing priced yet is an admin's to-do, not a server fault.
    if (/has a price yet/.test(err.message)) {
      return res.status(400).json({ success: false, message: err.message });
    }
    next(err);
  }
});

// GET /api/admin/rate-card.pdf?terms=…&validUntil=… — the sheet you hand over.
router.get('/rate-card.pdf', async (req, res, next) => {
  try {
    const pdf = await buildRateCardPdf({ terms: req.query.terms || '', validUntil: req.query.validUntil || '' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="Western-Gods-trade-rates.pdf"');
    res.send(pdf);
  } catch (err) {
    // A missing wholesale price is an admin's to-do, not a server fault.
    if (/wholesale price/.test(err.message)) {
      return res.status(400).json({ success: false, message: err.message });
    }
    next(err);
  }
});

// POST /api/admin/trade-prospects/:id/send-rates — WhatsApp the rate card.
router.post('/trade-prospects/:id/send-rates', async (req, res, next) => {
  try {
    const prospect = await db.get('trade-prospects', req.params.id);
    if (!prospect) return res.status(404).json({ success: false, message: 'Not found.' });
    if (!prospect.phone) {
      return res.status(400).json({ success: false, message: 'No phone number recorded for this place.' });
    }
    const pdf = await buildRateCardPdf({ terms: req.body.terms || '', validUntil: req.body.validUntil || '' });
    const r = await sendWhatsAppFile(prospect.phone, {
      buffer: pdf,
      fileName: 'Western-Gods-trade-rates.pdf',
      caption: (req.body.message || '').slice(0, 800)
        || `Our trade rates, as promised.\n\nCold-pressed at our own mill in Udumalpet, in batches. Happy to leave a sample if that helps.`,
    });
    if (!r.sent) {
      return res.status(502).json({
        success: false,
        message: r.reason === 'not-connected'
          ? 'WhatsApp is not connected — pair it in Admin → WhatsApp and try again.'
          : 'Could not send the rate card.',
      });
    }
    await db.put('trade-prospects', {
      ...prospect,
      ratesSentAt: new Date().toISOString(),
      // Sending rates means the visit happened; leaving it at "to visit"
      // would put it back on tomorrow's walking list.
      stage: prospect.stage === 'to_visit' ? 'visited' : prospect.stage,
    });
    res.json({ success: true, message: `Rate card sent to ${prospect.name}.` });
  } catch (err) {
    if (/wholesale price/.test(err.message)) {
      return res.status(400).json({ success: false, message: err.message });
    }
    next(err);
  }
});

/* -------------------------------- Festivals -------------------------------- */

// GET /api/admin/festivals — every festival, past and future.
router.get('/festivals', async (req, res, next) => {
  try {
    res.json({ success: true, festivals: await listAllFestivals() });
  } catch (err) {
    next(err);
  }
});

function readFestival(body, existing = {}) {
  const when = new Date(body.date);
  if (Number.isNaN(when.getTime())) return { error: 'Enter a valid date for the festival.' };
  const name = String(body.name || '').trim();
  if (!name) return { error: 'Give the festival a name.' };
  return {
    festival: {
      ...existing,
      name: name.slice(0, 80),
      // Stored as a plain date, not a timestamp: a festival is a day, and a
      // timezone-shifted midnight would show the wrong one to half the country.
      date: when.toISOString().slice(0, 10),
      note: String(body.note || '').slice(0, 400),
      // Which of your products this season actually calls for. Free of any
      // pricing effect — this is a reading list, not a bundle.
      productIds: Array.isArray(body.productIds) ? body.productIds.filter(Boolean).slice(0, 12) : [],
      leadDays: Math.min(Math.max(Math.round(Number(body.leadDays) || FESTIVAL_LEAD_DAYS), 0), 60),
      // How long the celebration runs, described around the day it is named
      // for. Onam is nine days before Thiruvonam and none after; Pongal is
      // none before Thai Pongal and three after. Both default to zero, which
      // is a single-day festival and what every existing entry becomes.
      startsDaysBefore: Math.min(Math.max(Math.round(Number(body.startsDaysBefore) || 0), 0), 30),
      endsDaysAfter: Math.min(Math.max(Math.round(Number(body.endsDaysAfter) || 0), 0), 30),
      // An offer code to hand out for this season, if there is one. Public by
      // design — a coupon code is meant to be given away — but optional, so a
      // festival with no offer simply has none rather than a fake one. Must
      // match a real coupon; nothing here creates one.
      couponCode: String(body.couponCode || '').trim().toUpperCase().slice(0, 24),
      // Whether the home page dresses itself for this one. A festival can be
      // worth listing on the calendar — so the "order by" date is somewhere a
      // customer can find it — without taking over the front of the shop.
      celebrate: body.celebrate !== false,
      // Which design to use. Normally left blank and matched from the name,
      // which is what makes adding a festival a one-field job. Set it when the
      // name will not match: a shop calling Deepavali "Festival of Lights" gets
      // the generic kolam otherwise, and this is the way to say what it is.
      // Not validated against the design list here — the list lives in the
      // frontend, and an id that no longer exists simply falls back to matching
      // on the name rather than erroring on a save.
      theme: String(body.theme || '').trim().toLowerCase().slice(0, 24),
      // Which weather falls for this one. Blank means the effect is chosen
      // from the design, which is right nearly always — this is here for the
      // shop that wants crackers on a day the code would have given glints.
      effect: String(body.effect || '').trim().toLowerCase().slice(0, 16),
      active: body.active !== false,
    },
  };
}

router.post('/festivals', async (req, res, next) => {
  try {
    const { festival, error } = readFestival(req.body);
    if (error) return res.status(400).json({ success: false, message: error });
    const saved = { id: uuid(), createdAt: new Date().toISOString(), ...festival };
    await db.put('festivals', saved);
    res.status(201).json({ success: true, festival: saved });
  } catch (err) {
    next(err);
  }
});

router.put('/festivals/:id', async (req, res, next) => {
  try {
    const existing = await db.get('festivals', req.params.id);
    if (!existing) return res.status(404).json({ success: false, message: 'Festival not found.' });
    const { festival, error } = readFestival(req.body, existing);
    if (error) return res.status(400).json({ success: false, message: error });
    await db.put('festivals', { ...festival, id: existing.id });
    res.json({ success: true, festival: { ...festival, id: existing.id } });
  } catch (err) {
    next(err);
  }
});

router.delete('/festivals/:id', async (req, res, next) => {
  try {
    await db.del('festivals', req.params.id);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/client-errors — what broke in customers' browsers.
router.get('/client-errors', async (req, res, next) => {
  try {
    const errors = await listClientErrors({ limit: req.query.limit });
    res.json({ success: true, count: errors.length, errors });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/audit-log — who changed what, newest first. A GET, so it
// does not record its own reading and fill the log with itself.
router.get('/audit-log', async (req, res, next) => {
  try {
    const entries = await listAuditLog({ limit: req.query.limit });
    res.json({ success: true, count: entries.length, entries });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/procurement — what to buy, and who to ring.
router.get('/procurement', async (req, res, next) => {
  try {
    res.json({ success: true, plan: await buildProcurementPlan() });
  } catch (err) {
    next(err);
  }
});

/* -------------------------------- Feedback --------------------------------- */

// What customers said privately after delivery. Anything poor, or with a
// problem ticked, sorts to the top and stays there until someone marks it
// dealt with — the point of asking is that somebody acts on the answer.
router.get('/feedback', async (req, res, next) => {
  try {
    const [feedback, summary] = await Promise.all([listFeedback(), feedbackSummary()]);
    res.json({ success: true, feedback, summary });
  } catch (err) {
    next(err);
  }
});

router.patch('/feedback/:id/handled', async (req, res, next) => {
  try {
    const record = await markHandled(req.params.id);
    if (!record) return res.status(404).json({ success: false, message: 'Feedback not found.' });
    res.json({ success: true, feedback: record });
  } catch (err) {
    next(err);
  }
});

/* ------------------------------ Counter orders ----------------------------- */

// Recorded, not offered: 'razorpay' would claim a gateway payment that never
// happened, putting a fee into the profit report that was never charged.
// 'counter' is cash or a UPI transfer already in hand; 'cod' is still to collect.
const COUNTER_PAYMENT_METHODS = ['counter', 'cod'];
const COUNTER_SHIPPING_CHOICES = ['pickup', 'shipping', 'to_pay'];

/**
 * POST /api/admin/orders — an order that arrived by phone, on WhatsApp, or
 * across the counter at the mill.
 *
 * Until this existed, checkout was the only way an order could come into being,
 * so a sale taken over the phone existed nowhere: no invoice, no profit line,
 * no CSV row, nothing in What to Buy. For a mill whose customers ring up, that
 * is most of the business invisible to all of its own accounting.
 *
 * Deliberately runs through the same buildOrderItems/createOrderRecord as
 * checkout rather than writing an order document directly. Prices, wholesale
 * rates, coupons, stock and delivery are then enforced identically, and a
 * phone order is the same kind of thing as a web order everywhere downstream.
 *
 * Where it differs from checkout, and why:
 *   - No OTP. A guest checking out has to prove the phone is theirs because
 *     that request hands back a login token. This one hands back nothing, and
 *     the admin taking the call is the proof.
 *   - No points or gift-card redemption. Spending a customer's balance on
 *     their behalf is a decision the shop should make deliberately and out
 *     loud; a coupon the shop quotes down the phone is fine.
 *   - source: 'counter', which keeps the customer's website basket intact and
 *     stops the admin's own phone buzzing about an order they just typed.
 */
router.post('/orders', async (req, res, next) => {
  try {
    const { items, customer, address, note } = req.body || {};
    const paymentMethod = COUNTER_PAYMENT_METHODS.includes(req.body?.paymentMethod) ? req.body.paymentMethod : 'counter';
    const shippingChoice = COUNTER_SHIPPING_CHOICES.includes(req.body?.shippingChoice) ? req.body.shippingChoice : 'pickup';

    const lines = (Array.isArray(items) ? items : [])
      .map((i) => ({ productId: i.productId, size: i.size, quantity: Math.floor(Number(i.quantity) || 0) }))
      .filter((i) => i.productId && i.size && i.quantity > 0);
    if (lines.length === 0) {
      return res.status(400).json({ success: false, message: 'Add at least one product.' });
    }

    const phone = String(customer?.phone || '').trim();
    if (!phone) return res.status(400).json({ success: false, message: "Enter the customer's phone number." });

    // An existing account is reused rather than duplicated — otherwise the
    // same person ends up with two records and a loyalty balance split
    // between them, which only shows up much later and cannot be untangled.
    let user = await findUserByPhone(phone);
    let createdAccount = false;
    if (!user) {
      const resolved = await resolveGuestUser(customer, phone);
      if (resolved.error) return res.status(resolved.error.status).json({ success: false, message: resolved.error.message });
      user = resolved.user;
      await db.put('users', user);
      createdAccount = true;
    }

    // Enough to bill and to deliver to. A walk-in leaves the rest blank.
    const orderAddress = {
      name: (address?.name || customer?.name || user.name || '').trim(),
      line1: (address?.line1 || '').trim(),
      line2: (address?.line2 || '').trim(),
      city: (address?.city || '').trim(),
      state: (address?.state || '').trim(),
      pincode: (address?.pincode || '').trim(),
      country: 'IN',
      phone,
    };
    if (shippingChoice !== 'pickup' && !orderAddress.line1) {
      return res.status(400).json({ success: false, message: 'A delivery address is needed unless the customer is collecting from the mill.' });
    }

    const built = await buildOrderItems(
      lines, req.body?.couponCode, 'IN', user.id, 0, shippingChoice, null, paymentMethod, orderAddress.pincode,
      { trustPickup: true }
    );
    if (built.stockError) return res.status(400).json({ success: false, message: built.stockError });
    if (built.total <= 0) {
      return res.status(400).json({ success: false, message: 'Order total must be greater than zero.' });
    }

    const order = await createOrderRecord({
      userId: user.id,
      orderItems: built.orderItems,
      address: orderAddress,
      total: built.total,
      discount: built.discount,
      couponCode: built.couponCode,
      prepaidDiscount: built.prepaidDiscount,
      pointsRedeemed: 0,
      paymentMethod,
      shippingChoice,
      source: 'counter',
      note,
    });

    res.status(201).json({ success: true, order, createdAccount });
  } catch (err) {
    next(err);
  }
});

/* --------------------------------- Invoices -------------------------------- */

// POST /api/admin/orders/:id/send-invoice — re-send by hand.
//
// The automatic send on delivery is the normal path; this exists for when the
// customer says they never got it, or gives you an email address after the
// fact. Awaited, unlike the automatic one, because here the admin is standing
// there waiting to be told whether it worked.
router.post('/orders/:id/send-invoice', async (req, res, next) => {
  try {
    const order = await db.get('orders', req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });
    const result = await sendInvoiceForOrder(order, { force: true });
    if (!result.email && !result.whatsapp) {
      return res.status(502).json({
        success: false,
        message: 'The invoice could not be sent. Check the customer has an email address, and that WhatsApp is connected in Admin → WhatsApp.',
      });
    }
    const went = [result.email && 'email', result.whatsapp && 'WhatsApp'].filter(Boolean).join(' and ');
    res.json({ success: true, message: `Invoice sent by ${went}.`, ...result });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/orders/:id/invoice.pdf — the same file the customer is sent,
// for printing a copy to go in the box.
router.get('/orders/:id/invoice.pdf', async (req, res, next) => {
  try {
    const order = await db.get('orders', req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });
    const pdf = await buildInvoicePdf(order);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${invoiceFileName(order)}"`);
    res.send(pdf);
  } catch (err) {
    next(err);
  }
});

/* -------------------------- Profit and CSV exports -------------------------- */

// GET /api/admin/profit?days=30
router.get('/profit', async (req, res, next) => {
  try {
    const days = Math.min(Math.max(parseInt(req.query.days, 10) || 30, 1), 365);
    res.json({ success: true, report: await buildProfitReport({ days }) });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/export/:what.csv
//
// GET, and fetched with the auth header rather than linked to directly: the
// host's LiteSpeed layer rejects authenticated POSTs to /api/admin/* before
// Node ever sees them, and a plain <a href> can't carry a bearer token.
const EXPORTS = {
  orders: { build: (q) => ordersCsv({ days: q.days ? parseInt(q.days, 10) : null }), file: 'orders' },
  products: { build: () => productsCsv(), file: 'products' },
  customers: { build: () => customersCsv(), file: 'customers' },
};

router.get('/export/:what.csv', async (req, res, next) => {
  try {
    const spec = EXPORTS[req.params.what];
    if (!spec) return res.status(404).json({ success: false, message: 'No such export.' });
    const csv = await spec.build(req.query);
    const stamp = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="western-gods-${spec.file}-${stamp}.csv"`);
    res.send(csv);
  } catch (err) {
    next(err);
  }
});

/* ----------------------------- Shipping settings ---------------------------- */

// GET /api/admin/shipping-settings — domestic shipping fee + free-shipping
// threshold (the baseline used for guests/Bronze — Silver/Gold keep their
// own fixed, better-than-base thresholds regardless of this setting).
router.get('/shipping-settings', async (req, res, next) => {
  try {
    const shippingSettings = await getShippingSettings();
    res.json({ success: true, shippingSettings });
  } catch (err) {
    next(err);
  }
});

// PUT /api/admin/shipping-settings  { domesticFee, domesticFreeThreshold, domesticShippingEnabled }
router.put('/shipping-settings', async (req, res, next) => {
  try {
    const domesticFee = Number(req.body.domesticFee);
    const domesticFreeThreshold = Number(req.body.domesticFreeThreshold);
    if (!(domesticFee >= 0) || !(domesticFreeThreshold >= 0)) {
      return res.status(400).json({
        success: false,
        message: 'Shipping fee and free-shipping threshold must be non-negative numbers.',
      });
    }
    const localFee = Number(req.body.localFee ?? 0);
    const localFreeThreshold = Number(req.body.localFreeThreshold ?? 0);
    if (!(localFee >= 0) || !(localFreeThreshold >= 0)) {
      return res.status(400).json({
        success: false,
        message: 'Nearby delivery fee and its free-delivery threshold must be non-negative numbers.',
      });
    }

    const shippingSettings = {
      id: 'main',
      domesticFee,
      domesticFreeThreshold,
      domesticShippingEnabled: !!req.body.domesticShippingEnabled,
      // Pincodes (or leading digits of them) the mill delivers to itself.
      // Stored as typed so the admin can keep it readable; parsed on use.
      localPincodes: String(req.body.localPincodes || '').slice(0, 500),
      localFee,
      localFreeThreshold,
      pickupEnabled: !!req.body.pickupEnabled,
      pickupHours: String(req.body.pickupHours || '').slice(0, 200),
      // Clamped rather than validated away: this is a promise made at the
      // counter, not a charge, so a silly number misstates a sign — it can't
      // mischarge anyone.
      refillDiscount: Math.min(Math.max(Math.round(Number(req.body.refillDiscount) || 0), 0), 500),
    };
    await db.put('shipping-settings', shippingSettings);
    res.json({ success: true, shippingSettings });
  } catch (err) {
    next(err);
  }
});

/* ------------------------------ Invoice settings ---------------------------- */

// GET /api/admin/invoice-settings — the business details, terms and
// signature printed on every customer invoice.
router.get('/invoice-settings', async (req, res, next) => {
  try {
    const invoiceSettings = await getInvoiceSettings();
    res.json({ success: true, invoiceSettings });
  } catch (err) {
    next(err);
  }
});

// PUT /api/admin/invoice-settings
const INVOICE_TEXT_FIELDS = ['businessName', 'legalName', 'address', 'phone', 'email', 'gstin', 'fssai', 'logoImage', 'signatureImage', 'signatoryName'];
// A tax classification, so only these two are accepted — a free-text heading
// here could silently turn a tax invoice into something that isn't one.
const DOCUMENT_TITLES = ['BILL OF SUPPLY', 'TAX INVOICE'];

router.put('/invoice-settings', async (req, res, next) => {
  try {
    if (!String(req.body.businessName || '').trim()) {
      return res.status(400).json({ success: false, message: 'Business name is required — it heads every invoice.' });
    }
    const current = await getInvoiceSettings();
    const invoiceSettings = { ...current, id: 'main' };
    for (const f of INVOICE_TEXT_FIELDS) {
      if (req.body[f] !== undefined) invoiceSettings[f] = String(req.body[f]).trim().slice(0, 500);
    }
    if (DOCUMENT_TITLES.includes(req.body.documentTitle)) {
      invoiceSettings.documentTitle = req.body.documentTitle;
    }
    const dueDays = Number(req.body.dueDays);
    if (Number.isFinite(dueDays)) invoiceSettings.dueDays = Math.min(Math.max(Math.round(dueDays), 0), 180);
    if (Array.isArray(req.body.terms)) {
      const terms = req.body.terms.map((t) => String(t).trim().slice(0, 500)).filter(Boolean).slice(0, 8);
      // Falls back to the stored/default set rather than saving an empty
      // list — see getInvoiceSettings, which guards the same way on read.
      if (terms.length) invoiceSettings.terms = terms;
    }
    await db.put('invoice-settings', invoiceSettings);
    res.json({ success: true, invoiceSettings });
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/invoice-settings/signature — multipart 'file' → { url }.
// Reuses the shared image upload/storage path (Cloudinary when configured,
// else compressed into the DB), same as product and review photos.
router.post('/invoice-settings/signature', imageUpload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded.' });
    const url = await storeUploadedFile(req.file);
    res.json({ success: true, url });
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/invoice-settings/logo — same, but transparency is kept so a
// PNG wordmark prints against the paper rather than a black square.
router.post('/invoice-settings/logo', imageUpload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded.' });
    const url = await storeUploadedFile(req.file, { preserveAlpha: true });
    res.json({ success: true, url });
  } catch (err) {
    next(err);
  }
});

/* --------------------------------- Gift cards ------------------------------ */

// GET /api/admin/gift-cards — every issued card with its live balance
// (derived from the ledger — see utils/giftCards.js), newest first.
router.get('/gift-cards', async (req, res, next) => {
  try {
    const [cards, ledger] = await Promise.all([db.list('gift-cards'), db.list('gift-card-ledger')]);
    const withBalance = cards
      .map((c) => ({
        ...c,
        balance: ledger.filter((e) => e.code === c.id).reduce((sum, e) => sum + e.amount, 0),
      }))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json({ success: true, giftCards: withBalance });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/admin/gift-cards/:code/cancel — deactivate a card (fraud/mistake).
// Redemption history already recorded against it is untouched.
router.patch('/gift-cards/:code/cancel', async (req, res, next) => {
  try {
    const giftCard = await cancelGiftCard(req.params.code);
    if (!giftCard) return res.status(404).json({ success: false, message: 'Gift card not found.' });
    res.json({ success: true, giftCard });
  } catch (err) {
    next(err);
  }
});

/* -------------------------------- Sale banner ------------------------------ */

// GET /api/admin/sale-banner
router.get('/sale-banner', async (req, res, next) => {
  try {
    const settings = await db.get('sale-banner', 'main');
    res.json({
      success: true,
      settings: settings || { id: 'main', active: false, title: '', subtitle: '', endDate: '' },
    });
  } catch (err) {
    next(err);
  }
});

// PUT /api/admin/sale-banner  { active, title, subtitle, endDate }
router.put('/sale-banner', async (req, res, next) => {
  try {
    const settings = {
      id: 'main',
      active: !!req.body.active,
      title: req.body.title || '',
      subtitle: req.body.subtitle || '',
      endDate: req.body.endDate || '',
    };
    await db.put('sale-banner', settings);
    res.json({ success: true, settings });
  } catch (err) {
    next(err);
  }
});

/* ------------------------------- Pookalam flowers -------------------------- */

/** A readable id from the name, so /flowers/manja-chethi.webp style urls and
 *  the admin list both stay legible. Falls back to a timestamp for a name
 *  with nothing latin in it at all. */
function flowerSlug(label) {
  const base = String(label || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return base || `flower-${Date.now()}`;
}

// GET /api/admin/flowers
router.get('/flowers', async (req, res, next) => {
  try {
    const flowers = (await db.list('pookalam-flowers'))
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || String(a.createdAt).localeCompare(String(b.createdAt)));
    res.json({ success: true, flowers });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/admin/flowers — upload a photograph and cut it out.
 *
 * The cut happens here rather than being asked of the shop. What they have is
 * a photo of a flower on a white background; what the pookalam needs is the
 * same flower on transparency, and nobody should have to own Photoshop to
 * bridge that.
 */
router.post('/flowers', imageUpload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'Choose an image to upload.' });
    const label = String(req.body.label || '').trim().slice(0, 40);
    if (!label) return res.status(400).json({ success: false, message: 'Give the flower a name.' });

    const fs = require('fs');
    let cut;
    try {
      cut = await cutOutFlower(fs.readFileSync(req.file.path));
    } catch (err) {
      // The cutter's messages are written for whoever uploaded the photo, so
      // they are passed straight through rather than replaced with a 500.
      return res.status(400).json({ success: false, message: err.message });
    } finally {
      fs.unlink(req.file.path, () => {});
    }

    const url = await compressAndStore(cut.buffer, { preserveAlpha: true });

    const existing = await db.list('pookalam-flowers');
    let id = flowerSlug(label);
    if (existing.some((f) => f.id === id)) id = `${id}-${existing.length + 1}`;

    const flower = {
      id,
      label,
      gloss: String(req.body.gloss || '').trim().slice(0, 40),
      url,
      petal: req.body.petal !== 'false' && req.body.petal !== false,
      order: existing.length,
      active: true,
      createdAt: new Date().toISOString(),
    };
    await db.put('pookalam-flowers', flower);
    res.status(201).json({ success: true, flower, keptPct: Math.round(cut.keptPct * 100) });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/admin/flowers/:id  { label, gloss, petal, active, order }
router.patch('/flowers/:id', async (req, res, next) => {
  try {
    const existing = await db.get('pookalam-flowers', req.params.id);
    if (!existing) return res.status(404).json({ success: false, message: 'Flower not found.' });
    const has = (k) => Object.prototype.hasOwnProperty.call(req.body, k);
    const next_ = { ...existing };
    if (has('label')) next_.label = String(req.body.label || '').trim().slice(0, 40) || existing.label;
    if (has('gloss')) next_.gloss = String(req.body.gloss || '').trim().slice(0, 40);
    if (has('petal')) next_.petal = !!req.body.petal;
    if (has('active')) next_.active = !!req.body.active;
    if (has('order')) next_.order = Math.max(0, Math.round(Number(req.body.order) || 0));
    await db.put('pookalam-flowers', next_);
    res.json({ success: true, flower: next_ });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/admin/flowers/:id
router.delete('/flowers/:id', async (req, res, next) => {
  try {
    await db.remove('pookalam-flowers', req.params.id);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

/* ---------------------------- Festival animation --------------------------- */

const ANIMATION_DEFAULTS = { id: 'main', enabled: true, scope: 'all', intensity: 'normal' };

// GET /api/admin/festival-animation
router.get('/festival-animation', async (req, res, next) => {
  try {
    const settings = await db.get('festival-animation', 'main');
    res.json({ success: true, settings: settings || ANIMATION_DEFAULTS });
  } catch (err) {
    next(err);
  }
});

// PUT /api/admin/festival-animation  { enabled, scope, intensity }
router.put('/festival-animation', async (req, res, next) => {
  try {
    const settings = {
      id: 'main',
      enabled: req.body.enabled !== false,
      // Whether the weather follows people around the shop or stays on the
      // front page. Anything unrecognised falls back rather than 400s: this is
      // presentation, and a bad value should not stop the form saving.
      scope: ['all', 'home'].includes(req.body.scope) ? req.body.scope : 'all',
      intensity: ['subtle', 'normal', 'lively'].includes(req.body.intensity)
        ? req.body.intensity
        : 'normal',
    };
    await db.put('festival-animation', settings);
    res.json({ success: true, settings });
  } catch (err) {
    next(err);
  }
});

/* ------------------------------ Scrolling notices -------------------------- */

// GET /api/admin/announcements
router.get('/announcements', async (req, res, next) => {
  try {
    const settings = await db.get('announcements', 'main');
    res.json({
      success: true,
      settings: settings || { id: 'main', active: true, messages: [], speed: 60 },
    });
  } catch (err) {
    next(err);
  }
});

// PUT /api/admin/announcements  { active, messages: [], speed }
router.put('/announcements', async (req, res, next) => {
  try {
    const settings = {
      id: 'main',
      active: req.body.active !== false,
      // Trimmed and de-blanked here rather than in the ticker: an empty line
      // in a loop shows up as a gap that reads like a rendering fault.
      messages: (Array.isArray(req.body.messages) ? req.body.messages : [])
        .map((m) => String(m || '').trim().slice(0, 200))
        .filter(Boolean)
        .slice(0, 12),
      // Pixels a second. Clamped because the field is a free number input and
      // 2000 would be a strobe, which is a genuine accessibility problem
      // rather than just an ugly one.
      speed: Math.min(Math.max(Math.round(Number(req.body.speed) || 60), 10), 200),
    };
    await db.put('announcements', settings);
    res.json({ success: true, settings });
  } catch (err) {
    next(err);
  }
});

/* --------------------------- Homepage reviews showcase --------------------- */

// GET /api/admin/homepage-reviews
router.get('/homepage-reviews', async (req, res, next) => {
  try {
    const settings = await db.get('homepage-reviews', 'main');
    res.json({
      success: true,
      settings: settings || { id: 'main', rating: 0, reviewCount: 0, mapsUrl: '', reviews: [] },
    });
  } catch (err) {
    next(err);
  }
});

// PUT /api/admin/homepage-reviews  { rating, reviewCount, mapsUrl,
// reviews: [{ author, rating, text, relativeTime }] } — a manually-curated
// stand-in for a live Google Places API pull (see homepageReviews.js).
router.put('/homepage-reviews', async (req, res, next) => {
  try {
    const settings = {
      id: 'main',
      rating: Number(req.body.rating) || 0,
      reviewCount: Number(req.body.reviewCount) || 0,
      mapsUrl: req.body.mapsUrl || '',
      reviews: Array.isArray(req.body.reviews)
        ? req.body.reviews
            .filter((r) => r.author && r.text)
            .map((r) => ({
              id: r.id || uuid(),
              author: r.author,
              rating: Number(r.rating) || 5,
              text: r.text,
              relativeTime: r.relativeTime || '',
            }))
        : [],
    };
    await db.put('homepage-reviews', settings);
    res.json({ success: true, settings });
  } catch (err) {
    next(err);
  }
});

/* ------------------------------ Currency rates ----------------------------- */

// GET /api/admin/currency-overrides — live rate (as "1 X = ₹Y", the usual
// quoting convention) alongside any manual override and minimum order value
// currently set for it. Currency/country lists are derived from the
// admin-managed country-catalog (see below), not a fixed set.
router.get('/currency-overrides', async (req, res, next) => {
  try {
    const countries = await getCountries();
    const foreignCountries = countries.filter((c) => c.currency !== 'INR');
    const currencyCodes = [...new Set(foreignCountries.map((c) => c.currency))];
    const [overrides, full] = await Promise.all([
      db.get('currency-overrides', 'main'),
      getFullLiveRates().catch(() => ({})),
    ]);
    const liveInrPerUnit = {};
    for (const code of currencyCodes) {
      if (full[code]) liveInrPerUnit[code] = +(1 / full[code]).toFixed(4);
    }
    res.json({
      success: true,
      currencies: currencyCodes,
      shippingCountries: foreignCountries.map((c) => c.code),
      liveInrPerUnit,
      inrPerUnit: overrides?.inrPerUnit || {},
      minOrder: overrides?.minOrder || {},
      shipping: overrides?.shipping || {},
    });
  } catch (err) {
    next(err);
  }
});

// PUT /api/admin/currency-overrides  { inrPerUnit: { USD: 83.5, ... },
// minOrder: { USD: 25, ... }, shipping: { US: 1500, ... } } — omit/0 for an
// entry to fall back to the live rate / no minimum / default intl shipping.
// shipping is keyed by country code (not currency) since it's a destination
// concept, applied to international orders in orderBuilder.calculateShipping.
router.put('/currency-overrides', async (req, res, next) => {
  try {
    const countries = await getCountries();
    const foreignCountries = countries.filter((c) => c.currency !== 'INR');
    const currencyCodes = [...new Set(foreignCountries.map((c) => c.currency))];
    const countryCodes = foreignCountries.map((c) => c.code);

    const inrPerUnit = {};
    const minOrder = {};
    for (const code of currencyCodes) {
      const rate = Number(req.body.inrPerUnit?.[code]);
      if (rate > 0) inrPerUnit[code] = rate;
      const min = Number(req.body.minOrder?.[code]);
      if (min > 0) minOrder[code] = min;
    }
    const shipping = {};
    for (const code of countryCodes) {
      const fee = Number(req.body.shipping?.[code]);
      if (fee > 0) shipping[code] = fee;
    }
    await db.put('currency-overrides', { id: 'main', inrPerUnit, minOrder, shipping });
    res.json({ success: true, inrPerUnit, minOrder, shipping });
  } catch (err) {
    next(err);
  }
});

/* ------------------------------ Country catalog ---------------------------- */

// GET /api/admin/country-catalog
router.get('/country-catalog', async (req, res, next) => {
  try {
    const countries = await getCountries();
    res.json({ success: true, countries });
  } catch (err) {
    next(err);
  }
});

// PUT /api/admin/country-catalog  { countries: [{ code, label, currency, symbol }] }
// Country/currency codes are validated for shape; the currency code (other
// than INR) is also checked against the live exchange-rate provider when
// reachable, so a typo doesn't silently create a currency with no rate.
router.put('/country-catalog', async (req, res, next) => {
  try {
    if (!Array.isArray(req.body.countries) || !req.body.countries.length) {
      return res.status(400).json({ success: false, message: 'At least one country is required.' });
    }
    let full = null;
    try {
      full = await getFullLiveRates();
    } catch {
      full = null; // provider unreachable — skip live-currency validation rather than block the save
    }

    const seen = new Set();
    const countries = [];
    for (const c of req.body.countries) {
      const code = (c.code || '').trim().toUpperCase();
      const currency = (c.currency || '').trim().toUpperCase();
      const label = (c.label || '').trim();
      const symbol = (c.symbol || '').trim();
      if (!/^[A-Z]{2}$/.test(code)) {
        return res.status(400).json({ success: false, message: `"${c.code || ''}" isn't a valid 2-letter country code.` });
      }
      if (!/^[A-Z]{3}$/.test(currency)) {
        return res.status(400).json({ success: false, message: `"${c.currency || ''}" isn't a valid 3-letter currency code.` });
      }
      if (!label) return res.status(400).json({ success: false, message: `"${code}" needs a display label.` });
      if (!symbol) return res.status(400).json({ success: false, message: `"${code}" needs a currency symbol.` });
      if (full && currency !== 'INR' && !full[currency]) {
        return res.status(400).json({ success: false, message: `"${currency}" isn't a currency our exchange-rate provider tracks — double-check the code.` });
      }
      if (seen.has(code)) return res.status(400).json({ success: false, message: `Duplicate country code "${code}".` });
      seen.add(code);
      countries.push({ code, label, currency, symbol });
    }
    if (!countries.some((c) => c.currency === 'INR')) {
      return res.status(400).json({ success: false, message: 'The country list must include one India (INR) entry.' });
    }

    await db.put('country-catalog', { id: 'main', countries });
    res.json({ success: true, countries });
  } catch (err) {
    next(err);
  }
});

/* ------------------------- Customers / leads lists ------------------------- */

// GET /api/admin/customers
router.get('/customers', async (req, res, next) => {
  try {
    const users = (await db.list('users'))
      .filter((u) => u.role !== 'admin')
      .map(({ id, name, phone, email, createdAt, isWholesale, isAffiliate, affiliateCode, commissionRate }) => ({
        id, name, phone, email, createdAt,
        isWholesale: !!isWholesale,
        isAffiliate: !!isAffiliate,
        affiliateCode: affiliateCode || null,
        commissionRate: commissionRate || 0,
      }));
    res.json({ success: true, customers: users });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/admin/customers/:id/wholesale  { isWholesale } — grants or
// revokes wholesale pricing for one account. Deliberately a manual, human
// decision (see a bulk enquiry from that customer in the Enquiries tab
// first) rather than any automated qualification — this is the account-
// level gate for wholesale pricing, there's no separate per-order minimum.
router.patch('/customers/:id/wholesale', async (req, res, next) => {
  try {
    const user = await db.get('users', req.params.id);
    if (!user || user.role === 'admin') {
      return res.status(404).json({ success: false, message: 'Customer not found.' });
    }
    user.isWholesale = !!req.body.isWholesale;
    await db.put('users', user);
    res.json({ success: true, customer: { id: user.id, name: user.name, phone: user.phone, email: user.email, createdAt: user.createdAt, isWholesale: user.isWholesale } });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/admin/customers/:id/affiliate  { isAffiliate, commissionRate, code? }
// Grants or revokes affiliate status and sets their commission rate (%).
// A code is generated the first time an account is granted affiliate status
// (or reused if it already has one); `code` lets the admin request a vanity
// code instead (e.g. "SARAH10") — falls back to a random one if taken.
router.patch('/customers/:id/affiliate', async (req, res, next) => {
  try {
    const user = await db.get('users', req.params.id);
    if (!user || user.role === 'admin') {
      return res.status(404).json({ success: false, message: 'Customer not found.' });
    }
    const isAffiliate = !!req.body.isAffiliate;
    if (isAffiliate) {
      const commissionRate = Number(req.body.commissionRate);
      if (!(commissionRate > 0) || commissionRate > 100) {
        return res.status(400).json({ success: false, message: 'Commission rate must be a number between 0 and 100.' });
      }
      if (!user.affiliateCode) {
        user.affiliateCode = await generateUniqueAffiliateCode(req.body.code);
      }
      user.commissionRate = commissionRate;
    }
    user.isAffiliate = isAffiliate;
    await db.put('users', user);
    res.json({
      success: true,
      customer: {
        id: user.id, name: user.name, phone: user.phone, email: user.email, createdAt: user.createdAt,
        isAffiliate: user.isAffiliate, affiliateCode: user.affiliateCode || null, commissionRate: user.commissionRate || 0,
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/affiliates — every affiliate (past or present) with their
// live commission balance/lifetime totals, newest-granted first.
router.get('/affiliates', async (req, res, next) => {
  try {
    const affiliates = (await db.list('users')).filter((u) => u.affiliateCode);
    const withSummary = await Promise.all(
      affiliates.map(async (u) => ({
        id: u.id,
        name: u.name,
        phone: u.phone,
        email: u.email,
        isAffiliate: !!u.isAffiliate,
        affiliateCode: u.affiliateCode,
        commissionRate: u.commissionRate || 0,
        ...(await getCommissionSummary(u.id)),
      }))
    );
    res.json({ success: true, affiliates: withSummary });
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/affiliates/:id/payout  { amount, note? } — records a
// payout the admin already made externally (bank transfer/UPI) against the
// affiliate's ledger; rejected if it exceeds their current balance.
router.post('/affiliates/:id/payout', async (req, res, next) => {
  try {
    const user = await db.get('users', req.params.id);
    if (!user?.isAffiliate) {
      return res.status(404).json({ success: false, message: 'Affiliate not found.' });
    }
    await recordPayout(req.params.id, Number(req.body.amount), req.body.note);
    const summary = await getCommissionSummary(req.params.id);
    res.json({ success: true, ...summary });
  } catch (err) {
    if (err.message.includes('Payout amount')) {
      return res.status(400).json({ success: false, message: err.message });
    }
    next(err);
  }
});

/* ------------------------------ Sellers ------------------------------ */

// GET /api/admin/seller-applications?status=
router.get('/seller-applications', async (req, res, next) => {
  try {
    let applications = (await db.list('seller-applications')).slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (req.query.status) applications = applications.filter((a) => a.status === req.query.status);
    res.json({ success: true, applications });
  } catch (err) {
    next(err);
  }
});

const SELLER_APPLICATION_STATUSES = ['approved', 'rejected'];

// PATCH /api/admin/seller-applications/:id  { status, platformFeeRate?, reviewNote? }
// Approving grants isSeller + a 3-listing probation window (see
// routes/sellerPortal.js) — guarded so re-PATCHing an already-approved
// application can't re-grant/reset probation a second time, same pattern as
// the bottle-return approval guard above.
router.patch('/seller-applications/:id', async (req, res, next) => {
  try {
    const application = await db.get('seller-applications', req.params.id);
    if (!application) return res.status(404).json({ success: false, message: 'Application not found.' });
    if (!SELLER_APPLICATION_STATUSES.includes(req.body.status)) {
      return res.status(400).json({ success: false, message: `Status must be one of: ${SELLER_APPLICATION_STATUSES.join(', ')}` });
    }

    const alreadyApproved = application.status === 'approved';
    if (req.body.status === 'approved' && !alreadyApproved) {
      const platformFeeRate = req.body.platformFeeRate != null ? Number(req.body.platformFeeRate) : 10;
      if (!(platformFeeRate >= 0) || platformFeeRate > 100) {
        return res.status(400).json({ success: false, message: 'Platform fee rate must be a number between 0 and 100.' });
      }
      const user = await db.get('users', application.userId);
      if (!user) return res.status(404).json({ success: false, message: 'Applicant account not found.' });
      user.isSeller = true;
      user.sellerBusinessName = application.businessName;
      user.sellerPlatformFeeRate = platformFeeRate;
      user.sellerProbationRemaining = 3;
      // Most people applying here are farmers and small dealers with no
      // company and no food licence of their own. They can't legally be the
      // seller of record for a packaged food sale, so by default we buy from
      // them and sell it ourselves under our own FSSAI — they're credited as
      // the source, not billed as the seller. Someone who does hold their own
      // registration can be switched to 'marketplace' and sell directly.
      user.sellerMode = req.body.sellerMode === 'marketplace' ? 'marketplace' : 'supplier';
      await db.put('users', user);
      await notifyUser(user, {
        title: 'Your seller application was approved!',
        message: user.sellerMode === 'marketplace'
          ? 'Welcome aboard — you can list your products now at /seller/dashboard. Your first 3 listings are checked before they go live; after that they post straight away.'
          : "Welcome aboard — you can add what you have to sell now at /seller/dashboard. We buy it from you and sell it on our shop, with your name on it as the maker. Your first 3 items are checked before they go live.",
        channels: { inapp: true, email: true },
      });
    } else if (req.body.status === 'rejected') {
      const user = await db.get('users', application.userId);
      if (user) {
        await notifyUser(user, {
          title: 'Update on your seller application',
          message: req.body.reviewNote
            ? `Your seller application wasn't approved this time: ${req.body.reviewNote}`
            : "Your seller application wasn't approved this time. Contact us if you'd like to know more.",
          channels: { inapp: true, email: true },
        });
      }
    }

    application.status = req.body.status;
    application.reviewNote = req.body.reviewNote || '';
    application.decidedAt = new Date().toISOString();
    await db.put('seller-applications', application);
    res.json({ success: true, application });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/sellers — every approved seller with their live earnings
// balance/lifetime totals, newest-approved first.
router.get('/sellers', async (req, res, next) => {
  try {
    const sellers = (await db.list('users')).filter((u) => u.isSeller);
    const pendingRequests = (await db.list('seller-payout-requests')).filter((r) => r.status === 'pending');
    const withSummary = await Promise.all(
      sellers.map(async (u) => ({
        payoutRequest: pendingRequests.find((r) => r.sellerId === u.id) || null,
        id: u.id,
        name: u.name,
        phone: u.phone,
        email: u.email,
        sellerBusinessName: u.sellerBusinessName,
        sellerPlatformFeeRate: u.sellerPlatformFeeRate || 0,
        sellerProbationRemaining: u.sellerProbationRemaining || 0,
        sellerMode: u.sellerMode || 'supplier',
        // Contact/compliance/payout detail the seller filled in — the admin
        // needs this to actually send a payout and to check compliance.
        contactEmail: u.sellerContactEmail || '',
        contactPhone: u.sellerContactPhone || '',
        address: u.sellerAddress || '',
        gstin: u.sellerGstin || '',
        fssai: u.sellerFssai || '',
        upiId: u.sellerUpiId || '',
        bankAccountName: u.sellerBankAccountName || '',
        bankAccountNumber: u.sellerBankAccountNumber || '',
        bankIfsc: u.sellerBankIfsc || '',
        ...(await getSellerSummary(u.id)),
      }))
    );
    res.json({ success: true, sellers: withSummary });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/admin/sellers/:id/mode  { mode } — move a seller between the two
// arrangements. 'supplier' is the default: we buy from them and sell it under
// our own food licence, crediting them as the maker. 'marketplace' makes them
// the seller of record, which only suits someone holding their own FSSAI
// registration — so the switch is deliberate and admin-only.
router.patch('/sellers/:id/mode', async (req, res, next) => {
  try {
    const mode = req.body.mode;
    if (!['supplier', 'marketplace'].includes(mode)) {
      return res.status(400).json({ success: false, message: "Mode must be 'supplier' or 'marketplace'." });
    }
    const user = await db.get('users', req.params.id);
    if (!user?.isSeller) return res.status(404).json({ success: false, message: 'Seller not found.' });
    user.sellerMode = mode;
    await db.put('users', user);
    res.json({ success: true, sellerMode: mode });
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/sellers/:id/payout  { amount, note? } — records a payout
// the admin already made externally (bank transfer/UPI) against the
// seller's ledger; rejected if it exceeds their current balance.
router.post('/sellers/:id/payout', async (req, res, next) => {
  try {
    const user = await db.get('users', req.params.id);
    if (!user?.isSeller) {
      return res.status(404).json({ success: false, message: 'Seller not found.' });
    }
    await recordSellerPayout(req.params.id, Number(req.body.amount), req.body.note);
    // Recording the transfer is what answers a payout request, so clear it
    // here rather than making the admin remember a second step.
    const open = (await db.list('seller-payout-requests'))
      .find((r) => r.sellerId === req.params.id && r.status === 'pending');
    if (open) {
      await db.put('seller-payout-requests', { ...open, status: 'settled', settledAt: new Date().toISOString() });
    }
    const summary = await getSellerSummary(req.params.id);
    res.json({ success: true, ...summary });
  } catch (err) {
    if (err.message.includes('Payout amount')) {
      return res.status(400).json({ success: false, message: err.message });
    }
    next(err);
  }
});

// GET /api/admin/seller-chat — one row per seller who has a thread, most
// recently active first, with unread counts. Mirrors GET /admin/chat.
router.get('/seller-chat', async (req, res, next) => {
  try {
    const [messages, users] = await Promise.all([db.list('seller-messages'), db.list('users')]);
    const nameById = Object.fromEntries(users.map((u) => [u.id, u]));
    const bySeller = new Map();
    for (const m of messages) {
      if (!bySeller.has(m.sellerId)) bySeller.set(m.sellerId, []);
      bySeller.get(m.sellerId).push(m);
    }
    const conversations = [...bySeller.entries()]
      .map(([sellerId, thread]) => {
        thread.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
        const last = thread[thread.length - 1];
        return {
          sellerId,
          sellerName: nameById[sellerId]?.sellerBusinessName || 'Unknown seller',
          phone: nameById[sellerId]?.phone || '',
          lastMessage: last.text,
          lastAt: last.createdAt,
          unread: thread.filter((m) => m.from === 'seller' && !m.readByAdmin).length,
        };
      })
      .sort((a, b) => b.lastAt.localeCompare(a.lastAt));
    res.json({ success: true, conversations });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/seller-chat/:sellerId — full thread (marks seller messages read).
router.get('/seller-chat/:sellerId', async (req, res, next) => {
  try {
    const messages = (await db.list('seller-messages'))
      .filter((m) => m.sellerId === req.params.sellerId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    for (const m of messages) {
      if (m.from === 'seller' && !m.readByAdmin) {
        m.readByAdmin = true;
        await db.put('seller-messages', m);
      }
    }
    const seller = await db.get('users', req.params.sellerId);
    res.json({
      success: true,
      seller: seller ? { id: seller.id, name: seller.sellerBusinessName, phone: seller.phone } : null,
      messages,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/seller-chat/:sellerId  { text }
router.post('/seller-chat/:sellerId', async (req, res, next) => {
  try {
    const text = (req.body.text || '').trim();
    if (!text) return res.status(400).json({ success: false, message: 'Message cannot be empty.' });
    const seller = await db.get('users', req.params.sellerId);
    if (!seller?.isSeller) return res.status(404).json({ success: false, message: 'Seller not found.' });

    const message = {
      id: uuid(),
      sellerId: req.params.sellerId,
      from: 'admin',
      text,
      readByAdmin: true,
      readBySeller: false,
      createdAt: new Date().toISOString(),
    };
    await db.put('seller-messages', message);
    await notifyUser(seller, {
      title: 'New message from Western Gods Organics',
      message: text,
      channels: { inapp: true, email: true },
    });
    res.status(201).json({ success: true, message });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/seller-products/pending — the probation review queue.
router.get('/seller-products/pending', async (req, res, next) => {
  try {
    const [products, users] = await Promise.all([db.list('products'), db.list('users')]);
    const nameById = Object.fromEntries(users.map((u) => [u.id, u.sellerBusinessName || u.name]));
    const pending = products
      .filter((p) => p.sellerModerationStatus === 'pending')
      .map((p) => ({ ...p, sellerName: nameById[p.sellerId] || 'Unknown seller' }));
    res.json({ success: true, products: pending });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/admin/seller-products/:id/moderate  { approve: boolean }
// Approving makes the listing publicly visible and counts down the
// seller's probation window (see routes/sellerPortal.js); once it hits 0,
// that seller's future listings skip the pending state entirely. Rejecting
// soft-hides the listing (active: false) rather than deleting it, so the
// seller can see what happened and fix it up as a fresh listing.
router.patch('/seller-products/:id/moderate', async (req, res, next) => {
  try {
    const product = await db.get('products', req.params.id);
    if (!product || product.sellerModerationStatus !== 'pending') {
      return res.status(404).json({ success: false, message: 'No pending listing found with this id.' });
    }
    const seller = await db.get('users', product.sellerId);

    if (req.body.approve) {
      product.sellerModerationStatus = 'approved';
      if (seller) {
        seller.sellerProbationRemaining = Math.max(0, (seller.sellerProbationRemaining || 0) - 1);
        await db.put('users', seller);
        await notifyUser(seller, {
          title: `Your listing "${product.name}" is live!`,
          message: seller.sellerProbationRemaining > 0
            ? `It's now visible to shoppers. ${seller.sellerProbationRemaining} more listing(s) will be reviewed before you're fully auto-approved.`
            : `It's now visible to shoppers. You're fully auto-approved — your next listings will go live instantly.`,
          channels: { inapp: true, email: true },
        });
      }
    } else {
      product.active = false;
      if (seller) {
        await notifyUser(seller, {
          title: `Your listing "${product.name}" wasn't approved`,
          message: 'Take a look and feel free to re-list it with any needed changes.',
          channels: { inapp: true, email: true },
        });
      }
    }
    await db.put('products', product);
    res.json({ success: true, product });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/enquiries
router.get('/enquiries', async (req, res, next) => {
  try {
    const enquiries = (await db.list('bulk-enquiries')).slice().reverse();
    res.json({ success: true, enquiries });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/admin/enquiries/:id  { status }
router.patch('/enquiries/:id', async (req, res, next) => {
  try {
    const enquiry = await db.get('bulk-enquiries', req.params.id);
    if (!enquiry) return res.status(404).json({ success: false, message: 'Enquiry not found.' });
    enquiry.status = req.body.status || enquiry.status;
    await db.put('bulk-enquiries', enquiry);
    res.json({ success: true, enquiry });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/contacts
router.get('/contacts', async (req, res, next) => {
  try {
    const contacts = (await db.list('contacts')).slice().reverse();
    res.json({ success: true, contacts });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/product-questions — every question asked, newest first,
// with the product name resolved for display; unanswered ones sort first
// so the admin sees what's waiting without hunting through answered ones.
router.get('/product-questions', async (req, res, next) => {
  try {
    const [questions, products] = await Promise.all([db.list('product-questions'), db.list('products')]);
    const productNameById = Object.fromEntries(products.map((p) => [p.id, p.name]));
    const withProductName = questions
      .map((q) => ({ ...q, productName: productNameById[q.productId] || 'Unknown product' }))
      .sort((a, b) => {
        if (!a.answer !== !b.answer) return a.answer ? 1 : -1;
        return b.createdAt.localeCompare(a.createdAt);
      });
    res.json({ success: true, questions: withProductName });
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/product-questions/:id/suggest-answer — stateless, drafts a
// suggested answer for the admin to review/edit before saving via the PATCH
// route below. Never posted to the customer directly from here.
router.post('/product-questions/:id/suggest-answer', async (req, res, next) => {
  try {
    const question = await db.get('product-questions', req.params.id);
    if (!question) return res.status(404).json({ success: false, message: 'Question not found.' });
    const product = await db.get('products', question.productId);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found.' });

    const answer = await suggestProductAnswer({ product, question: question.question });
    res.json({ success: true, answer });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
});

// PATCH /api/admin/product-questions/:id  { answer }
router.patch('/product-questions/:id', async (req, res, next) => {
  try {
    const question = await db.get('product-questions', req.params.id);
    if (!question) return res.status(404).json({ success: false, message: 'Question not found.' });

    const answer = (req.body.answer || '').trim().slice(0, 1000);
    if (answer.length < 2) {
      return res.status(400).json({ success: false, message: 'Enter an answer.' });
    }
    question.answer = answer;
    question.answeredAt = new Date().toISOString();
    await db.put('product-questions', question);

    if (question.userId) {
      const asker = await db.get('users', question.userId);
      const product = await db.get('products', question.productId);
      if (asker && product) {
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

/* ------------------------------ Notifications ------------------------------ */

// POST /api/admin/notify  { title, message, image?, channels: { inapp, email, sms, push } }
router.post('/notify', async (req, res, next) => {
  try {
    const { title, message, image, productId } = req.body;
    if (!title || !message) {
      return res.status(400).json({ success: false, message: 'Title and message are required.' });
    }
    const channels = {
      inapp: req.body.channels?.inapp !== false,
      email: !!req.body.channels?.email,
      sms: !!req.body.channels?.sms,
      push: !!req.body.channels?.push,
    };
    const meta = productId ? { productId } : {};
    const counts = await broadcast({ title, message, image, channels, meta });
    res.json({ success: true, counts });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/notify/logs
router.get('/notify/logs', async (req, res, next) => {
  try {
    const logs = (await db.list('notification-logs')).slice().reverse();
    res.json({ success: true, logs });
  } catch (err) {
    next(err);
  }
});

/* ----------------------------------- Chat ---------------------------------- */

// GET /api/admin/chat — conversation list with unread counts
router.get('/chat', async (req, res, next) => {
  try {
    const [messages, users] = await Promise.all([db.list('chat-messages'), db.list('users')]);
    const byUser = new Map();
    for (const m of messages) {
      if (!byUser.has(m.userId)) byUser.set(m.userId, []);
      byUser.get(m.userId).push(m);
    }
    const conversations = [...byUser.entries()]
      .map(([userId, msgs]) => {
        msgs.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
        const u = users.find((x) => x.id === userId);
        const last = msgs[msgs.length - 1];
        return {
          userId,
          name: u?.name || u?.phone || 'Customer',
          phone: u?.phone || '',
          lastMessage: last.text,
          lastAt: last.createdAt,
          unread: msgs.filter((m) => m.from === 'user' && !m.readByAdmin).length,
        };
      })
      .sort((a, b) => b.lastAt.localeCompare(a.lastAt));
    res.json({ success: true, conversations });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/chat/:userId — full thread (marks customer messages read)
router.get('/chat/:userId', async (req, res, next) => {
  try {
    const messages = (await db.list('chat-messages'))
      .filter((m) => m.userId === req.params.userId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    for (const m of messages) {
      if (m.from === 'user' && !m.readByAdmin) {
        m.readByAdmin = true;
        await db.put('chat-messages', m);
      }
    }
    const user = await db.get('users', req.params.userId);
    res.json({
      success: true,
      customer: user ? { id: user.id, name: user.name, phone: user.phone } : null,
      messages,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/chat/:userId  { text }
router.post('/chat/:userId', async (req, res, next) => {
  try {
    const text = (req.body.text || '').trim();
    if (!text) return res.status(400).json({ success: false, message: 'Message cannot be empty.' });

    const message = {
      id: uuid(),
      userId: req.params.userId,
      from: 'admin',
      text,
      readByAdmin: true,
      readByUser: false,
      createdAt: new Date().toISOString(),
    };
    await db.put('chat-messages', message);
    res.status(201).json({ success: true, message });
  } catch (err) {
    next(err);
  }
});

/* -------------------------------- WhatsApp --------------------------------- */

// GET /api/admin/whatsapp — connection state + QR code (as a data URL) when pairing is needed.
router.get('/whatsapp', async (req, res, next) => {
  try {
    const orderingEnabled = await whatsappOrdering.isEnabled();
    res.json({ success: true, ...whatsappBaileys.getStatus(), orderingEnabled });
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/whatsapp/ordering  { enabled } — turns the "reorder" chat
// flow on/off without a redeploy; off by default until an admin opts in.
router.post('/whatsapp/ordering', async (req, res, next) => {
  try {
    await whatsappOrdering.setEnabled(!!req.body.enabled);
    res.json({ success: true, orderingEnabled: !!req.body.enabled });
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/whatsapp/reset — wipes the current session and generates a fresh QR,
// for re-pairing to a different number.
router.post('/whatsapp/reset', async (req, res, next) => {
  try {
    await whatsappBaileys.resetSession();
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/whatsapp/eligible-recipients — everyone who's messaged us
// in the last 24 hours (see utils/whatsappBroadcast.js) — the only pool a
// broadcast can be sent to.
router.get('/whatsapp/eligible-recipients', async (req, res, next) => {
  try {
    const recipients = await getEligibleRecipients();
    res.json({ success: true, recipients, windowHours: WHATSAPP_BROADCAST_WINDOW_MS / (60 * 60 * 1000) });
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/whatsapp/broadcast  { phones: [...], message } — sends to
// the given phones one at a time with a pause between each, but only those
// still within the reply window at send time; always logs the campaign.
router.post('/whatsapp/broadcast', async (req, res, next) => {
  try {
    const phones = Array.isArray(req.body.phones) ? req.body.phones.filter(Boolean) : [];
    const message = (req.body.message || '').trim();
    if (!phones.length) {
      return res.status(400).json({ success: false, message: 'Select at least one recipient.' });
    }
    if (!message) {
      return res.status(400).json({ success: false, message: 'Enter a message to send.' });
    }
    const log = await sendWhatsAppBroadcast(phones, message);
    res.json({ success: true, log });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/whatsapp/broadcast-log — past campaigns, for accountability.
router.get('/whatsapp/broadcast-log', async (req, res, next) => {
  try {
    const log = await getBroadcastLog();
    res.json({ success: true, log });
  } catch (err) {
    next(err);
  }
});

/* ------------------------------ Subscriptions ------------------------------ */

// GET /api/admin/subscriptions
router.get('/subscriptions', async (req, res, next) => {
  try {
    const [subscriptions, users] = await Promise.all([db.list('subscriptions'), db.list('users')]);
    const withCustomer = subscriptions
      .slice()
      .reverse()
      .map((s) => {
        const user = users.find((u) => u.id === s.userId);
        return { ...s, customerName: user?.name || '', customerPhone: user?.phone || '' };
      });
    res.json({ success: true, subscriptions: withCustomer });
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/subscriptions/run — manually process due renewals (fallback
// alongside the automatic hourly check in server.js)
router.post('/subscriptions/run', async (req, res, next) => {
  try {
    const results = await processDueSubscriptions();
    res.json({ success: true, results });
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/reorder-nudges/run — manually process predictive reorder
// nudges (fallback alongside the automatic daily check in server.js)
router.post('/reorder-nudges/run', async (req, res, next) => {
  try {
    const results = await processReorderNudges();
    res.json({ success: true, results });
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/abandoned-carts/run — manual fallback/testing trigger
// (alongside the automatic hourly check in server.js)
router.post('/abandoned-carts/run', async (req, res, next) => {
  try {
    const results = await processAbandonedCarts();
    res.json({ success: true, results });
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/review-requests/run — manual trigger for the same daily job
// scheduled in server.js. Useful for reaching customers whose orders were
// delivered before this existed, without waiting for the next daily tick.
router.post('/review-requests/run', async (req, res, next) => {
  try {
    const results = await processReviewRequests();
    res.json({ success: true, results });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// Scheduled pressings — upcoming runs of the mill customers can reserve from.
// ---------------------------------------------------------------------------

// GET /api/admin/pressings — every run, newest first, with live reservation counts.
router.get('/pressings', async (req, res, next) => {
  try {
    res.json({ success: true, pressings: await listAllPressings() });
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/pressings  { productId, size, pressDate, unitsOffered, note? }
router.post('/pressings', async (req, res, next) => {
  try {
    const { productId, size, pressDate, unitsOffered, note } = req.body;
    const product = await db.get('products', productId);
    if (!product) return res.status(400).json({ success: false, message: 'Choose a product.' });
    if (!(product.sizes || []).some((s) => s.label === size)) {
      return res.status(400).json({ success: false, message: 'Choose a size that exists on that product.' });
    }
    const when = new Date(pressDate);
    if (Number.isNaN(when.getTime())) {
      return res.status(400).json({ success: false, message: 'Enter a valid pressing date.' });
    }
    if (when.getTime() <= Date.now()) {
      // A run in the past can't be reserved from, and letting one be created
      // would put a listing on the shop that no customer could ever buy.
      return res.status(400).json({ success: false, message: 'The pressing date must be in the future.' });
    }
    const units = Math.floor(Number(unitsOffered));
    if (!Number.isFinite(units) || units < 1) {
      return res.status(400).json({ success: false, message: 'Offer at least one bottle.' });
    }

    const pressing = {
      id: uuid(),
      productId,
      productName: product.name,
      size,
      pressDate: when.toISOString(),
      unitsOffered: units,
      note: (note || '').slice(0, 300),
      status: 'open',
      batchNumber: '',
      createdAt: new Date().toISOString(),
    };
    await db.put('pressings', pressing);
    res.status(201).json({ success: true, pressing });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/admin/pressings/:id  { pressDate?, unitsOffered?, note?, status? }
router.patch('/pressings/:id', async (req, res, next) => {
  try {
    const pressing = await db.get('pressings', req.params.id);
    if (!pressing) return res.status(404).json({ success: false, message: 'Pressing not found.' });
    if (pressing.status === 'pressed') {
      return res.status(400).json({ success: false, message: 'That pressing is already done — it can no longer be edited.' });
    }

    const updated = { ...pressing };
    if (req.body.pressDate) {
      const when = new Date(req.body.pressDate);
      if (Number.isNaN(when.getTime())) {
        return res.status(400).json({ success: false, message: 'Enter a valid pressing date.' });
      }
      updated.pressDate = when.toISOString();
    }
    if (req.body.unitsOffered !== undefined) {
      const units = Math.floor(Number(req.body.unitsOffered));
      if (!Number.isFinite(units) || units < 1) {
        return res.status(400).json({ success: false, message: 'Offer at least one bottle.' });
      }
      // Cutting the run below what customers have already reserved would mean
      // promising bottles that no longer exist, so the floor is what's booked.
      const reserved = await countReserved(pressing.id);
      if (units < reserved) {
        return res.status(400).json({
          success: false,
          message: `${reserved} bottle${reserved === 1 ? ' is' : 's are'} already reserved — you can't offer fewer than that.`,
        });
      }
      updated.unitsOffered = units;
    }
    if (req.body.note !== undefined) updated.note = String(req.body.note).slice(0, 300);
    if (req.body.status === 'cancelled') updated.status = 'cancelled';

    await db.put('pressings', updated);
    res.json({ success: true, pressing: updated });
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/pressings/:id/pressed  { batchNumber }
//
// The moment the run actually happens. Stamping the real batch number onto
// every reserved line is what closes the loop: the customer who booked oil
// that didn't exist can now open its batch passport and see the pressing date
// and source farm of the very run they paid for.
router.post('/pressings/:id/pressed', async (req, res, next) => {
  try {
    const pressing = await db.get('pressings', req.params.id);
    if (!pressing) return res.status(404).json({ success: false, message: 'Pressing not found.' });
    if (pressing.status === 'pressed') {
      return res.status(400).json({ success: false, message: 'That pressing is already marked as done.' });
    }
    const batchNumber = (req.body.batchNumber || '').trim();
    if (!batchNumber) {
      return res.status(400).json({ success: false, message: 'Enter the batch number this run produced.' });
    }

    const hasVideo = Boolean(pressing.videoUrl);
    const orders = await db.list('orders');
    let stamped = 0;
    for (const order of orders) {
      if (!(order.items || []).some((i) => i.pressingId === pressing.id)) continue;
      const items = order.items.map((i) => (i.pressingId === pressing.id ? { ...i, batchNumber } : i));
      await db.put('orders', { ...order, items });
      stamped += 1;

      const user = order.userId ? await db.get('users', order.userId) : null;
      if (user) {
        notifyUser(user, {
          title: 'Your reserved oil has been pressed',
          message: hasVideo
            ? `Batch ${batchNumber} came off the press today — you can watch the run you booked. Your order ${order.orderNumber} is being bottled and will ship shortly.`
            : `Batch ${batchNumber} came off the press today. Your order ${order.orderNumber} is being bottled and will ship shortly.`,
          meta: { orderId: order.id, ...(hasVideo ? { url: `/pressings#${pressing.id}` } : {}) },
          // This is the message the whole reservation was waiting for — the
          // one telling someone the thing they paid for in advance now exists.
          // It should not sit unread in a bell icon.
          channels: { inapp: true, email: true, whatsapp: true },
        }).catch(() => {});
      }
    }

    await db.put('pressings', {
      ...pressing,
      status: 'pressed',
      batchNumber,
      pressedAt: new Date().toISOString(),
      // A video already attached went out in the message above, so the
      // upload route must not send a second one for the same clip.
      ...(hasVideo ? { videoNotifiedAt: new Date().toISOString() } : {}),
    });
    res.json({ success: true, stampedOrders: stamped, batchNumber });
  } catch (err) {
    next(err);
  }
});

/* --------------------------- Pressing day videos -------------------------- */

// Phones are what will actually shoot this — an iPhone writes .mov, older
// Androids .3gp — so the ordinary banner filter (mp4/webm/ogg) would reject
// the very files this route exists to take. ffmpeg transcodes all of them.
const pressingVideoUpload = multer({
  storage,
  limits: { fileSize: 200 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = /\.(mp4|mov|m4v|webm|ogg|3gp|avi|mkv)$/i.test(file.originalname);
    cb(ok ? null : new Error('That does not look like a video file.'), ok);
  },
});

/** Picking a photo when you meant a clip, or a file too big to send, is an
 *  ordinary mistake — not a server fault. Left to the global error handler
 *  both surface as "Server error", which tells the admin nothing about what
 *  to do differently. */
const acceptVideo = (req, res, next) =>
  pressingVideoUpload.single('file')(req, res, (err) => {
    if (!err) return next();
    const message = err.code === 'LIMIT_FILE_SIZE'
      ? 'That file is too large to upload. Ten to twenty seconds of video is plenty.'
      : err.message;
    return res.status(400).json({ success: false, message });
  });

// Kept well under the 20 MB banner ceiling: this is watched on a phone, over
// rural 4G, from a notification. A clip that starts playing immediately is
// worth more here than a sharper one that spins.
const PRESSING_VIDEO_BITRATE = '900k';
const PRESSING_VIDEO_MAX_BYTES = 8 * 1024 * 1024;

/**
 * POST /api/admin/products/:id/video — multipart: file
 *
 * Lives here rather than beside the other product routes because it shares the
 * pressing clip's uploader and limits, which are declared just above — using
 * them earlier in the file would throw before the server ever starts.
 *
 * Same treatment as a pressing clip, for the same reason: audio kept, because
 * the sound of the press is half of what makes it convincing, and the bitrate
 * capped low because this is watched on a phone over rural 4G by somebody who
 * has not decided to buy yet. A clip that plays at once persuades; one that
 * spins loses them.
 */
router.post('/products/:id/video', acceptVideo, async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'Choose a video file.' });
    const product = await db.get('products', req.params.id);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found.' });

    let url;
    if (cloudinary.isConfigured()) {
      url = (await cloudinary.uploadFile(req.file.path, { resourceType: 'video' })).url;
    } else {
      url = await compressVideoAndStore(req.file.path, {
        keepAudio: true,
        bitrate: PRESSING_VIDEO_BITRATE,
        maxBytes: PRESSING_VIDEO_MAX_BYTES,
      });
    }
    fs.unlink(req.file.path, () => {});

    await db.put('products', { ...product, video: url, updatedAt: new Date().toISOString() });
    res.json({ success: true, url });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/admin/pressings/:id/video — multipart: file
 *
 * The clip is deliberately not part of "mark pressed". Uploading a video from
 * the mill's phone is the slowest, most failure-prone thing an admin does here,
 * and stamping batch numbers onto paid orders is the most important — tying
 * them together would let a dropped connection block the part that matters.
 *
 * Attach it before the run is marked done and it rides along with that
 * message; attach it after and this route sends it. Either way the people who
 * paid for oil that didn't exist yet get to watch it being made.
 */
router.post('/pressings/:id/video', acceptVideo, async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'Choose a video file.' });
    const pressing = await db.get('pressings', req.params.id);
    if (!pressing) {
      fs.unlink(req.file.path, () => {});
      return res.status(404).json({ success: false, message: 'Pressing not found.' });
    }

    let url;
    let cloudinaryPublicId = null;
    if (cloudinary.isConfigured()) {
      const uploaded = await cloudinary.uploadFile(req.file.path, { resourceType: 'video' });
      url = uploaded.url;
      cloudinaryPublicId = uploaded.publicId;
    } else {
      // keepAudio: the sound of the press is half of what makes this worth
      // watching. A silent clip of a turning wheel proves much less.
      url = await compressVideoAndStore(req.file.path, {
        keepAudio: true,
        bitrate: PRESSING_VIDEO_BITRATE,
        maxBytes: PRESSING_VIDEO_MAX_BYTES,
      });
    }
    fs.unlink(req.file.path, () => {});

    const updated = { ...pressing, videoUrl: url, videoPublicId: cloudinaryPublicId };
    let notified = 0;

    // Only announce a run that has actually happened, and only once. Replacing
    // a badly-shot clip is a normal thing to do; messaging every customer again
    // because of it is not.
    if (pressing.status === 'pressed' && !pressing.videoNotifiedAt) {
      const orders = await db.list('orders');
      const seen = new Set();
      for (const order of orders) {
        if (!(order.items || []).some((i) => i.pressingId === pressing.id)) continue;
        if (!order.userId || seen.has(order.userId)) continue;
        seen.add(order.userId);
        const user = await db.get('users', order.userId);
        if (!user) continue;
        notified += 1;
        notifyUser(user, {
          title: `Watch your ${pressing.productName} being pressed`,
          message: 'Here is the run you reserved, coming off the press at the mill.',
          meta: { url: `/pressings#${pressing.id}` },
          channels: { inapp: true, email: true, whatsapp: true },
        }).catch(() => {});
      }
      updated.videoNotifiedAt = new Date().toISOString();
    }

    await db.put('pressings', updated);
    res.status(201).json({ success: true, videoUrl: url, notified });
  } catch (err) {
    if (req.file) fs.unlink(req.file.path, () => {});
    next(err);
  }
});

// DELETE /api/admin/pressings/:id/video — take a bad clip back down.
// videoNotifiedAt deliberately survives: the message has already been sent and
// re-uploading shouldn't send it twice.
router.delete('/pressings/:id/video', async (req, res, next) => {
  try {
    const pressing = await db.get('pressings', req.params.id);
    if (!pressing) return res.status(404).json({ success: false, message: 'Pressing not found.' });
    if (pressing.videoPublicId && cloudinary.isConfigured()) {
      cloudinary.destroyFile(pressing.videoPublicId, 'video').catch(() => {});
    }
    await db.put('pressings', { ...pressing, videoUrl: '', videoPublicId: null });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

/* --------------------------- Pookalam contest ----------------------------- */
/* Moderation and prize-giving for the Onam pookalam contest at /onam. The
   entrant-facing half is routes/pookalam.js; these live here so they inherit
   the requireAdmin gate and the audit log applied at the top of this file. */

router.get('/pookalam/entries', async (req, res, next) => {
  try {
    const entries = await pookalamContest.allEntries();
    res.json({
      success: true,
      entries: entries.map(pookalamContest.toAdmin),
      maxPerPhone: pookalamContest.MAX_ENTRIES_PER_PHONE,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/pookalam/entries/:id/status', async (req, res, next) => {
  try {
    const entry = await pookalamContest.setStatus(req.params.id, req.body.status);
    if (!entry) return res.status(404).json({ success: false, message: 'Entry not found.' });
    res.json({ success: true, entry: pookalamContest.toAdmin(entry) });
  } catch (err) {
    next(err);
  }
});

/* Awards the prize AND marks the winner. A coupon prize mints a real code into
   the coupons collection; a gift prize records what to send. The response
   carries `notified` so the admin page can say whether the winner was actually
   reachable in-app, and tell the admin to message a guest by hand when not. */
router.post('/pookalam/entries/:id/award', async (req, res, next) => {
  try {
    const result = await pookalamContest.awardPrize(req.params.id, {
      kind: req.body.kind,
      type: req.body.type,
      value: req.body.value,
      minOrder: req.body.minOrder,
      expiresAt: req.body.expiresAt || null,
      giftNote: req.body.giftNote,
    });
    if (!result) return res.status(404).json({ success: false, message: 'Entry not found.' });
    res.json({
      success: true,
      entry: pookalamContest.toAdmin(result.entry),
      coupon: result.coupon,
      notified: result.entry.notified,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/pookalam/entries/:id/clear-winner', async (req, res, next) => {
  try {
    const entry = await pookalamContest.clearWinner(req.params.id);
    if (!entry) return res.status(404).json({ success: false, message: 'Entry not found.' });
    res.json({ success: true, entry: pookalamContest.toAdmin(entry) });
  } catch (err) {
    next(err);
  }
});

router.delete('/pookalam/entries/:id', async (req, res, next) => {
  try {
    const entry = await pookalamContest.removeEntry(req.params.id);
    if (!entry) return res.status(404).json({ success: false, message: 'Entry not found.' });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
