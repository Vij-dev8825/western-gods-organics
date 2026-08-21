/**
 * The festival calendar.
 *
 * Oil demand in Tamil Nadu is not flat. Sesame for the Karthigai lamps,
 * gingelly for the Aadi oil bath, gift hampers before Deepavali — the mill
 * knows this in its bones and the shop knew nothing about it, so every season
 * arrived as a surprise and left as a missed month.
 *
 * Dates are entered by the admin, never computed. Most Tamil festivals follow
 * the lunar calendar and move by weeks from year to year; a formula in this
 * file would be quietly wrong every second year, and wrong here means a
 * customer told to order for a day that isn't the festival. Pongal and Tamil
 * New Year are solar and near-fixed, but there is no reason to special-case
 * two entries when the admin is entering the rest anyway.
 */
const db = require('./../data/db');

/** Days before the festival that an order has to be placed to arrive. Applies
 *  to the whole calendar rather than per festival — it's a property of the
 *  courier, not the occasion. */
const DEFAULT_LEAD_DAYS = 5;

/**
 * Everything here is calendar arithmetic, never timestamp arithmetic.
 *
 * A festival is a day, not a moment. Mixing the two is how "order by the 18th"
 * becomes "order by the 17th": local midnight in IST is 18:30 UTC the previous
 * day, so a Date built from a local midnight and then run through toISOString
 * comes back a date early — which on this page is a deadline stated wrongly to
 * every customer in the country.
 *
 * So: dates are handled as YYYY-MM-DD throughout, compared as UTC midnights,
 * and never round-tripped through a local-time Date.
 */
const ymd = (value) => {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const d = new Date(value);
  // The shop's own calendar day, not UTC's — a mill in Udumalpet at 1am is
  // already on the next date, and "days away" has to agree with the wall.
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const asUtc = (value) => Date.parse(`${ymd(value)}T00:00:00Z`);
const daysBetween = (a, b) => Math.round((asUtc(a) - asUtc(b)) / 86400000);
const shiftDays = (value, days) => ymd(new Date(asUtc(value) - days * 86400000).toISOString());

const clampSpan = (v) => Math.min(Math.max(Math.round(Number(v) || 0), 0), 30);

/**
 * A festival with everything the page needs derived: how far off it is, how
 * long it runs, and the last day to order for it.
 *
 * Most festivals here are not a day. Onam is ten, from Atham to Thiruvonam.
 * Pongal is four. Navaratri is nine. The date the admin enters is the day the
 * festival is *named* for — Thiruvonam, Deepavali, Thai Pongal — because that
 * is the one everybody knows, and the run is described around it: how many
 * days before it starts, how many after it ends. Onam is nine before and none
 * after; Pongal is none before and three after.
 *
 * Both default to zero, so every festival entered before this existed stays
 * exactly a single day and nothing about it changes.
 */
function describe(festival, now = Date.now()) {
  const leadDays = Number.isFinite(Number(festival.leadDays)) ? Number(festival.leadDays) : DEFAULT_LEAD_DAYS;
  const startsDaysBefore = clampSpan(festival.startsDaysBefore);
  const endsDaysAfter = clampSpan(festival.endsDaysAfter);

  const startDate = shiftDays(festival.date, startsDaysBefore);
  const endDate = shiftDays(festival.date, -endsDaysAfter);

  // Counted back from the first day, not the named one. For a ten-day Onam the
  // oil has to be there before Atham, not before Thiruvonam — a deadline aimed
  // at the last day would arrive nine days into the celebration.
  const orderBy = shiftDays(startDate, leadDays);

  const daysAway = daysBetween(festival.date, now);
  const daysToStart = daysBetween(startDate, now);
  const daysToEnd = daysBetween(endDate, now);
  const running = daysToStart <= 0 && daysToEnd >= 0;
  const runDays = startsDaysBefore + endsDaysAfter + 1;

  return {
    ...festival,
    leadDays,
    startsDaysBefore,
    endsDaysAfter,
    startDate,
    endDate,
    runDays,
    // Days away from the named day, which is what a countdown should say even
    // once the celebration has begun: during Onam, Thiruvonam is still coming.
    daysAway,
    daysToStart,
    // On now, somewhere between the first day and the last.
    running,
    // Which day of the run, 1-based, for "day 3 of 10". Null when not running.
    dayOfRun: running ? startsDaysBefore + endsDaysAfter + 1 - daysToEnd : null,
    orderBy,
    // Distinct from "it's passed": a festival two days off can still be
    // celebrated, it just can't be ordered for any more, and telling someone
    // to order for it would be selling them a parcel that arrives too late.
    orderingClosed: daysBetween(orderBy, now) < 0,
  };
}

/** Upcoming festivals, soonest first. A festival is "upcoming" until the day
 *  itself has passed — people buy oil on the morning of Karthigai. */
async function listUpcoming({ limit = null } = {}) {
  const all = await db.list('festivals');
  const now = Date.now();
  const upcoming = all
    // Kept until the run is over rather than until the named day. A ten-day
    // Onam that vanished on Thiruvonam morning would go dark for the nine days
    // people are actually celebrating.
    .filter((f) => f.active !== false && daysBetween(shiftDays(f.date, -clampSpan(f.endsDaysAfter)), now) >= 0)
    .map((f) => describe(f, now))
    .sort((a, b) => a.daysAway - b.daysAway);
  return limit ? upcoming.slice(0, limit) : upcoming;
}

async function listAll() {
  const all = await db.list('festivals');
  return all.map((f) => describe(f)).sort((a, b) => new Date(a.date) - new Date(b.date));
}

/** The one worth putting in front of a shopper right now: the soonest that can
 *  still be ordered for. Returns null when the next one is already too close
 *  to deliver, rather than pushing a deadline that has passed. */
async function nextOrderable() {
  const upcoming = await listUpcoming();
  return upcoming.find((f) => !f.orderingClosed) || null;
}

module.exports = { listUpcoming, listAll, nextOrderable, describe, DEFAULT_LEAD_DAYS };
