/**
 * The shop's own assistant.
 *
 * WHY THIS EXISTS. The chat widget used to be a thin wrapper round Google's
 * Gemini API, and when that call failed — a deprecated model id, an exhausted
 * free-tier quota, a revoked key — every customer got the same dead end:
 * "Sorry, I'm having trouble right now." A shop assistant that stops working
 * when someone else's service has a bad day is not really the shop's.
 *
 * So this answers from the shop's own data instead: the live catalogue, the
 * live shipping and payment settings, the running offers, the festival
 * calendar, and — for a signed-in customer — their own orders. No API key, no
 * quota, no per-message cost, no network call, and an answer in about a
 * millisecond rather than eight seconds.
 *
 * WHAT IT IS AND IS NOT. This is retrieval and intent matching, not a language
 * model. It will not discuss the weather or write a poem. What it will do is
 * answer, correctly and from live numbers, the questions people actually ask a
 * shop: what suits my hair, what does the litre cost, is it in stock, when will
 * it arrive, do you take cash on delivery, where is my order, what offers are
 * on. Everything else it says it cannot help with and points at a human — which
 * is what the Gemini prompt instructed too, and is far better than a confident
 * invention.
 *
 * THE RULES IT KEEPS. Carried over deliberately from the prompt this replaces,
 * because they were right:
 *   - Never invent a product, price, id or claim. Every number is read live.
 *   - Never promise a cure. Traditional use is described as traditional use.
 *   - Never mention a coupon assigned to a particular customer — that is
 *     someone else's discount, and announcing it to whoever is chatting hands
 *     it out.
 *   - Never reveal another customer's orders.
 *   - Say plainly when it does not know.
 */
const db = require('./../data/db');
const { getShippingSettings } = require('./shippingSettings');
const { getPaymentMethodsConfig } = require('./paymentMethods');
const { listUpcoming } = require('./festivals');

const MAX_PRODUCTS = 3;
const RECENT_ORDERS_SHOWN = 3;

/* Catalogue and settings change on an admin's timescale, not a chat's, so they
   are held briefly rather than re-read on every keystroke. Short enough that a
   price edit shows up within the minute. */
const CACHE_TTL_MS = 60_000;
let cache = { data: null, expiresAt: 0 };

/* ==========================================================================
 * Understanding the question
 * ======================================================================== */

/**
 * Words customers actually use, mapped to the words the catalogue uses.
 *
 * Half this shop's customers write in Tamil, Hindi or Malayalam transliterated
 * into English — "ennai" for oil, "manjal" for turmeric, "mudi" for hair. A
 * matcher that only knows English catalogue terms fails them silently, which
 * for a Tamil Nadu mill is the wrong half of the audience to fail.
 */
const SYNONYMS = {
  oil: ['ennai', 'enna', 'tel', 'thailam', 'yenna', 'oils'],
  coconut: ['thengai', 'nariyal', 'nalikera', 'copra', 'velichenna'],
  sesame: ['ellu', 'til', 'gingelly', 'nallennai', 'thil'],
  castor: ['amanakku', 'arandi', 'vilakkennai'],
  groundnut: ['peanut', 'verkadalai', 'mungfali', 'kadalai'],
  soap: ['sabun', 'saabun', 'soaps'],
  neem: ['vembu', 'veppam'],
  turmeric: ['manjal', 'haldi'],
  powder: ['podi', 'powders', 'churna'],
  moringa: ['murungai', 'drumstick', 'sahjan'],
  amla: ['nellikai', 'gooseberry', 'nellikkai'],
  tulsi: ['thulasi', 'holy basil'],
  sandalwood: ['chandan', 'santhanam'],
  hair: ['mudi', 'baal', 'hairfall', 'hair-fall', 'dandruff', 'scalp', 'thalai'],
  skin: ['charmam', 'twacha', 'face', 'complexion', 'acne', 'pimple', 'glow'],
  cooking: ['cook', 'food', 'fry', 'frying', 'samayal', 'kitchen', 'edible', 'khana'],
  massage: ['abhyanga', 'body', 'joint', 'muscle'],
  baby: ['infant', 'newborn', 'kuzhandhai'],
  price: ['cost', 'rate', 'rupees', 'how much', 'vilai', 'kimat', 'mrp', 'cheap', 'expensive'],
  delivery: ['deliver', 'ship', 'shipping', 'courier', 'arrive', 'dispatch', 'post'],
};

