/**
 * The Onam pookalam contest.
 *
 * A player finishes a carpet at /onam and submits it. The admin reviews entries,
 * approves the ones fit to show, and picks a winner. The winner is awarded
 * either a coupon — a real one, issued into the same `coupons` collection
 * checkout already reads — or a physical gift the shop hands over itself.
 *
 * Two things drive most of the design here:
 *
 * ENTRY WITHOUT AN ACCOUNT. The shop wanted guests to be able to enter, so an
 * entry carries a name and phone rather than relying on a user id. That has a
 * consequence worth being explicit about: a coupon can only be *locked* to a
 * person when there is a user id to lock it to (`assignedToUserId`, enforced in
 * utils/coupons.js). A guest's prize is therefore an unguessable single-use
 * code instead — `redeemed` still stops it being used twice, but the shop is
 * trusting whoever holds the code. Members get both guards.
 *
 * SEEING YOUR OWN ENTRY. A guest has no login, so there would otherwise be no
 * way to show them their result. Looking an entry up by phone number would let
 * anyone enumerate the contest and read other people's prize codes, so instead
 * every entry gets a `claimToken`: a secret the browser keeps and presents to
 * read its own row. Nothing sensitive is reachable without it.
 */
const crypto = require('crypto');
const { v4: uuid } = require('uuid');
const db = require('../data/db');
const { notifyUser } = require('./notify');

const COLLECTION = 'pookalam-entries';

/** One person should not be able to bury the admin in submissions. */
const MAX_ENTRIES_PER_PHONE = 3;

const STATUSES = ['pending', 'approved', 'rejected'];

/* ------------------------------------------------------------------ *
 * Validation
 * ------------------------------------------------------------------ */

/** Indian mobile numbers, the same shape the OTP login accepts. */
function normalisePhone(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  const local = digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits;
  return /^[6-9]\d{9}$/.test(local) ? local : null;
}

