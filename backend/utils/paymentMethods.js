const db = require('../data/db');

// All on by default so existing checkouts are unaffected until an admin
// deliberately turns one off from Admin → Payment Methods.
// prepaidDiscountPercent is 0 (off) by default for the same reason — it only
// starts discounting once an admin sets a real rate. It buys down the
// return-to-origin cost of COD by rewarding customers who pay up front.
const DEFAULTS = { cod: true, razorpay: true, codAdvance: true, prepaidDiscountPercent: 0 };

async function getPaymentMethodsConfig() {
  const stored = await db.get('payment-methods', 'main');
  return { ...DEFAULTS, ...stored };
}

module.exports = { getPaymentMethodsConfig, DEFAULTS };
