/**
 * Google Analytics 4, wired so it can be deployed before the property exists
 * and so it never runs against a visitor who didn't agree to it.
 *
 * Two independent switches, both of which must be on:
 *
 *   1. VITE_GA_MEASUREMENT_ID is set at build time. Without it every function
 *      here is a no-op, so this can ship today and start working the day the
 *      ID is added — no code change needed.
 *   2. The visitor accepted analytics in the cookie bar. "Only necessary"
 *      means we never load Google's script at all, not that we load it and
 *      ask it to behave.
 *
 * Everything is wrapped so a blocked script (ad blockers are common) can never
 * throw into the app. Analytics failing must never break a checkout.
 */

const MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID;
const CONSENT_KEY = 'yo_cookie_consent';

let loaded = false;

/** True only when the visitor explicitly accepted — an absent or 'essential'
 * value both mean no. */
export function analyticsAllowed() {
  try {
    return localStorage.getItem(CONSENT_KEY) === 'accepted';
  } catch {
    return false; // private mode / storage disabled — assume no.
  }
}

function gtag(...args) {
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push(args);
}

/** Injects Google's tag once, if we're allowed to. Safe to call repeatedly —
 * mount, route change, and again the moment consent is given. */
export function initAnalytics() {
  if (loaded || !MEASUREMENT_ID || !analyticsAllowed()) return;
  if (typeof document === 'undefined') return;
  loaded = true;
  try {
    const s = document.createElement('script');
    s.async = true;
    s.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`;
    document.head.appendChild(s);
    gtag('js', new Date());
    // send_page_view off: the router tells us about navigation, and letting
    // both fire double-counts every page in a single-page app.
    gtag('config', MEASUREMENT_ID, { send_page_view: false });
  } catch {
    loaded = false;
  }
}

export function trackPageView(path, title) {
  if (!loaded) return;
  try {
    gtag('event', 'page_view', { page_path: path, page_title: title || document.title });
  } catch { /* never let a metric break a page */ }
}

/** Generic event. Use the GA4 standard names where one exists
 * (add_to_cart, begin_checkout, purchase) so the built-in reports light up
 * instead of everything landing in "custom events". */
export function trackEvent(name, params = {}) {
  if (!loaded) return;
  try {
    gtag('event', name, params);
  } catch { /* ignore */ }
}

const money = (n) => Math.round(Number(n) || 0);

export function trackAddToCart({ id, name, price, quantity = 1, size }) {
  trackEvent('add_to_cart', {
    currency: 'INR',
    value: money(price) * quantity,
    items: [{ item_id: id, item_name: name, item_variant: size, price: money(price), quantity }],
  });
}

export function trackBeginCheckout(items, total) {
  trackEvent('begin_checkout', {
    currency: 'INR',
    value: money(total),
    items: (items || []).map((i) => ({
      item_id: i.productId, item_name: i.name, item_variant: i.size,
      price: money(i.price), quantity: i.quantity,
    })),
  });
}

export function trackPurchase(order) {
  if (!order) return;
  trackEvent('purchase', {
    transaction_id: order.orderNumber || order.id,
    currency: 'INR',
    value: money(order.total),
    items: (order.items || []).map((i) => ({
      item_id: i.productId, item_name: i.name, item_variant: i.size,
      price: money(i.price), quantity: i.quantity,
    })),
  });
}

/** Did anyone ever actually use the thing we built? Answers questions like
 * "has one person finished the skin quiz" — call with a short stable name. */
export function trackFeatureUse(feature, params = {}) {
  trackEvent('feature_use', { feature, ...params });
}
