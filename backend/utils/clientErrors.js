/**
 * Records JavaScript errors that happen in customers' browsers.
 *
 * Nothing did before. If checkout threw on someone's phone, the only evidence
 * was an order that never arrived — indistinguishable from a visitor who
 * changed their mind. With no orders yet, "the shop is broken" and "nobody
 * came" produce exactly the same silence, and that is a bad pair of
 * possibilities to be unable to tell apart.
 *
 * Deliberately first-party. A hosted service would work, but this needs no
 * account, no monthly cost, and no third party receiving your customers'
 * browsing — and the whole point is a signal you will actually still have in
 * six months.
 *
 * Stored one row per distinct fault rather than per occurrence: the same
 * broken button pressed two hundred times is one problem, and a table with two
 * hundred identical rows is harder to read, not more informative.
 */
const crypto = require('crypto');
const db = require('../data/db');

const MAX_MESSAGE = 300;
const MAX_STACK = 1200;
/** Anything past this many distinct faults in the window is almost certainly
 *  someone poking the endpoint rather than a shop falling over. */
const MAX_DISTINCT_PER_WINDOW = 200;
const WINDOW_MS = 60 * 60 * 1000;

/** Per-IP throttle. In memory on purpose — it resets on restart, which is
 *  fine: this exists to stop a script filling the table, not to be an audit
 *  trail of who was rude. */
const REPORTS_PER_IP = 20;
const IP_WINDOW_MS = 10 * 60 * 1000;
const seenByIp = new Map();

function throttled(ip) {
  const now = Date.now();
  const hits = (seenByIp.get(ip) || []).filter((t) => now - t < IP_WINDOW_MS);
  hits.push(now);
  seenByIp.set(ip, hits);
  // Keep the map from growing without bound on a busy day.
  if (seenByIp.size > 5000) {
    for (const [k, v] of seenByIp) {
      if (!v.length || now - v[v.length - 1] > IP_WINDOW_MS) seenByIp.delete(k);
    }
  }
  return hits.length > REPORTS_PER_IP;
}

const clip = (s, n) => (typeof s === 'string' ? s.slice(0, n) : '');

/** A query string can carry a token, a coupon, an email. The path is what
 *  identifies where the fault happened; the rest is not ours to keep. */
function safePath(url) {
  try {
    return new URL(url, 'https://x').pathname.slice(0, 120);
  } catch {
    return clip(url, 120);
  }
}

/** Same fault, same row. Line and column are included so two different bugs in
 *  one file stay separate, but the message is normalised first so a error
 *  carrying an id ("Product abc123 not found") does not fragment into
 *  thousands of distinct rows. */
function signature({ message, source, line, column }) {
  const normalised = clip(message, MAX_MESSAGE)
    .replace(/\b[0-9a-f]{8}-[0-9a-f-]{27,}\b/gi, '<id>')
    .replace(/\b\d{3,}\b/g, '<n>');
  return crypto
    .createHash('sha1')
    .update(`${normalised}|${safePath(source)}|${line}|${column}`)
    .digest('hex')
    .slice(0, 16);
}

async function recordClientError(payload, { ip, userAgent } = {}) {
  if (ip && throttled(ip)) return { stored: false, reason: 'throttled' };

  const message = clip(payload?.message, MAX_MESSAGE);
  if (!message) return { stored: false, reason: 'empty' };

  const id = signature({
    message,
    source: payload?.source || '',
    line: payload?.line ?? 0,
    column: payload?.column ?? 0,
  });

  const existing = await db.get('client-errors', id);
  const now = new Date().toISOString();

  if (!existing) {
    const all = await db.list('client-errors');
    const recent = all.filter((e) => Date.now() - new Date(e.lastSeen).getTime() < WINDOW_MS);
    if (recent.length >= MAX_DISTINCT_PER_WINDOW) return { stored: false, reason: 'flooded' };
  }

  await db.put('client-errors', {
    id,
    message,
    // Where it happened, not who it happened to.
    path: safePath(payload?.path || ''),
    source: safePath(payload?.source || ''),
    line: Number(payload?.line) || null,
    column: Number(payload?.column) || null,
    stack: clip(payload?.stack, MAX_STACK),
    kind: payload?.kind === 'rejection' ? 'rejection' : 'error',
    // The device matters: an entire class of fault today turned out to be one
    // browser version missing an API. Without this you cannot tell.
    userAgent: clip(userAgent, 200),
    count: (existing?.count || 0) + 1,
    firstSeen: existing?.firstSeen || now,
    lastSeen: now,
  });

  return { stored: true, id };
}

/** Most recent first, and most frequent tie-broken above rare — the question
 *  is usually "what is breaking now", not "what has ever broken". */
async function listClientErrors({ limit = 100 } = {}) {
  const rows = await db.list('client-errors');
  return rows
    .slice()
    .sort((a, b) => String(b.lastSeen).localeCompare(String(a.lastSeen)) || (b.count || 0) - (a.count || 0))
    .slice(0, Math.min(Number(limit) || 100, 500));
}

module.exports = { recordClientError, listClientErrors, signature };
