/**
 * Finding, or making, the account an order belongs to.
 *
 * Lived in routes/orders.js while checkout was the only way an order could
 * exist. An order taken over the phone has to resolve a customer the same way
 * a checkout does — same phone match, same account shape — or the shop ends up
 * with two records for the same person and a loyalty balance split across them.
 *
 * What differs between the two callers is *proof*, not resolution: a guest
 * checking out has to prove the phone is theirs with an OTP, because the
 * request hands back a login token. An admin keying in a call proves nothing —
 * they are the proof, and no token is issued. That distinction stays with the
 * callers; this file only answers "which account is this".
 */
const { v4: uuid } = require('uuid');
const db = require('./../data/db');

async function findUserByPhone(phone) {
  const users = await db.list('users');
  return users.find((u) => u.phone === phone) || null;
}

// Builds a candidate account — does NOT check for an existing phone match or
// persist it (callers decide when and whether to do that).
async function resolveGuestUser(guestInfo, phone) {
  const name = guestInfo?.name?.trim();
  if (!name || name.length < 2) {
    return { error: { status: 400, message: 'Enter your name.' } };
  }
  if (!phone) {
    return { error: { status: 400, message: 'A phone number is required.' } };
  }
  return {
    user: {
      id: uuid(),
      phone,
      name,
      email: guestInfo?.email?.trim() || '',
      role: 'customer',
      addresses: [],
      createdAt: new Date().toISOString(),
    },
  };
}

/**
 * Writes the name/email typed at checkout back onto the account placing the
 * order, so the details a customer enters there become the details we hold
 * for them — no separate trip to the profile page to keep them current.
 *
 * Only ever touches name and email, and only when something actually changed.
 * A blank field is ignored rather than treated as "clear this", so a customer
 * who leaves the optional email empty doesn't wipe the address we already
 * have. Never runs for an admin account, and never for a guest whose phone
 * hasn't been OTP-proved — both are gated by the callers.
 */
async function syncContactDetails(userId, guestInfo) {
  const name = guestInfo?.name?.trim();
  const email = guestInfo?.email?.trim();
  if (!name && !email) return;
  const user = await db.get('users', userId);
  if (!user || user.role === 'admin') return;
  const updated = { ...user };
  if (name && name.length >= 2 && name !== user.name) updated.name = name;
  if (email && email !== user.email) updated.email = email;
  if (updated.name === user.name && updated.email === user.email) return;
  await db.put('users', updated);
}

module.exports = { findUserByPhone, resolveGuestUser, syncContactDetails };
