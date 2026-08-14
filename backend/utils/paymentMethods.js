const db = require('../data/db');

// All on by default so existing checkouts are unaffected until an admin
// deliberately turns one off from Admin → Payment Methods.
// prepaidDiscountPercent is 0 (off) by default for the same reason — it only
// starts discounting once an admin sets a real rate. It buys down the
// return-to-origin cost of COD by rewarding customers who pay up front.
// gatewayFeePercent is what Razorpay keeps out of an online payment, used only
// by Admin → Profit. 0 by default for the same reason as the discount above:
// the rate depends on the plan and the instrument (UPI is often free, cards are
// not), and a guessed number in a profit report is worse than a missing one.
const DEFAULTS = { cod: true, razorpay: true, codAdvance: true, prepaidDiscountPercent: 0, gatewayFeePercent: 0 };

async function getPaymentMethodsConfig() {
  const stored = await db.get('payment-methods', 'main');
  return { ...DEFAULTS, ...stored };
}

module.exports = { getPaymentMethodsConfig, DEFAULTS };