/* Flattened once: alias -> canonical. */
const ALIAS = new Map();
for (const [canon, words] of Object.entries(SYNONYMS)) {
  ALIAS.set(canon, canon);
  for (const w of words) ALIAS.set(w, canon);
}

const STOP = new Set([
  'a', 'an', 'the', 'is', 'are', 'am', 'do', 'does', 'did', 'i', 'you', 'we', 'me', 'my',
  'to', 'for', 'of', 'in', 'on', 'at', 'and', 'or', 'it', 'this', 'that', 'can', 'could',
  'would', 'should', 'will', 'have', 'has', 'want', 'need', 'please', 'pls', 'hi', 'me',
  'any', 'some', 'what', 'which', 'how', 'when', 'where', 'your', 'their', 'about', 'with',
]);

function normalise(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Tokens with synonyms folded to their canonical word and stop words dropped. */
function tokenise(text) {
  const raw = normalise(text).split(' ').filter(Boolean);
  const out = [];
  for (const w of raw) {
    const canon = ALIAS.get(w) || w;
    if (!STOP.has(canon) && canon.length > 1) out.push(canon);
  }
  return out;
}

/**
 * Does the text contain any of these phrases?
 *
 * Single words must match on WORD BOUNDARIES. A plain substring test looks
 * fine until you try it: "is it chemical free" answered a question about
 * payment, because "chemical" contains "emi"; "do you do wholesale" answered
 * about discounts, because "wholesale" contains "sale". Multi-word phrases like
 * "cash on delivery" stay plain substring, since they cannot collide by
 * accident and a boundary test would trip over the spacing.
 */
const wordRe = new Map();
function hasAny(text, phrases) {
  return phrases.some((p) => {
    if (p.includes(' ')) return text.includes(p);
    let re = wordRe.get(p);
    if (!re) {
      /* A bare \b...\b was too strict in the other direction: it stopped
         matching plurals, so "any offers" no longer reached the offers intent
         while "any offer" did. Allowing a short suffix keeps the boundary that
         fixed "chemical"/"emi" while letting offer/offers, coupon/coupons and
         return/returns through. */
      const stem = p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      re = new RegExp(`\\b${stem}(?:s|es|ing|ed)?\\b`);
      wordRe.set(p, re);
    }
    return re.test(text);
  });
}

/* ==========================================================================
 * Reading the shop
 * ======================================================================== */

async function loadShop() {
  const now = Date.now();
  if (cache.data && cache.expiresAt > now) return cache.data;

  const [products, shipping, payments, coupons, festivals, reviews] = await Promise.all([
    db.list('products'),
    getShippingSettings(),
    getPaymentMethodsConfig(),
    db.list('coupons'),
    listUpcoming({ limit: 3 }).catch(() => []),
    db.list('reviews').catch(() => []),
  ]);

  const data = { products, shipping, payments, coupons, festivals, reviews };
  cache = { data, expiresAt: now + CACHE_TTL_MS };
  return data;
}

/** Invalidate, so a test or an admin edit can force a fresh read. */
function clearCache() {
  cache = { data: null, expiresAt: 0 };
}

/** Descriptions are sometimes a plain string and sometimes {en, ta, ...}. */
function plainText(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return value.en || Object.values(value)[0] || '';
}

const rupees = (n) => `₹${Number(n).toLocaleString('en-IN')}`;

/** The cheapest live size, used when someone asks "how much". */
function fromPrice(product) {
  const inStock = (product.sizes || []).filter((s) => s.stock > 0);
  const pool = inStock.length ? inStock : product.sizes || [];
  if (!pool.length) return null;
  return pool.reduce((lo, s) => (s.price < lo.price ? s : lo), pool[0]);
}

function sizeLine(product) {
  const sizes = product.sizes || [];
  if (!sizes.length) return 'price on request';
  return sizes
    .map((s) => {
      const stock = s.stock > 5 ? '' : s.stock > 0 ? ` — only ${s.stock} left` : ' — out of stock';
      return `${s.label} ${rupees(s.price)}${stock}`;
    })
    .join(', ');
}

/**
 * Best value per unit across a product's sizes.
 *
 * "Which size should I buy" is one of the most common questions and the only
 * honest answer is arithmetic, so it is done here rather than described
 * vaguely. Only sizes whose label parses to a real quantity are compared.
 */
function bestValue(product) {
  const parsed = (product.sizes || [])
    .map((s) => {
      const m = /([\d.]+)\s*(ml|l|g|kg)/i.exec(s.label || '');
      if (!m) return null;
      const n = parseFloat(m[1]);
      const unit = m[2].toLowerCase();
      const base = unit === 'l' ? n * 1000 : unit === 'kg' ? n * 1000 : n;
      if (!(base > 0)) return null;
      return { ...s, per100: (s.price / base) * 100, metric: unit === 'g' || unit === 'kg' ? 'g' : 'ml' };
    })
    .filter(Boolean);
  if (parsed.length < 2) return null;
  return parsed.reduce((lo, s) => (s.per100 < lo.per100 ? s : lo), parsed[0]);
}

/* ==========================================================================
 * Finding products
 * ======================================================================== */

/**
 * Score a product against the question.
 *
 * Weighted so that naming a product beats naming its category, which beats
 * matching a word buried in its description. Without the weighting, "coconut
 * oil" scored every oil equally because they all say "oil" several times.
 */
function scoreProduct(product, tokens) {
  const name = normalise(product.name);
  const cat = normalise(product.category);
  const tags = (product.tags || []).map(normalise).join(' ');
  const body = normalise(plainText(product.shortDescription) + ' ' + plainText(product.description));

  let score = 0;
  for (const t of tokens) {
    if (name.includes(t)) score += 6;
    if (tags.includes(t)) score += 4;
    if (cat.includes(t)) score += 3;
    else if (cat.startsWith(t) || t.startsWith(cat.replace(/s$/, ''))) score += 2;
    if (body.includes(t)) score += 1;
  }
  return score;
}

function findProducts(products, tokens, limit = MAX_PRODUCTS) {
  if (!tokens.length) return [];
  const scored = products
    .map((p) => ({ p, score: scoreProduct(p, tokens) }))
    .filter((x) => x.score >= 4)
    .sort((a, b) => b.score - a.score);
  if (!scored.length) return [];

  /* Relative cutoff, not just an absolute floor. "coconut oil" scores every
     oil in the shop because they all match "oil", so asking for one thing came
     back with three. Anything under half the winner's score is noise next to a
     clear match. */
  const floor = Math.max(4, scored[0].score * 0.5);
  return scored.filter((x) => x.score >= floor).slice(0, limit).map((x) => x.p);
}

/* ==========================================================================
 * Composing answers
 * ======================================================================== */

const reply = (text, products = [], suggestions = []) => ({
  reply: text,
  productIds: products.map((p) => p.id),
  suggestions: suggestions.slice(0, 3),
  handled: true,
});

const UNSURE = {
  handled: false,
};

function describeProducts(list) {
  return list
    .map((p) => {
      const why = plainText(p.shortDescription).split(/[.;]/)[0].trim();
      return `${p.name} — ${sizeLine(p)}${why ? `. ${why}` : ''}`;
    })
    .join('\n');
}

/* ==========================================================================
 * Intents
 *
 * Each returns an answer or UNSURE. Ordered by how specific they are: the
 * narrow ones get first refusal, and product search is the catch-all because
 * most questions at a shop are about a thing it sells.
 * ======================================================================== */

function greeting(text) {
  if (!/^(hi|hey|hello|vanakkam|namaste|namaskaram|good (morning|afternoon|evening))\b/.test(text)) {
    return UNSURE;
  }
  return reply(
    'Hello. I can help you find an oil, soap or powder, check a price or stock, or explain delivery and payment. What are you looking for?',
    [],
    ['Which oil for hair?', 'What are your prices?', 'Do you deliver to my area?']
  );
}

function thanks(text) {
  if (!/(thank|thanks|nandri|dhanyavad|shukriya)/.test(text)) return UNSURE;
  return reply('Happy to help. Anything else you would like to know?', [], [
    'Show me your bestsellers',
    'What offers are running?',
  ]);
}

function shipping(text, shop) {
  if (
    !hasAny(text, ['deliver', 'shipping', 'ship', 'courier', 'arrive', 'dispatch', 'how long', 'when will'])
  ) {
    return UNSURE;
  }
  const s = shop.shipping;
  const domestic = s.domesticShippingEnabled
    ? `Within India, delivery is free on orders above ${rupees(s.domesticFreeThreshold)}; below that it is ${rupees(s.domesticFee)}.`
    : 'Within India, delivery is arranged directly with the courier ("To Pay"), so no delivery fee is added to your order total.';
  return reply(
    `${domestic} We ship worldwide too, at a flat fee per destination country — customs or import duties are charged on delivery and are not included in the order total. You can check your pincode on any product page.`,
    [],
    ['Do you take cash on delivery?', 'What is your return policy?']
  );
}

function payment(text, shop) {
  if (!hasAny(text, ['pay', 'payment', 'cod', 'cash on delivery', 'upi', 'card', 'razorpay', 'emi'])) {
    return UNSURE;
  }
  const p = shop.payments;
  const methods = [
    p.cod && 'Cash on Delivery',
    p.razorpay && 'online payment by card, UPI or wallet',
    p.codAdvance && 'part-advance online with the balance on delivery',
  ].filter(Boolean);
  const extra =
    p.prepaidDiscountPercent > 0
      ? ` Paying online earns an extra ${p.prepaidDiscountPercent}% off.`
      : '';
  return reply(
    `${methods.length ? `We accept ${methods.join(', ')}.` : 'We accept online payment.'}${extra}`,
    [],
    ['How much is delivery?', 'What offers are running?']
  );
}

function returns(text) {
  if (!hasAny(text, ['return', 'refund', 'exchange', 'damaged', 'broken', 'leaked', 'wrong item'])) {
    return UNSURE;
  }
  return reply(
    'You can raise a return within 7 days of delivery for anything damaged, incorrect or with a quality issue — do it from the Orders page in your account and we will take it from there. If it is urgent, use "Chat with us" or WhatsApp and a person will pick it up.',
    [],
    ['Where is my order?', 'How do I contact you?']
  );
}

function offers(text, shop) {
  if (!hasAny(text, ['offer', 'discount', 'coupon', 'promo', 'deal', 'sale', 'code'])) return UNSURE;
  const now = new Date();
  /* Only coupons anyone may use. One assigned to a particular customer is that
     customer's business — announcing it here would hand out their discount. */
  const open = shop.coupons.filter(
    (c) => c.active && !c.assignedToUserId && !c.redeemed && (!c.expiresAt || new Date(c.expiresAt) >= now)
  );
  if (!open.length) {
    return reply(
      'No general offers are running at the moment. Subscribe & Save takes 10% off recurring deliveries though, and you can set that up from any product page.',
      [],
      ['Tell me about Subscribe & Save', 'Show me your bestsellers']
    );
  }
  const lines = open
    .slice(0, 4)
    .map((c) => {
      const value = c.type === 'flat' ? `${rupees(c.value)} off` : `${c.value}% off`;
      const min = c.minOrder ? ` on orders above ${rupees(c.minOrder)}` : '';
      return `${c.code} — ${value}${min}`;
    })
    .join('\n');
  return reply(`Running right now:\n${lines}\n\nEnter the code at checkout.`, [], [
    'Show me your bestsellers',
    'How much is delivery?',
  ]);
}

function festivals(text, shop) {
  if (!hasAny(text, ['festival', 'onam', 'diwali', 'deepavali', 'pongal', 'holi', 'karthigai', 'gift'])) {
    return UNSURE;
  }
  const next = shop.festivals?.[0];
  if (!next) {
    return reply(
      'Nothing is in the festival calendar just now. Our gift hampers are on the Gifting page whenever you need one.',
      [],
      ['Show me your bestsellers']
    );
  }
  const when =
    next.daysAway === 0 ? 'today' : next.daysAway === 1 ? 'tomorrow' : `in ${next.daysAway} days`;
  const order =
    next.orderingClosed === false && next.orderBy
      ? ` To have it arrive in time, order by ${new Date(next.orderBy).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}.`
      : ' Ordering for it has closed, but everything is still pressed fresh each week.';
  return reply(`${next.name} is ${when}.${order}`, [], [
    'What offers are running?',
    'Show me gift options',
  ]);
}

async function orderStatus(text, user) {
  if (!hasAny(text, ['my order', 'order status', 'where is my', 'track', 'delivered yet', 'last time', 'reorder'])) {
    return UNSURE;
  }
  if (!user?.id) {
    return reply(
      'Sign in and I can look up your orders here. If you checked out as a guest, use "Chat with us" or WhatsApp with your order number and our team will find it.',
      [],
      ['How do I contact you?']
    );
  }
  /* Never read anything but this signed-in customer's own rows. */
  const orders = (await db.list('orders'))
    .filter((o) => o.userId === user.id)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, RECENT_ORDERS_SHOWN);

  if (!orders.length) {
    return reply('You have no orders on this account yet.', [], ['Show me your bestsellers']);
  }
  const lines = orders
    .map((o) => {
      const when = new Date(o.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
      const items = (o.items || []).map((i) => `${i.name} ${i.size} x${i.quantity}`).join(', ');
      return `${when} — ${o.status}: ${items}`;
    })
    .join('\n');
  return reply(`Your most recent orders:\n${lines}\n\nFull details are on your Orders page.`, [], [
    'What is your return policy?',
  ]);
}

function about(text) {
  /* Not a bare "about" — as a preposition it appears in half the questions
     anyone ever types, and it was answering "write me a poem about rain" with
     the company history. */
  if (!hasAny(text, ['who are you', 'about you', 'about your', 'about the shop', 'wood press', 'cold press', 'how do you make', 'how is it made', 'how are they made', 'chekku', 'kachi ghani', 'where are you', 'located', 'your mill', 'organic', 'chemical', 'preservative', 'additive'])) {
    return UNSURE;
  }
  return reply(
    'We are a small family-run mill in Udumalpet, Tamil Nadu. The oils are wood-pressed (chekku / kachi ghani) in slow stone-and-wood presses that keep the temperature low, then settled and filtered — no heat refining, no solvents, no additives. Every batch carries a number you can trace back to its pressing date and source farm from the product page.',
    [],
    ['Show me your oils', 'How much is delivery?']
  );
}

const REVIEW_STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'was', 'this', 'that', 'have', 'has', 'not', 'but', 'are',
  'you', 'your', 'from', 'very', 'good', 'nice', 'great', 'product', 'use', 'used', 'after',
  'all', 'just', 'also', 'get', 'got', 'its', 'my', 'our', 'out', 'been', 'were', 'when',
  'than', 'then', 'they', 'them', 'will', 'would', 'could', 'about', 'really',
]);

