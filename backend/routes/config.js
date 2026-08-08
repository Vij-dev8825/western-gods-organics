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
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
