const db = require('../data/db');
const { notifyUser } = require('./notify');
const { isWithinReplyWindow } = require('./whatsappBroadcast');

const ABANDONED_AFTER_MS = (parseInt(process.env.ABANDONED_CART_HOURS, 10) || 3) * 60 * 60 * 1000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Reminds a customer once per cart "session" — cart.js clears remindedAt on
 * every add/update/remove, so a fresh abandonment window starts each time
 * the customer touches their cart again, rather than nagging repeatedly
 * about the same items. Runs on a plain setInterval from server.js (no
 * worker process on Render's free plan), same pattern as subscriptions. */
async function processAbandonedCarts() {
  const carts = await db.list('carts');
  const now = Date.now();
  const results = [];

  for (const cart of carts) {
    if (!cart.items?.length) continue;
    if (cart.remindedAt) continue;
    if (!cart.updatedAt || now - new Date(cart.updatedAt).getTime() < ABANDONED_AFTER_MS) continue;

    try {
      const user = await db.get('users', cart.id);
      if (!user) continue;

      const itemCount = cart.items.reduce((sum, i) => sum + (i.quantity || 1), 0);
      // WhatsApp is only added on top of the usual in-app/email reminder when
      // this customer has messaged us themselves in the last 24 hours (see
      // utils/whatsappBroadcast.js) — never sent cold, so it can't contribute
      // to getting this store's WhatsApp number flagged as a spam sender.
      const nudgeOnWhatsApp = await isWithinReplyWindow(user.phone);
      await notifyUser(user, {
        title: 'You left something in your cart',
        message: `${itemCount} item${itemCount === 1 ? '' : 's'} still waiting in your cart — complete your order before it sells out!`,
        meta: { cart: true },
        channels: { inapp: true, email: true, whatsapp: nudgeOnWhatsApp },
      });
      // Same pacing as the broadcast tool — only matters when a WhatsApp
      // send actually just happened, so it costs nothing on the common path.
      if (nudgeOnWhatsApp) await sleep(2000);

      cart.remindedAt = new Date().toISOString();
      await db.put('carts', cart);
      results.push({ userId: cart.id, reminded: true, nudgeOnWhatsApp });
    } catch (err) {
      results.push({ userId: cart.id, error: err.message });
    }
  }

  return results;
}

module.exports = { processAbandonedCarts };