/**
 * Top few words mentioned by at least two different reviewers, excluding the
 * product's own name so "castor" or "oil" doesn't win every time — this is
 * meant to surface what people say beyond the fact that it's the product they
 * bought. Counts each word once per review (not per occurrence), so one
 * gushing review can't dominate the tally on its own. Returns null rather
 * than guessing when there isn't enough real text to say anything honest.
 */
function summarizeProductReviews(product, reviews) {
  const nameWords = new Set(tokenise(product.name));
  const withText = reviews.filter(
    (r) => r.productId === product.id && r.text && r.text.trim().length > 10
  );
  if (withText.length < 3) return null;

  const freq = new Map();
  for (const r of withText) {
    const words = r.text.toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/).filter(Boolean);
    const seenInThisReview = new Set();
    for (const w of words) {
      if (w.length < 4 || REVIEW_STOPWORDS.has(w) || nameWords.has(w) || seenInThisReview.has(w)) continue;
      seenInThisReview.add(w);
      freq.set(w, (freq.get(w) || 0) + 1);
    }
  }
  const top = [...freq.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([w]) => w);
  return top.length ? top : null;
}

function reviewsInsight(text, tokens, shop) {
  if (
    !hasAny(text, [
      'review', 'reviews', 'what do people say', 'what do customers say', 'customers say',
      'feedback', 'is it good', 'worth buying', 'worth it', 'people think',
    ])
  ) {
    return UNSURE;
  }

  const [product] = findProducts(shop.products, tokens, 1);
  if (!product) {
    return reply(
      'Tell me which product you mean and I can tell you what reviewers actually say about it.',
      [],
      ['Show me your bestsellers']
    );
  }

  const mentions = summarizeProductReviews(product, shop.reviews || []);
  const ratingLine =
    product.rating && product.reviewsCount
      ? `${product.name} is rated ${product.rating}/5 from ${product.reviewsCount} review${product.reviewsCount === 1 ? '' : 's'}.`
      : `${product.name} doesn't have enough reviews yet to rate.`;

  return reply(
    mentions
      ? `${ratingLine} Customers often mention: ${mentions.join(', ')}.`
      : `${ratingLine} Not enough review text yet to say what people mention most.`,
    [product],
    ['Which size is best value?', 'Is it in stock?']
  );
}

