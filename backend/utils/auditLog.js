/**
 * An append-only record of every change made through the admin area: who did
 * it, what they did, when, and whether it worked.
 *
 * Written as middleware rather than a call inside each route on purpose. There
 * are well over a hundred admin mutations and more arrive every week; a log
 * that has to be remembered is a log with holes in it, and the entries missing
 * would be exactly the ones nobody thought to instrument. Sitting in the
 * request path means a route added next month is covered the day it ships,
 * with nothing for its author to do.
 *
 * It records the shape of a change, not a full before-and-after diff. Knowing
 * that someone edited a product's price at 14:02 is what you need to untangle
 * "who dropped the stock to zero"; reconstructing the old row from the log is
 * a different and much more expensive feature.
 */
const { v4: uuid } = require('uuid');
const db = require('../data/db');

/** Anything whose key looks like a credential never reaches the database.
 *  Admin requests carry OTPs, payment signatures and API keys, and a log of
 *  them would be a worse liability than the missing log it replaced. */
const SENSITIVE_KEY = /pass|token|secret|otp|key|auth|signature|razorpay|cvv|card/i;

/** A product photo arrives as megabytes of base64. Storing that per request
 *  would grow the table faster than the media it describes. */
const MAX_STRING = 120;
const MAX_KEYS = 25;

function redact(value, depth = 0) {
  if (value == null) return value;
  if (typeof value === 'string') {
    return value.length > MAX_STRING ? `${value.slice(0, MAX_STRING)}… (${value.length} chars)` : value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (depth >= 3) return '…';
  if (Array.isArray(value)) {
    return value.length > 5
      ? [...value.slice(0, 5).map((v) => redact(v, depth + 1)), `… ${value.length - 5} more`]
      : value.map((v) => redact(v, depth + 1));
  }
  if (typeof value !== 'object') return String(value);

  const out = {};
  let n = 0;
  for (const [k, v] of Object.entries(value)) {
    if (n >= MAX_KEYS) { out['…'] = 'truncated'; break; }
    out[k] = SENSITIVE_KEY.test(k) ? '[redacted]' : redact(v, depth + 1);
    n++;
  }
  return out;
}

/**
 * Express middleware. Records non-GET admin requests once the response has
 * been sent, so the entry can say whether the change actually succeeded — a
 * rejected attempt is often the more interesting line.
 *
 * Mount after the auth gate so req.user is populated, and so unauthenticated
 * probes never reach it.
 */
function auditAdminMutations(req, res, next) {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next();

  // Captured now: a route handler is free to mutate req.body, and by the time
  // the response finishes it may no longer resemble what was sent.
  const snapshot = req.is('multipart/form-data') ? { note: 'file upload' } : redact(req.body);

  res.on('finish', () => {
    // Deliberately not awaited and never allowed to throw. An audit entry is
    // worth having; it is not worth failing a stock correction over, and the
    // response has already gone out regardless.
    Promise.resolve()
      .then(() =>
        db.put('audit-log', {
          id: uuid(),
          at: new Date().toISOString(),
          actorId: req.user?.id || null,
          actorPhone: req.user?.phone || null,
          method: req.method,
          // The mounted path, so entries read as /products/castor-oil-1l
          // rather than the full /api/admin/... every time.
          path: req.originalUrl.replace(/^\/api\/admin/, '') || '/',
          status: res.statusCode,
          ok: res.statusCode < 400,
          body: snapshot,
        })
      )
      .catch((err) => {
        console.error('[audit] could not record entry:', err.message);
      });
  });

  next();
}

/** Newest first, because the question is almost always "what just happened".
 *  Capped rather than paged: this is a glance, not an archive browser. */
async function listAuditLog({ limit = 200 } = {}) {
  const rows = await db.list('audit-log');
  return rows
    .slice()
    .sort((a, b) => String(b.at).localeCompare(String(a.at)))
    .slice(0, Math.min(Number(limit) || 200, 1000));
}

module.exports = { auditAdminMutations, listAuditLog, redact };