function cleanText(raw, max) {
  return String(raw == null ? '' : raw)
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

/* ------------------------------------------------------------------ *
 * Shaping what leaves the server
 * ------------------------------------------------------------------ */

/**
 * The public gallery form. Deliberately drops phone, claimToken and any prize
 * code — an approved entry is a picture with a first name on it, nothing more.
 */
function toPublic(entry) {
  return {
    id: entry.id,
    title: entry.title,
    name: entry.name,
    image: entry.image,
    score: entry.score,
    blooms: entry.blooms,
    winner: !!entry.winner,
    createdAt: entry.createdAt,
  };
}

/** What the entrant themselves may see, including their prize. */
function toOwner(entry) {
  return {
    ...toPublic(entry),
    status: entry.status,
    prize: entry.prize
      ? {
          kind: entry.prize.kind,
          couponCode: entry.prize.couponCode || null,
          giftNote: entry.prize.giftNote || null,
          awardedAt: entry.prize.awardedAt,
        }
      : null,
  };
}

/** The admin sees everything except the claim token, which is the entrant's. */
function toAdmin(entry) {
  const { claimToken, ...rest } = entry;
  return rest;
}

/* ------------------------------------------------------------------ *
 * Reads
 * ------------------------------------------------------------------ */

const newestFirst = (a, b) => String(b.createdAt).localeCompare(String(a.createdAt));

async function allEntries() {
  const rows = await db.list(COLLECTION);
  return rows.sort(newestFirst);
}

/** Approved entries only, winner pinned to the front. */
async function gallery() {
  const rows = await allEntries();
  const approved = rows.filter((e) => e.status === 'approved');
  approved.sort((a, b) => (b.winner ? 1 : 0) - (a.winner ? 1 : 0) || newestFirst(a, b));
  return approved.map(toPublic);
}

/** An entry by its secret token. The only way a guest reaches their own row. */
async function entryByClaimToken(token) {
  if (!token || String(token).length < 16) return null;
  const rows = await db.list(COLLECTION);
  return rows.find((e) => e.claimToken === token) || null;
}

/** Every entry a logged-in customer has submitted. */
async function entriesForUser(userId) {
  if (!userId) return [];
  const rows = await allEntries();
  return rows.filter((e) => e.userId === userId);
}

/* ------------------------------------------------------------------ *
 * Writes
 * ------------------------------------------------------------------ */

/**
 * Record a submission. `image` is already a stored URL — the route uploads the
 * file through the same handler the review photos use before calling this.
 */
async function createEntry({ title, name, phone, image, score, blooms, userId }) {
  const cleanPhone = normalisePhone(phone);
  if (!cleanPhone) {
    const err = new Error('Please enter a valid 10-digit mobile number.');
    err.status = 400;
    throw err;
  }
  if (!image) {
    const err = new Error('The pookalam picture did not arrive. Please try again.');
    err.status = 400;
    throw err;
  }

  const rows = await db.list(COLLECTION);
  const mine = rows.filter((e) => e.phone === cleanPhone);
  if (mine.length >= MAX_ENTRIES_PER_PHONE) {
    const err = new Error(
      `That number already has ${MAX_ENTRIES_PER_PHONE} entries in this contest.`
    );
    err.status = 409;
    throw err;
  }

  const entry = {
    id: uuid(),
    createdAt: new Date().toISOString(),

    userId: userId || null,
    name: cleanText(name, 40) || 'Anonymous',
    phone: cleanPhone,
    /* 32 hex chars. Long enough that guessing one is not a strategy. */
    claimToken: crypto.randomBytes(16).toString('hex'),

    title: cleanText(title, 60) || 'My Onam Pookalam',
    image,
    score: Number.isFinite(Number(score)) ? Math.max(0, Math.min(100, Math.round(score))) : 0,
    blooms: Number.isFinite(Number(blooms)) ? Math.max(0, Math.round(blooms)) : 0,

    status: 'pending',
    moderatedAt: null,
    winner: false,
    prize: null,
    notified: null,
  };

  await db.put(COLLECTION, entry);
  return entry;
}

async function setStatus(id, status) {
  if (!STATUSES.includes(status)) {
    const err = new Error(`Status must be one of: ${STATUSES.join(', ')}.`);
    err.status = 400;
    throw err;
  }
  const entry = await db.get(COLLECTION, id);
  if (!entry) return null;
  const next = { ...entry, status, moderatedAt: new Date().toISOString() };
  /* Un-approving the winner would leave a prize pinned to a hidden entry. */
  if (status !== 'approved' && next.winner) next.winner = false;
  await db.put(COLLECTION, next);
  return next;
}

async function removeEntry(id) {
  const entry = await db.get(COLLECTION, id);
  if (!entry) return null;
  await db.remove(COLLECTION, id);
  return entry;
}

/**
 * Issue the winner's coupon.
 *
 * Same record shape as the welcome and referral coupons, so checkout, the
 * "available coupons" chips and the admin coupon list all understand it with no
 * further work. `assignedToUserId` is only set for a member — see the note at
 * the top of this file.
 */
async function issueWinnerCoupon({ type, value, minOrder, expiresAt, userId }) {
  const coupon = {
    id: uuid(),
    code: `POOKALAM${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
    type: type === 'flat' ? 'flat' : 'percent',
    value: Number(value),
    minOrder: Number(minOrder) || 0,
    expiresAt: expiresAt || null,
    active: true,
    featured: false,
    promoImage: '',
    promoHeadline: '',
    promoSubtext: '',
    promoLink: '',
    promoCta: '',
    redeemed: false,
    createdAt: new Date().toISOString(),
  };
  if (userId) coupon.assignedToUserId = userId;
  await db.put('coupons', coupon);
  return coupon;
}

/**
 * Mark an entry the winner and give it a prize.
 *
 * `kind: 'coupon'` mints a real code. `kind: 'gift'` records what the shop is
 * sending instead — there is no fulfilment system to hook into, so the note is
 * for the humans packing the parcel.
 *
 * Telling the winner: a member gets an in-app notification (plus email and
 * push, which `notifyUser` no-ops cleanly when unconfigured). A guest gets
 * nothing automatic on purpose — the WhatsApp sender is gated to people who
 * messaged the shop in the last 24 hours, and messaging a stranger through it
 * is what gets a number banned. The route hands the admin a wa.me link to
 * click instead, and the entrant can read their own prize on /onam.
 */
async function awardPrize(id, { kind, type, value, minOrder, expiresAt, giftNote }) {
  const entry = await db.get(COLLECTION, id);
  if (!entry) return null;

  let coupon = null;
  if (kind === 'coupon') {
    const amount = Number(value);
    if (!(amount > 0)) {
      const err = new Error('Enter a discount greater than zero.');
      err.status = 400;
      throw err;
    }
    if (type !== 'flat' && amount > 100) {
      const err = new Error('A percentage discount cannot be over 100.');
      err.status = 400;
      throw err;
    }
    coupon = await issueWinnerCoupon({
      type,
      value: amount,
      minOrder,
      expiresAt,
      userId: entry.userId,
    });
  } else if (kind === 'gift') {
    if (!cleanText(giftNote, 200)) {
      const err = new Error('Describe the gift so whoever packs it knows what to send.');
      err.status = 400;
      throw err;
    }
  } else {
    const err = new Error("Prize kind must be 'coupon' or 'gift'.");
    err.status = 400;
    throw err;
  }

  const prize = {
    kind,
    couponCode: coupon ? coupon.code : null,
    giftNote: kind === 'gift' ? cleanText(giftNote, 200) : null,
    awardedAt: new Date().toISOString(),
  };

  /* A winner has to be visible, or the gallery contradicts itself. */
  const next = { ...entry, winner: true, status: 'approved', prize };

  let notified = null;
  if (entry.userId) {
    const user = await db.get('users', entry.userId);
    if (user) {
      notified = await notifyUser(user, {
        title: 'You won the Onam pookalam contest!',
        message: coupon
          ? `Your prize is the code ${coupon.code} — use it at checkout.`
          : `Your prize: ${prize.giftNote}. We will be in touch about sending it.`,
        image: entry.image,
        meta: { url: '/onam' },
        channels: { inapp: true, email: true, push: true },
      });
    }
  }
  next.notified = notified;

  await db.put(COLLECTION, next);
  return { entry: next, coupon };
}

/** Clear a winner without deleting the entry, e.g. picked the wrong one. */
async function clearWinner(id) {
  const entry = await db.get(COLLECTION, id);
  if (!entry) return null;
  /* The coupon is deliberately left alive. Revoking a code someone may have
     already been told about is worse than letting one extra discount stand. */
  const next = { ...entry, winner: false };
  await db.put(COLLECTION, next);
  return next;
}

module.exports = {
  COLLECTION,
  MAX_ENTRIES_PER_PHONE,
  STATUSES,
  normalisePhone,
  toPublic,
  toOwner,
  toAdmin,
  allEntries,
  gallery,
  entryByClaimToken,
  entriesForUser,
  createEntry,
  setStatus,
  removeEntry,
  awardPrize,
  clearWinner,
};
