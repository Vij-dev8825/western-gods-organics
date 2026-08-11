const express = require('express');
const razorpay = require('../utils/razorpay');
const { COD_ADVANCE_INR } = require('../utils/orderBuilder');
const { getPaymentMethodsConfig } = require('../utils/paymentMethods');
const { getInvoiceSettings } = require('../utils/invoiceSettings');

const router = express.Router();

// GET /api/config/invoice — public on purpose: every field here is already
// printed on the invoice the customer is looking at (and on the packaging),
// so there's nothing to withhold. Kept off /api/config itself so the
// storefront isn't loading invoice boilerplate on every page.
router.get('/invoice', async (req, res, next) => {
  try {
    const invoiceSettings = await getInvoiceSettings();
    res.json({ success: true, invoiceSettings });
  } catch (err) {
    next(err);
  }
});

// GET /api/config — public, non-secret feature flags the frontend needs.
// paymentMethods is the admin's on/off choice per method (Admin → Payment
// Methods); razorpayEnabled/codAdvanceInr describe what's technically
// configured — the frontend should show a method only when BOTH allow it.
router.get('/', async (req, res, next) => {
  try {
    const paymentMethods = await getPaymentMethodsConfig();
    res.json({
      success: true,
      razorpayEnabled: razorpay.isConfigured(),
      codAdvanceInr: COD_ADVANCE_INR,
      paymentMethods,
      // Served at runtime rather than baked in at build time. A build-time
      // variable has to be present in the frontend's environment at the
      // moment `npm run build` runs, which on this host means remembering it
      // during a deploy that otherwise only pulls and builds — forget once and
      // analytics goes quiet with nothing to show that it did. Here it sits in
      // the same .env as every other setting and survives every rebuild.
      // Not a secret: a GA measurement id is visible in the page source of
      // every site that uses one.
      gaMeasurementId: process.env.GA_MEASUREMENT_ID || '',
      // Same reasoning as above, and equally not a secret — a pixel id is
      // readable in the page source of every site running one, and Meta's
      // own tooling expects it to be.
      metaPixelId: process.env.META_PIXEL_ID || '',
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