function contact(text) {
  if (!hasAny(text, ['contact', 'phone', 'call', 'whatsapp', 'email', 'reach you', 'talk to'])) {
    return UNSURE;
  }
  return reply(
    'Use "Chat with us" here and a person will reply, or reach us on WhatsApp from the button on any page. The Contact page has our phone number and email too.',
    [],
    ['Where is my order?']
  );
}

function bulk(text) {
  if (!hasAny(text, ['bulk', 'wholesale', 'distributor', 'reseller', 'litres', 'private label', 'b2b', 'gst'])) {
    return UNSURE;
  }
  return reply(
    'We do bulk and wholesale from 20 litres per product, with GST invoicing and private-label bottling available. Send the details through the Bulk Sales Enquiry page and we will quote you.',
    [],
    ['How do I contact you?']
  );
}

function subscription(text) {
  if (!hasAny(text, ['subscribe', 'subscription', 'recurring', 'every month', 'monthly'])) return UNSURE;
  return reply(
    'Subscribe & Save takes 10% off a recurring delivery and you can cancel any time. Set it up from any product page — choose the size and how often you want it.',
    [],
    ['Show me your oils']
  );
}

/** "Which oil for hair" and friends — a need rather than a product name. */
function byConcern(text, tokens, shop) {
  const concerns = {
    hair: ['hair'],
    skin: ['skin'],
    cooking: ['cooking'],
    massage: ['massage'],
    baby: ['baby'],
  };
  const hit = Object.keys(concerns).find((c) => tokens.includes(c));
  if (!hit) return UNSURE;

  const found = findProducts(shop.products, [hit, ...tokens], MAX_PRODUCTS);
  if (!found.length) return UNSURE;

  const lead = {
    hair: 'For hair',
    skin: 'For skin',
    cooking: 'For everyday cooking',
    massage: 'For massage',
    baby: 'For a baby',
  }[hit];

  /* Traditional use, never a medical claim — the same line the old prompt drew. */
  return reply(
    `${lead}, these are what people here buy most:\n${describeProducts(found)}\n\nThese are traditional uses rather than medical advice — do check with a doctor for anything health-related.`,
    found,
    ['Which size is best value?', 'Is it in stock?', 'How much is delivery?']
  );
}

