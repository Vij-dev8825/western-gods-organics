/**
 * Measurement: Google Analytics 4 and the Meta pixel, wired so either can be
 * deployed before its account exists and neither ever runs against a visitor
 * who didn't agree to it.
 *
 * Two independent switches, both of which must be on:
 *
 *   1. An id is configured. Both come from the server's .env
 *      (GA_MEASUREMENT_ID, META_PIXEL_ID), handed to the page by /api/config
 *      via configureAnalytics below, so they live with every other setting and
 *      survive a rebuild. The VITE_ equivalents still work as build-time
 *      overrides for anyone running the frontend on its own.
 *   2. The visitor accepted analytics in the cookie bar. "Only necessary"
 *      means neither script is fetched at all, not that they load and are
 *      asked to behave.
 *
 * The two are independent: configuring one and not the other is normal and
 * works. Every tracking function below sends to whichever is live.
 *
 * The pixel is what makes any future Instagram or Facebook advertising
 * possible at all — without it there is no way to retarget someone who viewed
 * a product, and no way for Meta to learn who converts. It is worth installing
 * well before the first ad runs, because it can only optimise against
 * behaviour it was present to record.
 *
 * Everything is wrapped so a blocked script (ad blockers are common, and
 * block the pixel more often than GA) can never throw into the app.
 * Measurement failing must never break a checkout.
 */

const CONSENT_KEY = 'yo_cookie_consent';

let measurementId = import.meta.env.VITE_GA_MEASUREMENT_ID || '';
let pixelId = import.meta.env.VITE_META_PIXEL_ID || '';
let gaLoaded = false;
let pixelLoaded = false;

/** Supplies the ids fetched from /api/config. Called once on startup, which
 * may be before or after consent is known — initAnalytics is what actually
 * decides to load, and is called again here in case consent was already
 * given on an earlier visit and the startup call had no ids to work with. */
export function configureAnalytics({ gaMeasurementId, metaPixelId } = {}) {
  if (gaMeasurementId && !gaLoaded) measurementId = gaMeasurementId;
  if (metaPixelId && !pixelLoaded) pixelId = metaPixelId;
  initAnalytics();
}

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

function loadGa() {
  if (gaLoaded || !measurementId) return;
  gaLoaded = true;
  try {
    const s = document.createElement('script');
    s.async = true;
    s.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
    document.head.appendChild(s);
    gtag('js', new Date());
    // send_page_view off: the router tells us about navigation, and letting
    // both fire double-counts every page in a single-page app.
    gtag('config', measurementId, { send_page_view: false });
  } catch {
    gaLoaded = false;
  }
}

function loadPixel() {
  if (pixelLoaded || !pixelId) return;
  pixelLoaded = true;
  try {
    // Meta's own snippet is a minified one-liner that does exactly this:
    // stand up a queue so events fired before fbevents.js arrives aren't
    // lost, then replay them once it does. Written out rather than pasted
    // so it can be read and so nothing unexamined runs on every page.
    if (!window.fbq) {
      const fbq = function (...args) {
        if (fbq.callMethod) fbq.callMethod.apply(fbq, args);
        else fbq.queue.push(args);
      };
      fbq.push = fbq;
      fbq.loaded = true;
      fbq.version = '2.0';
      fbq.queue = [];
      window.fbq = fbq;
      window._fbq = fbq;

      const s = document.createElement('script');
      s.async = true;
      s.src = 'https://connect.facebook.net/en_US/fbevents.js';
      document.head.appendChild(s);
    }
    window.fbq('init', pixelId);
  } catch {
    pixelLoaded = false;
  }
}

function fbTrack(event, params) {
  if (!pixelLoaded || !window.fbq) return;
  try {
    window.fbq('track', event, params);
  } catch { /* never let a metric break a page */ }
}

/** Injects whichever tags we're allowed to and have ids for. Safe to call
 * repeatedly — mount, route change, and again the moment consent is given. */
export function initAnalytics() {
  if (typeof document === 'undefined' || !analyticsAllowed()) return;
  loadGa();
  loadPixel();
  // A page view may have been asked for before there was anything to send it
  // to — see pendingPageView below.
  flushPageView();
}

