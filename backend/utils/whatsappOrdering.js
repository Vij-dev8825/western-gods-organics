/**
 * WhatsApp "reorder" chat commerce — lets a customer re-place one of their
 * own past orders by texting the business's linked WhatsApp number (see
 * whatsappBaileys.js, which forwards inbound messages here).
 *
 * Deliberately narrow by design: this only replays an EXISTING past order
 * (picked from a numbered list), never parses free-text product requests.
 * That keeps it safe to run unattended — no product-name/quantity guessing
 * that could misfire on an ambiguous message. Anything that isn't a
 * recognized trigger or an in-progress reply gets NO reply at all, so the
 * business's existing human-answered support channel on this same number
 * is completely undisturbed for every other kind of message.
 *
 * Off by default (see isEnabled/setEnabled) — an admin must explicitly turn
 * this on from Admin → WhatsApp Connection once they're ready for it to
 * start responding to real customers.
 */
const db = require('../data/db');
const { buildOrderItems, createOrderRecord } = require('./orderBuilder');

const SITE_URL = 'https://www.westerngodsorganic.com'; // matches routes/sitemap.js's own constant

const TRIGGER_WORDS = ['reorder', 're-order', 'order again'];
const CONFIRM_WORDS = ['yes', 'y', 'confirm', 'confirm order'];
const CANCEL_WORDS = ['no', 'n', 'cancel', 'stop'];
const CONVERSATION_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes of inactivity resets the flow
const MAX_LISTED_ORDERS = 3;

// In-memory only — a lost server restart just means the customer starts
// the flow over by texting "reorder" again, same as any other ephemeral
// session state in this codebase (see utils/otpStore.js).
const conversations = new Map();

function normalizeText(text) {
  return (text || '').trim().toLowerCase();
}

function getConversation(phone) {
  const convo = conversations.get(phone);
  if (convo && Date.now() - convo.updatedAt > CONVERSATION_TIMEOUT_MS) {
    conversations.delete(phone);
    return null;
  }
  return convo || null;
}

function setConversation(phone, data) {
  conversations.set(phone, { ...data, updatedAt: Date.now() });
}

function clearConversation(phone) {
  conversations.delete(phone);
}

async function isEnabled() {
  const config = await db.get('whatsapp-ordering', 'main');
  return !!config?.enabled;
}

async function setEnabled(enabled) {
  await db.put('whatsapp-ordering', { id: 'main', enabled: !!enabled });
}

function summarizeItems(items) {
  return items.map((i) => `${i.quantity}× ${i.name} (${i.size})`).join(', ');
}

async function findUserByPhone(phone) {
  const users = await db.list('users');
  return users.find((u) => u.phone === phone) || null;
}

/** Builds today's price/stock-checked total for repeating a past order's
 * exact items — a past order's price/stock isn't trusted as still valid. */
async function reviveOrder(pastOrder, userId) {
  const items = pastOrder.items.map((i) => ({ productId: i.productId, size: i.size, quantity: i.quantity }));
  const { orderItems, total, stockError } = await buildOrderItems(items, null, pastOrder.address?.country, userId);
  return { orderItems, total, stockError };
}

/** Entry point — called by whatsappBaileys.js for every inbound 1:1 message.
 * Returns the reply text to send back, or null to send nothing at all. */
async function handleIncomingMessage(phone, rawText) {
  if (!(await isEnabled())) return null;

  const text = normalizeText(rawText);
  const convo = getConversation(phone);

  if (!convo) {
    if (!TRIGGER_WORDS.includes(text)) return null; // not our concern — leave it for a human to answer
    return startReorderFlow(phone);
  }

  if (convo.step === 'choose') return handleChooseStep(phone, convo, text);
  if (convo.step === 'confirm') return handleConfirmStep(phone, convo, text);

  clearConversation(phone);
  return null;
}

