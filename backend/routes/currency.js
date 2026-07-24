const express = require('express');
const db = require('../data/db');

const router = express.Router();

const CACHE_MS = 6 * 60 * 60 * 1000; // 6 hours — the upstream API only updates daily anyway

// Seed default — used until an admin saves a country-catalog of their own via
// /admin/country-catalog, and as the fallback if that document is ever empty.
const DEFAULT_COUNTRIES = [
  { code: 'IN', label: 'India', currency: 'INR', symbol: '₹' },
  { code: 'US', label: 'USA', currency: 'USD', symbol: '$' },
  { code: 'GB', label: 'UK', currency: 'GBP', symbol: '£' },
  { code: 'CA', label: 'Canada', currency: 'CAD', symbol: 'C$' },
  { code: 'AU', label: 'Australia', currency: 'AUD', symbol: 'A$' },
  { code: 'SG', label: 'Singapore', currency: 'SGD', symbol: 'S$' },
  { code: 'MY', label: 'Malaysia', currency: 'MYR', symbol: 'RM' },
  { code: 'AE', label: 'UAE', currency: 'AED', symbol: 'AED ' },
];

let fullRatesCache = { rates: null, fetchedAt: 0 };

// Fetches every currency the upstream provider tracks (not just the ones we
// currently use) and caches the whole thing — so admin-adding a new country
// picks up a live rate immediately without needing a fresh upstream call,
// as long as it's a real ISO currency the provider already knows about.
async function getFullLiveRates() {
  if (fullRatesCache.rates && Date.now() - fullRatesCache.fetchedAt < CACHE_MS) {
    return fullRatesCache.rates;
  }
  const res = await fetch('https://open.er-api.com/v6/latest/INR');
  const data = await res.json();
  if (data.result !== 'success') throw new Error('Exchange rate provider returned an error.');
  fullRatesCache = { rates: data.rates, fetchedAt: Date.now() };
  return fullRatesCache.rates;
}

async function getCountries() {
  const catalog = await db.get('country-catalog', 'main');
  return catalog?.countries?.length ? catalog.countries : DEFAULT_COUNTRIES;
}

// Applies any admin-set fixed rates (stored as "1 <currency> = X INR", the
// familiar way exchange rates are normally quoted) on top of the live
// INR-based rates, so a manually overridden currency stays fixed until the
// admin clears it, while everything else still tracks the live rate.
async function getEffectiveRates(countries, fullLive) {
  const overrides = await db.get('currency-overrides', 'main');
  const rates = { INR: 1 };
  for (const c of countries) {
    if (c.currency === 'INR') continue;
    if (fullLive[c.currency]) rates[c.currency] = fullLive[c.currency];
  }
  if (overrides?.inrPerUnit) {
    for (const c of countries) {
      const inrPerUnit = overrides.inrPerUnit[c.currency];
      if (inrPerUnit) rates[c.currency] = 1 / inrPerUnit;
    }
  }
  return rates;
}

// GET /api/currency/rates — the admin-managed country/currency catalog,
// INR-based conversion rates for the storefront's currency selector, plus
// any country-wise minimum order value / shipping fee an admin has set.
// Display/reference only: checkout still charges in INR since payment-
// gateway multi-currency settlement hasn't been set up.
router.get('/rates', async (req, res, next) => {
  const countries = await getCountries().catch(() => DEFAULT_COUNTRIES);
  try {
    const [fullLive, overrides] = await Promise.all([getFullLiveRates(), db.get('currency-overrides', 'main')]);
    const rates = await getEffectiveRates(countries, fullLive);
    res.json({
      success: true,
      base: 'INR',
      countries,
      rates,
      minOrder: overrides?.minOrder || {},
      shipping: overrides?.shipping || {},
    });
  } catch (err) {
    // Serve a stale cache rather than failing the whole storefront if the
    // upstream provider is briefly down.
    if (fullRatesCache.rates) {
      const rates = { INR: 1 };
      for (const c of countries) {
        if (fullRatesCache.rates[c.currency]) rates[c.currency] = fullRatesCache.rates[c.currency];
      }
      return res.json({ success: true, base: 'INR', countries, rates, minOrder: {}, shipping: {}, stale: true });
    }
    next(err);
  }
});

module.exports = router;
module.exports.DEFAULT_COUNTRIES = DEFAULT_COUNTRIES;
module.exports.getCountries = getCountries;
module.exports.getFullLiveRates = getFullLiveRates;
