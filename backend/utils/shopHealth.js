/**
 * Checks, on a schedule, that the shop is actually in a state where someone
 * could buy something — and tells you on WhatsApp the first time it isn't.
 *
 * The failures worth catching here are the silent ones. A server that is down
 * announces itself: the site does not load and you find out. What does not
 * announce itself is a shop that loads perfectly and cannot take money —
 * every size out of stock, every payment method switched off, a payment key
 * rotated and not updated. The pages still render, the photographs still
 * load, and the only symptom is an absence of orders, which looks exactly
 * like an absence of customers.
 *
 * Deliberately does NOT place a test order. Creating and unwinding real
 * orders on a schedule would move stock, pollute the ledgers and the profit
 * report, and eventually get mistaken for a real sale. Every condition below
 * is read, not written.
 */
const db = require('../data/db');
const { getPaymentMethodsConfig } = require('./paymentMethods');
const { getShippingSettings } = require('./shippingSettings');
const { sendWhatsAppMessage } = require('./whatsappBaileys');

const STATE_ID = 'main';
/** A problem that persists gets one reminder a day, not one an hour. */
const RENOTIFY_AFTER_MS = 24 * 60 * 60 * 1000;

async function runChecks() {
  const problems = [];

  const products = await db.list('products');
  const live = products.filter((p) => p.active !== false);

  if (!live.length) {
    problems.push('The catalogue is empty — no products are listed.');
  } else {
    const sizes = live.flatMap((p) => (p.sizes || []).map((s) => ({ p, s })));
    const inStock = sizes.filter(({ s }) => Number(s.stock) > 0);
    if (!sizes.length) {
      problems.push('No product has any sizes, so nothing can be added to a cart.');
    } else if (!inStock.length) {
      problems.push(`Every size is out of stock (${sizes.length} across ${live.length} products). Nobody can buy anything.`);
    }

    // A size priced at zero or below is not a bargain, it is a mistake, and it
    // will take real money out of the till before anyone notices.
    const badPrice = sizes.filter(({ s }) => !(Number(s.price) > 0));
    if (badPrice.length) {
      problems.push(`${badPrice.length} size(s) have a price of zero or less — e.g. ${badPrice[0].p.name} ${badPrice[0].s.label}.`);
    }
  }

  // Field names taken from utils/paymentMethods.js DEFAULTS, not guessed:
  // `cod` and `razorpay` are the two ways to actually pay. `codAdvance` is a
  // modifier on cash-on-delivery rather than a method of its own, so it does
  // not count towards "can anyone pay at all".
  const pay = await getPaymentMethodsConfig();
  if (!pay.cod && !pay.razorpay) {
    problems.push('Both cash on delivery and online payment are switched off, so checkout cannot complete.');
  }
  if (pay.razorpay && !(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET)) {
    problems.push('Online payment is switched on but the Razorpay keys are missing from the environment — card and UPI payments will fail at the last step.');
  }

  // Reading these at all proves the settings row is present and parseable;
  // a throw here is itself the finding.
  const shipping = await getShippingSettings();
  if (!(Number(shipping.domesticFee) >= 0)) {
    problems.push('Shipping settings are missing or malformed, so the cart cannot price delivery.');
  }

  return problems;
}

/**
 * Runs the checks and notifies on a change of state: the first hour something
 * breaks, once a day while it stays broken, and once when it recovers. A
 * monitor that messages you hourly about a problem you already know about is
 * a monitor you learn to ignore.
 */
async function checkShopHealth({ notify = true } = {}) {
  let problems;
  try {
    problems = await runChecks();
  } catch (err) {
    problems = [`The health check itself failed: ${err.message}`];
  }

  const healthy = problems.length === 0;
  const now = Date.now();
  const prev = (await db.get('shop-health', STATE_ID)) || {};
  const wasHealthy = prev.healthy !== false;
  const lastNotified = prev.lastNotifiedAt ? new Date(prev.lastNotifiedAt).getTime() : 0;

  const becameBroken = !healthy && wasHealthy;
  const stillBrokenAndDue = !healthy && !wasHealthy && now - lastNotified > RENOTIFY_AFTER_MS;
  const recovered = healthy && !wasHealthy;
  const shouldNotify = notify && (becameBroken || stillBrokenAndDue || recovered);

  if (shouldNotify && process.env.ADMIN_PHONE) {
    const body = healthy
      ? '✅ Western Gods: the shop can take orders again.'
      : `⚠️ Western Gods: customers may not be able to buy.\n\n${problems.map((p) => `• ${p}`).join('\n')}`;
    try {
      await sendWhatsAppMessage(process.env.ADMIN_PHONE, body);
    } catch (err) {
      // The alert failing must not stop the state being recorded, or the next
      // run would treat this as a fresh change and try again immediately.
      console.error('[shop-health] could not send alert:', err.message);
    }
  }

  await db.put('shop-health', {
    id: STATE_ID,
    healthy,
    problems,
    checkedAt: new Date(now).toISOString(),
    lastNotifiedAt: shouldNotify ? new Date(now).toISOString() : prev.lastNotifiedAt || null,
  });

  return { healthy, problems };
}

module.exports = { checkShopHealth, runChecks };
