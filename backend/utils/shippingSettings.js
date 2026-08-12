const db = require('../data/db');

// Matches the values calculateShipping used to hard-code, so nothing
// changes for existing checkouts until an admin edits these.
//
// localPincodes is empty by default, which switches the local rate off
// entirely — every order keeps paying the ordinary domestic fee until the
// mill decides which pincodes it can actually reach itself.
const DEFAULTS = {
  domesticFee: 60,
  domesticFreeThreshold: 999,
  domesticShippingEnabled: true,
  localPincodes: '',
  localFee: 0,
  localFreeThreshold: 0,
};

async function getShippingSettings() {
  const stored = await db.get('shipping-settings', 'main');
  return { ...DEFAULTS, ...stored };
}

/**
 * Is this address near enough for the mill to deliver itself?
 *
 * Entries are matched as prefixes, so "6421" covers every pincode in that
 * range and a full "642126" matches only that one. A district is a contiguous
 * block of pincodes, which is exactly what a prefix expresses — listing them
 * one by one would be dozens of numbers to keep in step.
 *
 * Deliberately strict about what counts as a pincode: an empty or malformed
 * value must never match a prefix and hand out a cheaper rate by accident.
 */
function isLocalPincode(pincode, settings) {
  const clean = String(pincode || '').replace(/\D/g, '');
  if (clean.length !== 6) return false;

  return String(settings.localPincodes || '')
    .split(/[\s,]+/)
    .map((p) => p.replace(/\D/g, ''))
    .filter(Boolean)
    .some((prefix) => clean.startsWith(prefix));
}

module.exports = { getShippingSettings, isLocalPincode, DEFAULTS };
