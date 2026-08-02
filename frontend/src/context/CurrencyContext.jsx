import { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../api';

// Fallback used only until the real admin-managed catalog loads from
// /currency/rates (and if that fetch fails). See AdminCountries for the
// admin UI that manages the real list.
export const DEFAULT_COUNTRIES = [
  { code: 'IN', label: 'India', currency: 'INR', symbol: '₹' },
  { code: 'US', label: 'USA', currency: 'USD', symbol: '$' },
  { code: 'GB', label: 'UK', currency: 'GBP', symbol: '£' },
  { code: 'CA', label: 'Canada', currency: 'CAD', symbol: 'C$' },
  { code: 'AU', label: 'Australia', currency: 'AUD', symbol: 'A$' },
  { code: 'SG', label: 'Singapore', currency: 'SGD', symbol: 'S$' },
  { code: 'MY', label: 'Malaysia', currency: 'MYR', symbol: 'RM' },
  { code: 'AE', label: 'UAE', currency: 'AED', symbol: 'AED ' },
];

const STORAGE_KEY = 'yo_country';
const CurrencyContext = createContext(null);

/** Display-only currency conversion for browsing — checkout always charges
 * in INR (no payment-gateway multi-currency settlement is set up), so
 * formatPrice is for shop/product pages, not the actual amount billed. */
export function CurrencyProvider({ children }) {
  const [countries, setCountries] = useState(DEFAULT_COUNTRIES);
  const [country, setCountryState] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return DEFAULT_COUNTRIES.find((c) => c.code === saved) || DEFAULT_COUNTRIES[0];
  });
  const [rates, setRates] = useState(null);
  const [minOrder, setMinOrder] = useState({});
  const [shipping, setShipping] = useState({});
  // Admin-configurable (see AdminShipping.jsx) — these defaults match
  // backend/utils/shippingSettings.js's DEFAULTS and only matter until the
  // real settings load.
  const [domesticShippingFee, setDomesticShippingFee] = useState(60);
  const [domesticFreeShippingThreshold, setDomesticFreeShippingThreshold] = useState(999);
  const [domesticShippingEnabled, setDomesticShippingEnabled] = useState(true);

  useEffect(() => {
    api.getCurrencyRates().then((d) => {
      setRates(d.rates);
      setMinOrder(d.minOrder || {});
      setShipping(d.shipping || {});
      if (d.countries?.length) setCountries(d.countries);
      if (typeof d.domesticShippingFee === 'number') setDomesticShippingFee(d.domesticShippingFee);
      if (typeof d.domesticFreeShippingThreshold === 'number') setDomesticFreeShippingThreshold(d.domesticFreeShippingThreshold);
      if (typeof d.domesticShippingEnabled === 'boolean') setDomesticShippingEnabled(d.domesticShippingEnabled);
    }).catch(() => {});
  }, []);

  // Once the real catalog loads, re-validate the current selection against
  // it — the synchronous guess above only had DEFAULT_COUNTRIES to go on.
  useEffect(() => {
    setCountryState((current) => countries.find((c) => c.code === current.code) || countries[0]);
  }, [countries]);

  // Drives the subtle per-country accent-color variants in global.css (see
  // the [data-country="XX"] rules there) — a soft nod to each market, never
  // touching layout/logo/photography. Any country without its own override
  // there just keeps the site's default green.
  useEffect(() => {
    document.documentElement.setAttribute('data-country', country.code);
  }, [country.code]);

  function setCountry(code) {
    const found = countries.find((c) => c.code === code);
    if (!found) return;
    localStorage.setItem(STORAGE_KEY, code);
    setCountryState(found);
  }

  function convert(inrAmount) {
    if (country.currency === 'INR' || !rates || !rates[country.currency]) return inrAmount;
    return inrAmount * rates[country.currency];
  }

  function formatPrice(inrAmount) {
    if (country.currency === 'INR' || !rates || !rates[country.currency]) {
      return `₹${Math.round(inrAmount).toLocaleString('en-IN')}`;
    }
    return `${country.symbol}${convert(inrAmount).toFixed(2)}`;
  }

  // A product can set a fixed display price for the current country (see
  // AdminProducts' "country-wise price override" table), overriding the
  // live-rate conversion — useful for round numbers like $4.99 instead of
  // whatever the day's exchange rate happens to produce.
  function getCountryPrice(product, sizeLabel) {
    const val = product?.countryPrices?.[country.code]?.[sizeLabel];
    return typeof val === 'number' && val > 0 ? val : null;
  }

  function formatProductPrice(inrAmount, product, sizeLabel) {
    const override = getCountryPrice(product, sizeLabel);
    if (override != null) return `${country.symbol}${override.toFixed(2)}`;
    return formatPrice(inrAmount);
  }

  // Whether an order of this INR subtotal meets the current country's
  // minimum order value (set per-currency by an admin; 0/absent = no
  // minimum). Compares in the customer's own currency since that's the
  // number they were quoted while browsing, even though checkout still
  // charges the real ₹ amount.
  function checkMinOrder(inrSubtotal) {
    const min = minOrder[country.currency];
    if (!min) return { met: true };
    const converted = convert(inrSubtotal);
    return {
      met: converted >= min,
      minFormatted: `${country.symbol}${min.toFixed(2)}`,
      shortfallFormatted: `${country.symbol}${Math.max(0, min - converted).toFixed(2)}`,
    };
  }

  // Mirrors backend orderBuilder.calculateShipping — lets Cart preview the
  // exact shipping fee for the address's destination country before placing
  // the order (India keeps the existing tiered domestic rate; every other
  // country gets a flat admin-set fee, defaulting to ₹1500 if unset).
  const DEFAULT_INTL_SHIPPING = 1500;
  // freeShippingThreshold lets a logged-in customer's loyalty tier (Silver/
  // Gold — see backend/utils/loyalty.js TIERS) lower or remove the admin's
  // base bar; guests and Bronze members fall back to that admin-configured
  // default (domesticFreeShippingThreshold, from /currency/rates).
  // shippingChoice ('shipping' | 'to_pay') mirrors the backend: "to_pay"
  // hands delivery to a courier who collects their own rate directly from
  // the customer, so the store charges (and can preview) nothing for it.
  function getShippingFee(destCountryCode, inrSubtotal, freeShippingThreshold = domesticFreeShippingThreshold, shippingChoice = 'shipping') {
    if (inrSubtotal === 0) return 0;
    if (!destCountryCode || destCountryCode === 'IN') {
      if (shippingChoice === 'to_pay') return 0;
      if (!domesticShippingEnabled) return 0;
      return inrSubtotal > freeShippingThreshold ? 0 : domesticShippingFee;
    }
    return shipping[destCountryCode] || DEFAULT_INTL_SHIPPING;
  }

  return (
    <CurrencyContext.Provider
      value={{
        country,
        setCountry,
        countries,
        formatPrice,
        formatProductPrice,
        getCountryPrice,
        checkMinOrder,
        getShippingFee,
        domesticShippingEnabled,
        isForeign: country.currency !== 'INR',
      }}
    >
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error('useCurrency must be used within CurrencyProvider');
  return ctx;
}