async function startReorderFlow(phone) {
  const user = await findUserByPhone(phone);
  if (!user) {
    return `We couldn't find an account for this number. Please place your order on our website — ${SITE_URL} — and we'll be happy to help with anything else here!`;
  }

  const orders = (await db.list('orders'))
    .filter((o) => o.userId === user.id && o.status !== 'cancelled')
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, MAX_LISTED_ORDERS);

  if (!orders.length) {
    return `You don't have any past orders yet — browse our shop at ${SITE_URL} to place your first one!`;
  }

  // Shows today's price for repeating each order, not what it originally
  // cost — a past order may have had a subscription/coupon discount that
  // wouldn't apply to a fresh reorder, so showing the old total here would
  // read as a bait-and-switch once the confirmation step shows the real one.
  const revived = await Promise.all(orders.map((o) => reviveOrder(o, user.id)));
  const list = orders
    .map((o, i) => {
      const r = revived[i];
      const priceLine = r.stockError ? '(currently unavailable)' : `₹${r.total}`;
      return `${i + 1}. ${summarizeItems(o.items)} — ${priceLine}`;
    })
    .join('\n');

  setConversation(phone, { step: 'choose', userId: user.id, orderIds: orders.map((o) => o.id) });
  return `Which order would you like to repeat?\n\n${list}\n\nReply with a number, or "cancel" to stop.`;
}

async function handleChooseStep(phone, convo, text) {
  if (CANCEL_WORDS.includes(text)) {
    clearConversation(phone);
    return 'No problem — message "reorder" anytime to start again.';
  }

  const choice = Number(text);
  if (!Number.isInteger(choice) || choice < 1 || choice > convo.orderIds.length) {
    setConversation(phone, convo); // keep the flow alive, just re-prompt
    return `Sorry, I didn't catch that. Reply with a number from 1 to ${convo.orderIds.length}, or "cancel" to stop.`;
  }

  const pastOrder = await db.get('orders', convo.orderIds[choice - 1]);
  if (!pastOrder) {
    clearConversation(phone);
    return "Sorry, that order couldn't be found. Message \"reorder\" to try again.";
  }

  const revived = await reviveOrder(pastOrder, convo.userId);
  if (revived.stockError) {
    clearConversation(phone);
    return `Sorry, that's no longer available: ${revived.stockError} Please check our shop for current stock — ${SITE_URL}`;
  }

  const itemsLine = summarizeItems(revived.orderItems);
  setConversation(phone, {
    step: 'confirm',
    userId: convo.userId,
    pastOrderId: pastOrder.id,
    address: pastOrder.address,
  });
  return (
    `${itemsLine} — ₹${revived.total}, delivered to your address on file, Cash on Delivery.\n\n` +
    `Reply "yes" to confirm, or "no" to cancel.`
  );
}

async function handleConfirmStep(phone, convo, text) {
  if (CANCEL_WORDS.includes(text)) {
    clearConversation(phone);
    return 'No problem — message "reorder" anytime to start again.';
  }
  if (!CONFIRM_WORDS.includes(text)) {
    setConversation(phone, convo);
    return 'Reply "yes" to confirm this order, or "no" to cancel.';
  }

  const pastOrder = await db.get('orders', convo.pastOrderId);
  clearConversation(phone);
  if (!pastOrder) {
    return "Sorry, something went wrong. Message \"reorder\" to try again.";
  }

  const revived = await reviveOrder(pastOrder, convo.userId);
  if (revived.stockError) {
    return `Sorry, that's no longer available: ${revived.stockError} Please check our shop for current stock — ${SITE_URL}`;
  }

  const order = await createOrderRecord({
    userId: convo.userId,
    orderItems: revived.orderItems,
    address: convo.address,
    total: revived.total,
    discount: 0,
    paymentMethod: 'cod',
  });

  return `Order placed! ${order.orderNumber} for ₹${order.total}, Cash on Delivery. We'll message you when it ships.`;
}

module.exports = { handleIncomingMessage, isEnabled, setEnabled };