function stock(text, tokens, shop) {
  if (!hasAny(text, ['in stock', 'available', 'stock', 'sold out', 'out of stock'])) return UNSURE;
  const found = findProducts(shop.products, tokens, 2);
  if (!found.length) {
    const anyOut = shop.products.filter((p) => (p.sizes || []).every((s) => s.stock <= 0));
    return reply(
      anyOut.length
        ? `Everything is in stock except ${anyOut.map((p) => p.name).join(', ')}. Which one did you want?`
        : 'Everything in the catalogue is in stock right now. Which one did you want?',
      [],
      ['Show me your oils', 'Show me your soaps']
    );
  }
  const lines = found
    .map((p) => {
      const live = (p.sizes || []).filter((s) => s.stock > 0);
      if (!live.length) return `${p.name} — out of stock at the moment.`;
      return `${p.name} — ${live.map((s) => `${s.label} (${s.stock > 5 ? 'in stock' : `only ${s.stock} left`})`).join(', ')}`;
    })
    .join('\n');
  return reply(lines, found, ['Which size is best value?', 'How much is delivery?']);
}

function priceQuery(text, tokens, shop) {
  if (!tokens.includes('price') && !hasAny(text, ['how much', 'cost', 'rate', 'cheapest', 'best value'])) {
    return UNSURE;
  }
  const found = findProducts(shop.products, tokens, 2);
  if (!found.length) {
    const cheapest = shop.products
      .map((p) => ({ p, s: fromPrice(p) }))
      .filter((x) => x.s)
      .sort((a, b) => a.s.price - b.s.price)
      .slice(0, 3);
    return reply(
      `Prices start at ${rupees(cheapest[0]?.s.price ?? 0)}. The most affordable are:\n${cheapest
        .map((x) => `${x.p.name} — ${x.s.label} ${rupees(x.s.price)}`)
        .join('\n')}`,
      cheapest.map((x) => x.p),
      ['Which size is best value?', 'How much is delivery?']
    );
  }
  const lines = found
    .map((p) => {
      const best = bestValue(p);
      const value = best
        ? ` Best value is the ${best.label} at ${rupees(Math.round(best.per100))} per 100 ${best.metric}.`
        : '';
      return `${p.name} — ${sizeLine(p)}.${value}`;
    })
    .join('\n');
  return reply(lines, found, ['Is it in stock?', 'How much is delivery?']);
}

