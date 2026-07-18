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
const { processDueSubscriptions } = require('./utils/subscriptions');
const mediaRoutes = require('./routes/media');

const app = express();

app.use(cors());
app.use(express.json({ limit: '2mb' }));
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
app.use('/api/media', mediaRoutes);

// Uploaded banner videos/images
app.use('/uploads', express.static(UPLOADS_DIR, { maxAge: '7d' }));

// In production (single Render service) the API also serves the built frontend.
const distDir = path.join(__dirname, '..', 'frontend', 'dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get(/^\/(?!api|uploads).*/, (req, res) => {
    res.sendFile(path.join(distDir, 'index.html'));
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

    // No worker/cron process on Render's free plan — piggyback on this
    // long-lived request process instead (kept alive by the external
    // keep-alive ping). Runs once on boot, then hourly.
    processDueSubscriptions().catch((err) => console.error('processDueSubscriptions failed:', err));
    setInterval(() => {
      processDueSubscriptions().catch((err) => console.error('processDueSubscriptions failed:', err));
    }, 60 * 60 * 1000);
  } catch (err) {
    console.error('Failed to start:', err);
    process.exit(1);
  }
})();
