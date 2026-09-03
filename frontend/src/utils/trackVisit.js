/**
 * Reports a page view to our own first-party visitor count (see
 * backend/utils/siteVisits.js) — separate from, and unconditional on, the
 * opt-in GA4/Meta pixel path in utils/analytics.js. This is what actually
 * answers "how many people visited today" inside the admin dashboard; GA (if
 * ever configured) only answers it in Google's own dashboard, and only for a
 * visitor who accepted analytics cookies.
 *
 * Same sendBeacon-first, fetch-fallback pattern as errorReporter.js — a
 * beacon survives the page being closed, which matters here since it fires
 * on every navigation, including the last one before a visitor leaves.
 */
import { getVisitorId } from './visitorId';

const ENDPOINT = '/api/track/visit';

export function trackVisit() {
  const visitorId = getVisitorId();
  if (!visitorId) return;

  const body = JSON.stringify({ visitorId });
  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon(ENDPOINT, new Blob([body], { type: 'application/json' }));
      return;
    }
    fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    // A visit beacon must never cause a page to error.
  }
}