function catalogue(text, tokens, shop) {
  if (!hasAny(text, ['what do you sell', 'what products', 'show me', 'bestseller', 'best seller', 'popular', 'catalogue', 'catalog', 'everything', 'list'])) {
    return UNSURE;
  }
  /* A category was named — show that shelf rather than the whole shop. */
  const cats = [...new Set(shop.products.map((p) => p.category))];
  const named = cats.find((c) => tokens.includes(normalise(c)) || tokens.includes(normalise(c).replace(/s$/, '')));
  const pool = named ? shop.products.filter((p) => p.category === named) : shop.products;

  const top = [...pool].sort((a, b) => (b.rating || 0) - (a.rating || 0)).slice(0, MAX_PRODUCTS);
  const heading = named
    ? `Our ${named}:`
    : `We make ${cats.join(', ')}. The ones people come back for:`;
  return reply(`${heading}\n${describeProducts(top)}`, top, [
    'Which size is best value?',
    'How much is delivery?',
  ]);
}

/* ==========================================================================
 * The entry point
 * ======================================================================== */

/**
 * Answer a customer's message.
 *
 * Returns the same shape the Gemini path returned — { reply, productIds,
 * suggestions } — so the widget and the route need no special handling.
 */
async function answer(message, history = [], user = null) {
  const text = normalise(message);
  const tokens = tokenise(message);
  const shop = await loadShop();

  /* Narrow intents first, product search last: most questions at a shop are
     about a thing it sells, so that is the right catch-all. */
  const chain = [
    () => greeting(text),
    () => thanks(text),
    () => orderStatus(text, user),
    () => shipping(text, shop),
    () => payment(text, shop),
    () => returns(text),
    () => offers(text, shop),
    () => festivals(text, shop),
    () => bulk(text),
    () => subscription(text),
    () => about(text),
    () => contact(text),
    () => reviewsInsight(text, tokens, shop),
    () => stock(text, tokens, shop),
    () => priceQuery(text, tokens, shop),
    () => byConcern(text, tokens, shop),
    () => catalogue(text, tokens, shop),
  ];

  for (const step of chain) {
    // eslint-disable-next-line no-await-in-loop
    const result = await step();
    if (result?.handled) return { ...result, source: 'shop-brain' };
  }

  /* Nothing matched an intent — try the catalogue directly. */
  const found = findProducts(shop.products, tokens, MAX_PRODUCTS);
  if (found.length) {
    return {
      ...reply(describeProducts(found), found, [
        'Which size is best value?',
        'Is it in stock?',
        'How much is delivery?',
      ]),
      source: 'shop-brain',
    };
  }

  /* Say so plainly and hand over to a person, rather than guessing. */
  return {
    reply:
      'I can help with our oils, soaps and powders — prices, sizes, stock, delivery, payment and your orders. I could not work out what you needed there. Try naming a product, or use "Chat with us" and a person will help.',
    productIds: [],
    suggestions: ['Which oil for hair?', 'What offers are running?', 'How much is delivery?'],
    source: 'shop-brain',
    unmatched: true,
  };
}

/** What the assistant can see right now — for the admin diagnostic page. */
async function health() {
  clearCache();
  const shop = await loadShop();
  return {
    products: shop.products.length,
    categories: [...new Set(shop.products.map((p) => p.category))],
    publicOffers: shop.coupons.filter((c) => c.active && !c.assignedToUserId).length,
    upcomingFestivals: shop.festivals.length,
    shippingConfigured: !!shop.shipping,
    paymentsConfigured: !!shop.payments,
  };
}

module.exports = { answer, health, clearCache, tokenise, findProducts, bestValue };
