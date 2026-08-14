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
  // Collection at the mill. Off by default — a shop that offers it and isn't
  // ready for someone to turn up has made a promise it can't keep.
  pickupEnabled: false,
  pickupHours: '',
  // A rupee saving per bottle for a customer who brings their own, honoured at
  // the counter rather than taken off the checkout total. Deliberate: the mill
  // can see whether a bottle actually arrived, a payment gateway cannot, and a
  // discount given for something that didn't happen is a refund to chase.
  refillDiscount: 0,
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