/**
 * The page view we were asked to send, held until something can receive it.
 *
 * On a cold load the ids arrive from /api/config asynchronously, but the
 * router's route effect fires immediately — so the very first trackPageView
 * of a session runs before any tag has loaded. Dropping it would lose the
 * landing page of every single visit, which is the one page campaign
 * attribution is built on: a visitor who arrives from a tagged link, reads one
 * page and leaves would be recorded as nothing at all.
 *
 * So the request is remembered and replayed by initAnalytics once a tag is up.
 */
let pendingPageView = null;

function flushPageView() {
  if (!pendingPageView || (!gaLoaded && !pixelLoaded)) return;
  const { path, title, href } = pendingPageView;
  pendingPageView = null;

  if (gaLoaded) {
    try {
      gtag('event', 'page_view', {
        page_path: path,
        page_title: title || document.title,
        // Sent explicitly rather than left to gtag's own reading of the address
        // bar. Everything that says where a visitor came from — utm_source and
        // friends on a shared link — lives in the query string, and page_path
        // deliberately omits it to keep the path report clean. Without this,
        // attribution would depend on an inference rather than a stated fact.
        // Captured when the view happened, not when it's sent, so a replayed
        // view still reports the address it actually occurred on.
        page_location: href,
      });
    } catch { /* never let a metric break a page */ }
  }
  fbTrack('PageView');
}

export function trackPageView(path, title) {
  pendingPageView = {
    path,
    title,
    href: typeof window !== 'undefined' ? window.location.href : undefined,
  };
  flushPageView();
}

/** Generic GA4 event. Use the GA4 standard names where one exists
 * (add_to_cart, begin_checkout, purchase) so the built-in reports light up
 * instead of everything landing in "custom events". Meta's equivalents are
 * sent by the named helpers below, which map onto its own fixed event list. */
export function trackEvent(name, params = {}) {
  if (!gaLoaded) return;
  try {
    gtag('event', name, params);
  } catch { /* ignore */ }
}

const money = (n) => Math.round(Number(n) || 0);

export function trackViewItem({ id, name, price, size }) {
  trackEvent('view_item', {
    currency: 'INR',
    value: money(price),
    items: [{ item_id: id, item_name: name, item_variant: size, price: money(price) }],
  });
  // The single most valuable pixel event: "people who looked at this product"
  // is the audience every retargeting ad is built from.
  fbTrack('ViewContent', {
    content_ids: [id],
    content_type: 'product',
    content_name: name,
    currency: 'INR',
    value: money(price),
  });
}

export function trackAddToCart({ id, name, price, quantity = 1, size }) {
  trackEvent('add_to_cart', {
    currency: 'INR',
    value: money(price) * quantity,
    items: [{ item_id: id, item_name: name, item_variant: size, price: money(price), quantity }],
  });
  fbTrack('AddToCart', {
    content_ids: [id],
    content_type: 'product',
    content_name: name,
    currency: 'INR',
    value: money(price) * quantity,
  });
}

export function trackBeginCheckout(items, total) {
  const list = items || [];
  trackEvent('begin_checkout', {
    currency: 'INR',
    value: money(total),
    items: list.map((i) => ({
      item_id: i.productId, item_name: i.name, item_variant: i.size,
      price: money(i.price), quantity: i.quantity,
    })),
  });
  fbTrack('InitiateCheckout', {
    content_ids: list.map((i) => i.productId),
    content_type: 'product',
    num_items: list.reduce((n, i) => n + (Number(i.quantity) || 0), 0),
    currency: 'INR',
    value: money(total),
  });
}

export function trackPurchase(order) {
  if (!order) return;
  const items = order.items || [];
  trackEvent('purchase', {
    transaction_id: order.orderNumber || order.id,
    currency: 'INR',
    value: money(order.total),
    items: items.map((i) => ({
      item_id: i.productId, item_name: i.name, item_variant: i.size,
      price: money(i.price), quantity: i.quantity,
    })),
  });
  fbTrack('Purchase', {
    content_ids: items.map((i) => i.productId),
    content_type: 'product',
    num_items: items.reduce((n, i) => n + (Number(i.quantity) || 0), 0),
    currency: 'INR',
    value: money(order.total),
  });
}

/** Did anyone ever actually use the thing we built? Answers questions like
 * "has one person finished the skin quiz" — call with a short stable name. */
export function trackFeatureUse(feature, params = {}) {
  trackEvent('feature_use', { feature, ...params });
}
