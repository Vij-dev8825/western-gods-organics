const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { v4: uuid } = require('uuid');
const db = require('../data/db');
const { requireAdmin } = require('../middleware/auth');
const { notifyUser, broadcast } = require('../utils/notify');
const { UPLOADS_DIR } = require('../data/seed');

const router = express.Router();
router.use(requireAdmin);

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
    const [users, products, orders, enquiries, contacts, chats] = await Promise.all([
      db.list('users'),
      db.list('products'),
      db.list('orders'),
      db.list('bulk-enquiries'),
      db.list('contacts'),
      db.list('chat-messages'),
    ]);

    const revenue = orders.reduce((sum, o) => sum + (o.total || 0), 0);
    const lowStock = [];
    for (const p of products) {
      for (const s of p.sizes || []) {
        if (s.stock <= 10) lowStock.push({ productId: p.id, name: p.name, size: s.label, stock: s.stock });
      }
    }

    res.json({
      success: true,
      dbMode: db.getMode(),
      stats: {
        customers: users.filter((u) => u.role !== 'admin').length,
        products: products.length,
        orders: orders.length,
        revenue,
        newEnquiries: enquiries.filter((e) => e.status === 'new').length,
        contacts: contacts.length,
        unreadChats: chats.filter((m) => m.from === 'user' && !m.readByAdmin).length,
      },
      lowStock,
      recentOrders: orders.slice(-8).reverse(),
      recentEnquiries: enquiries.slice(-5).reverse(),
    });
  } catch (err) {
    next(err);
  }
});

/* -------------------------------- Uploads --------------------------------- */

// POST /api/admin/upload-image — multipart 'file' → { url } for use as a
// product/category image (banners have their own dedicated upload below).
const imageUpload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (req, file, cb) => {
    const ok = /\.(jpe?g|png|webp)$/i.test(file.originalname);
    cb(ok ? null : new Error('Only jpg/png/webp image files are allowed.'), ok);
  },
});

router.post('/upload-image', imageUpload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'An image file is required.' });
  res.status(201).json({ success: true, url: `/uploads/${req.file.filename}` });
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
      image: req.body.image || '',
      images: Array.isArray(req.body.images) && req.body.images.length ? req.body.images : (req.body.image ? [req.body.image] : []),
      sizes: req.body.sizes.map((s) => ({
        label: s.label,
        price: Number(s.price),
        mrp: Number(s.mrp || s.price),
        stock: Number(s.stock || 0),
      })),
      rating: Number(req.body.rating || 0),
      reviewsCount: Number(req.body.reviewsCount || 0),
      tags: req.body.tags || [],
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
      })),
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
      createdAt: new Date().toISOString(),
    };
    await db.put('coupons', coupon);
    res.status(201).json({ success: true, coupon });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/admin/coupons/:id  (e.g. { active: false })
router.patch('/coupons/:id', async (req, res, next) => {
  try {
    const existing = await db.get('coupons', req.params.id);
    if (!existing) return res.status(404).json({ success: false, message: 'Coupon not found.' });
    const coupon = { ...existing, ...req.body, id: existing.id, code: existing.code };
    await db.put('coupons', coupon);
    res.json({ success: true, coupon });
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
    const banner = {
      id: uuid(),
      title: req.body.title || '',
      subtitle: req.body.subtitle || '',
      type: /\.(mp4|webm|ogg)$/i.test(req.file.filename) ? 'video' : 'image',
      url: `/uploads/${req.file.filename}`,
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
      const file = path.join(UPLOADS_DIR, path.basename(banner.url || ''));
      if (fs.existsSync(file)) fs.unlinkSync(file);
      await db.remove('banners', req.params.id);
    }
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

/* ---------------------------------- Orders --------------------------------- */

// GET /api/admin/orders
router.get('/orders', async (req, res, next) => {
  try {
    const [orders, users] = await Promise.all([db.list('orders'), db.list('users')]);
    const withCustomer = orders
      .slice()
      .reverse()
      .map((o) => {
        const u = users.find((x) => x.id === o.userId);
        return { ...o, customer: u ? { name: u.name, phone: u.phone } : null };
      });
    res.json({ success: true, orders: withCustomer });
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
    await db.put('orders', order);

    const user = await db.get('users', order.userId);
    if (user) {
      await notifyUser(user, {
        title: `Order ${order.orderNumber} ${order.status}`,
        message: `Your order is now "${order.status}". Total ₹${order.total}.`,
        meta: { orderId: order.id },
        channels: { inapp: true, email: true, sms: order.status === 'shipped' },
      });
    }
    res.json({ success: true, order });
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
      .map(({ id, name, phone, email, createdAt }) => ({ id, name, phone, email, createdAt }));
    res.json({ success: true, customers: users });
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

/* ------------------------------ Notifications ------------------------------ */

// POST /api/admin/notify  { title, message, channels: { inapp, email, sms } }
router.post('/notify', async (req, res, next) => {
  try {
    const { title, message } = req.body;
    if (!title || !message) {
      return res.status(400).json({ success: false, message: 'Title and message are required.' });
    }
    const channels = {
      inapp: req.body.channels?.inapp !== false,
      email: !!req.body.channels?.email,
      sms: !!req.body.channels?.sms,
    };
    const counts = await broadcast({ title, message, channels });
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

module.exports = router;
