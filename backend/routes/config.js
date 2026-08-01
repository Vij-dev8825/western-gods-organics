const express = require('express');
const razorpay = require('../utils/razorpay');
const { COD_ADVANCE_INR } = require('../utils/orderBuilder');
const { getPaymentMethodsConfig } = require('../utils/paymentMethods');

const router = express.Router();

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
