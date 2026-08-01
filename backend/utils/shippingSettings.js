const db = require('../data/db');

// Matches the values calculateShipping used to hard-code, so nothing
// changes for existing checkouts until an admin edits these.
const DEFAULTS = { domesticFee: 60, domesticFreeThreshold: 999, domesticShippingEnabled: true, chargeLabel: 'To Pay' };

// The only two customer-facing labels this charge is allowed to show as —
// see AdminShipping.jsx for why both exist (courier "To Pay"/COD terminology
// vs the more familiar "Shipping").
const CHARGE_LABELS = ['Shipping', 'To Pay'];

async function getShippingSettings() {
  const stored = await db.get('shipping-settings', 'main');
  return { ...DEFAULTS, ...stored };
}

module.exports = { getShippingSettings, DEFAULTS, CHARGE_LABELS };
