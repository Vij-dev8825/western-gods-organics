const db = require('../data/db');

// Matches the values calculateShipping used to hard-code, so nothing
// changes for existing checkouts until an admin edits these.
const DEFAULTS = { domesticFee: 60, domesticFreeThreshold: 999 };

async function getShippingSettings() {
  const stored = await db.get('shipping-settings', 'main');
  return { ...DEFAULTS, ...stored };
}

module.exports = { getShippingSettings, DEFAULTS };
