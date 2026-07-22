const express = require('express');
const db = require('../data/db');

const router = express.Router();

const SUPPORTED = ['USD', 'GBP', 'CAD', 'AUD', 'SGD', 'MYR', 'AED'];
const CACHE_MS = 6 * 60 * 60 * 1000; // 6 hours — the upstream API only updates daily anyway

let cache = { liveRates: null, fetchedAt: 0 };

async function getLiveRates() {
  if (cache.liveRates && Date.now() - cache.fetchedAt < CACHE_MS) {
    return cache.liveRates;
  }
  const res = await fetch('https://open.er-api.com/v6/latest/INR');
  const data = await res.json();
  if (data.result !== 'success') throw new Error('Exchange rate provider returned an error.');

  const rates = { INR: 1 };
  for (const code of SUPPORTED) {
    if (data.rates[code]) rates[code] = data.rates[code];
  }
  cache = { liveRates: rates, fetchedAt: Date.now() };
  return rates;
}

// Applies any admin-set fixed rates (stored as "1 <currency> = X INR", the
// familiar way exchange rates are normally quoted) on top of the live
// INR-based rates, so a manually overridden currency stays fixed until the
// admin clears it, while everything else still tracks the live rate.
async function getEffectiveRates() {
  const live = await getLiveRates();
  const overrides = await db.get('currency-overrides', 'main');
  if (!overrides?.inrPerUnit) return live;

  const rates = { ...live };
  for (const code of SUPPORTED) {
    const inrPerUnit = overrides.inrPerUnit[code];
    if (inrPerUnit) rates[code] = 1 / inrPerUnit;
  }
  return rates;
}

// GET /api/currency/rates — INR-based conversion rates for the storefront's
// currency selector, plus any country-wise minimum order value an admin has
// set (in that country's own currency; absent/0 means no minimum).
// Display/reference only: checkout still charges in INR since
// payment-gateway multi-currency settlement hasn't been set up.
router.get('/rates', async (req, res, next) => {
  try {
    const [rates, overrides] = await Promise.all([getEffectiveRates(), db.get('currency-overrides', 'main')]);
    res.json({ success: true, base: 'INR', rates, minOrder: overrides?.minOrder || {} });
  } catch (err) {
    // Serve a stale cache rather than failing the whole storefront if the
    // upstream provider is briefly down.
    if (cache.liveRates) {
      return res.json({ success: true, base: 'INR', rates: cache.liveRates, minOrder: {}, stale: true });
    }
    next(err);
  }
});

module.exports = router;
module.exports.SUPPORTED = SUPPORTED;
module.exports.getLiveRates = getLiveRates;
