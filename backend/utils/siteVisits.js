/**
 * A first-party count of who visits the site — no Google Analytics account,
 * no third party receiving visitor data, nothing to configure. Answers "how
 * many people saw the site today" directly in the admin dashboard, which the
 * opt-in GA4/Meta pixel path (see frontend/src/utils/analytics.js) can't:
 * that one only ever runs for a visitor who accepted analytics cookies, and
 * even then the numbers live in Google's own dashboard, not this one.
 *
 * Stored one row per calendar day (id = "YYYY-MM-DD"), not one row per page
 * view — a growing per-visit log would work but never gets smaller, and nothing
 * here needs more than "how many distinct visitors today/this trend" to answer
 * the actual question. A day's distinct visitor count is just how many ids
 * are in that day's array; "unique across the whole month" is deliberately
 * NOT computed, since that would mean keeping a global id set forever — the
 * per-day count already answers what an admin actually wants to know, and
 * doesn't grow without bound.
 */
const db = require('../data/db');
const { isBot } = require('./botMeta');

const TREND_DAYS = 14;
/** Sanity cap on distinct ids per day — this site's real traffic is nowhere
 *  near this; it only exists so a scripted flood can't grow one day's
 *  document without bound. Page views still count past the cap. */
const MAX_VISITOR_IDS_PER_DAY = 20000;
const VISITOR_ID_RE = /^[a-zA-Z0-9-]{8,64}$/;

/** Per-IP throttle, in memory on purpose (see clientErrors.js — same
 *  pattern): this exists to stop a script hammering the endpoint, not to be
 *  a record of who visited when. Generous limit since a real visitor's own
 *  browsing fires this once per page. */
const REQUESTS_PER_IP = 120;
const IP_WINDOW_MS = 10 * 60 * 1000;
const seenByIp = new Map();

function throttled(ip) {
  const now = Date.now();
  const hits = (seenByIp.get(ip) || []).filter((t) => now - t < IP_WINDOW_MS);
  hits.push(now);
  seenByIp.set(ip, hits);
  if (seenByIp.size > 5000) {
    for (const [k, v] of seenByIp) {
      if (!v.length || now - v[v.length - 1] > IP_WINDOW_MS) seenByIp.delete(k);
    }
  }
  return hits.length > REQUESTS_PER_IP;
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

async function recordVisit({ visitorId }, { ip, userAgent } = {}) {
  if (isBot(userAgent)) return { stored: false, reason: 'bot' };
  if (ip && throttled(ip)) return { stored: false, reason: 'throttled' };
  if (typeof visitorId !== 'string' || !VISITOR_ID_RE.test(visitorId)) {
    return { stored: false, reason: 'invalid-id' };
  }

  const date = todayStr();
  const existing = await db.get('site-visits', date);

  if (!existing) {
    await db.put('site-visits', { id: date, date, visitorIds: [visitorId], pageViews: 1 });
    return { stored: true };
  }

  const isNewVisitor = !existing.visitorIds.includes(visitorId);
  await db.put('site-visits', {
    ...existing,
    pageViews: (existing.pageViews || 0) + 1,
    visitorIds: isNewVisitor && existing.visitorIds.length < MAX_VISITOR_IDS_PER_DAY
      ? [...existing.visitorIds, visitorId]
      : existing.visitorIds,
  });
  return { stored: true };
}

/** Today's count plus a 14-day trend, for the admin dashboard. */
async function getVisitStats() {
  const rows = await db.list('site-visits');
  const byDate = Object.fromEntries(rows.map((r) => [r.date, r]));
  const today = todayStr();

  const visitTrend = [];
  for (let i = TREND_DAYS - 1; i >= 0; i--) {
    const dateStr = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const day = byDate[dateStr];
    visitTrend.push({
      date: dateStr,
      visitors: day?.visitorIds.length || 0,
      pageViews: day?.pageViews || 0,
    });
  }

  return {
    visitorsToday: byDate[today]?.visitorIds.length || 0,
    pageViewsToday: byDate[today]?.pageViews || 0,
    visitTrend,
  };
}

module.exports = { recordVisit, getVisitStats };
