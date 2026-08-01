const db = require('../data/db');

// All on by default so existing checkouts are unaffected until an admin
// deliberately turns one off from Admin → Payment Methods.
const DEFAULTS = { cod: true, razorpay: true, codAdvance: true };

async function getPaymentMethodsConfig() {
  const stored = await db.get('payment-methods', 'main');
  return { ...DEFAULTS, ...stored };
}

module.exports = { getPaymentMethodsConfig, DEFAULTS };
