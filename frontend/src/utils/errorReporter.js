/**
 * Reports uncaught browser errors to our own backend.
 *
 * Until now, a script error on a customer's phone left no trace anywhere. The
 * only symptom was an order that never arrived, which looks exactly like
 * someone changing their mind — and with no orders yet, "the checkout is
 * broken" and "nobody came" are the same silence.
 *
 * Sends where it happened, not who it happened to: the path without its query
 * string, the message, the stack, and the browser string. No id, no cart, no
 * form contents. The user agent is deliberately kept — an entire day was lost
 * to a fault that turned out to be one browser version missing an API, and
 * without it that is invisible.
 */
const ENDPOINT = '/api/client-errors';

/** A single broken component can fire on every render. This caps what one
 *  page visit can send, so a loop reports the problem rather than becoming a
 *  second one. */
const MAX_PER_PAGE = 5;
let sent = 0;

/** Errors that say nothing and cannot be acted on. "Script error." is what a
 *  cross-origin script gives you with no message, no file and no line — it
 *  identifies nothing and would be most of the table. */
function worthReporting(message) {
  if (!message) return false;
  const m = String(message);
  if (/^script error\.?$/i.test(m.trim())) return false;
  // Extension noise, not our code.
  if (/^ResizeObserver loop/i.test(m)) return false;
  return true;
}

function post(payload) {
  if (sent >= MAX_PER_PAGE) return;
  sent++;
  const body = JSON.stringify({ ...payload, path: window.location.pathname });
  try {
    // sendBeacon survives the page being closed, which is exactly when a fatal
    // error tends to be followed by the visitor leaving.
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
    // Reporting a crash must never cause one.
  }
}

export function installErrorReporter() {
  if (typeof window === 'undefined') return;

  window.addEventListener('error', (event) => {
    // Failed <img>/<script> loads also fire this, with no error object. Those
    // are worth knowing about but are not exceptions, and they arrive in
    // floods on a bad connection — left out on purpose.
    if (!event.error && !event.message) return;
    if (!worthReporting(event.message)) return;
    post({
      kind: 'error',
      message: event.message || String(event.error),
      source: event.filename || '',
      line: event.lineno,
      column: event.colno,
      stack: event.error?.stack || '',
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const message =
      (reason && (reason.message || reason.toString?.())) || 'Unhandled promise rejection';
    if (!worthReporting(message)) return;
    post({
      kind: 'rejection',
      message,
      source: '',
      line: 0,
      column: 0,
      stack: reason?.stack || '',
    });
  });
}
