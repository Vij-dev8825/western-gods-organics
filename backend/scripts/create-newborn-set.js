/**
 * Creates the newborn care set — castor oil, coconut oil and hibiscus soap —
 * as a kit in the catalogue.
 *
 * A script rather than a migration because it has to read the shop's real
 * products and real prices: the components differ per shop, the sizes differ,
 * and a hard-coded price would be wrong the first time anything is repriced.
 *
 * Dry-run by default. This writes to the live catalogue, so it shows exactly
 * what it matched and what it would charge, and does nothing until told
 * --write. Re-running is safe: it updates the existing kit rather than
 * creating a second one.
 *
 *   node scripts/create-newborn-set.js                     # show what it would do
 *   node scripts/create-newborn-set.js --write             # actually do it
 *   node scripts/create-newborn-set.js --save 10           # 10% off the parts
 *   node scripts/create-newborn-set.js --soap turmeric     # pick a different soap
 *
 * Each component can be re-pointed with --castor / --coconut / --soap, so a
 * shop that renames a product, or makes a new one, never needs this file
 * edited. Patterns are matched case-insensitively against the product name.
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const db = require('../data/db');

const KIT_ID = 'newborn-care-set';
const DEFAULT_SAVING_PERCENT = 8;

/** Read a --flag value from the command line. */
function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--')
    ? process.argv[i + 1]
    : fallback;
}

// Matched on the words a mill actually uses, not on an id we'd have to be told.
// Each entry needs one unambiguous match or the script stops — silently
// picking the wrong oil for a baby's kit is not a thing to be relaxed about.
//
// There is no default soap. Which bar belongs in a kit for a newborn is a
// judgement about the shop's own products, and it is not one a script should
// make on the owner's behalf; run with --soap and name it.
const WANTED = [
  { key: 'castor', pattern: arg('castor', 'castor'), category: 'oils' },
  { key: 'coconut', pattern: arg('coconut', 'coconut'), category: 'oils' },
  { key: 'soap', pattern: arg('soap', null), category: 'soaps' },
];

const rupees = (n) => `Rs. ${Math.round(n).toLocaleString('en-IN')}`;

/** The smallest size of a product — a starter kit should be the small ones. */
function smallestSize(product) {
  const sizes = (product.sizes || []).filter((s) => Number(s.price) > 0);
  if (!sizes.length) return null;
  // No reliable way to compare "500 ml" with "100 g", so cheapest stands in
  // for smallest. For a three-item kit that is the same answer.
  return sizes.reduce((min, s) => (Number(s.price) < Number(min.price) ? s : min));
}

(async () => {
  const write = process.argv.includes('--write');
  const savingArg = process.argv.indexOf('--save');
  const savingPercent = savingArg > -1 ? Number(process.argv[savingArg + 1]) : DEFAULT_SAVING_PERCENT;
  if (!Number.isFinite(savingPercent) || savingPercent < 0 || savingPercent > 60) {
    console.error('--save must be a percentage between 0 and 60.');
    process.exit(1);
  }

  // Without this the module stays in its default JSON mode and would read seed
  // files while reporting confidently about the live database.
  await db.init();
  const products = await db.list('products');
  console.log(`Catalogue: ${products.length} products\n`);

  /** What the shop has in this slot's usual category — printed whenever a
   *  pattern matches nothing or too much, so the next run can be right
   *  without anyone going and looking the names up. */
  const candidates = (want) => {
    const list = products.filter((p) => p.category === want.category && p.id !== KIT_ID);
    if (!list.length) return `   (nothing in the "${want.category}" category)`;
    return list.map((p) => `   - ${p.name}`).join('\n');
  };

  const chosen = [];
  for (const want of WANTED) {
    if (!want.pattern) {
      console.error(`No --${want.key} given, and there is no default for it.`);
      console.error(`Your ${want.category}:\n${candidates(want)}`);
      console.error(`\nPick one and run again, e.g.  --${want.key} "turmeric"`);
      process.exit(1);
    }
    const rx = new RegExp(want.pattern, 'i');
    const usable = products.filter((p) => p.id !== KIT_ID);

    // The slot's own category first. A kit needs a soap, so "turmeric" should
    // find the soap and not collide with the turmeric powder three shelves
    // over — the word is only ambiguous if you ignore what is being asked for.
    const inCategory = usable.filter((p) => p.category === want.category && rx.test(p.name));
    // Widened only when the category has nothing, so a product filed oddly is
    // still findable rather than invisible. Called out when it happens: a soap
    // that isn't in "soaps" is worth knowing about.
    const elsewhere = usable.filter((p) => p.category !== want.category && rx.test(p.name));
    const matches = inCategory.length ? inCategory : elsewhere;
    const widened = !inCategory.length && elsewhere.length > 0;

    if (matches.length === 0) {
      console.error(`Nothing matches "${want.pattern}" for the ${want.key}.`);
      console.error(`Your ${want.category}:\n${candidates(want)}`);
      console.error(`\nRun again with --${want.key} and something from that list.`);
      process.exit(1);
    }
    if (matches.length > 1) {
      console.error(`"${want.pattern}" matches ${matches.length} of your ${want.category}:`);
      matches.forEach((m) => console.error(`   - ${m.name}`));
      console.error(`\nToo ambiguous to choose for you. Give --${want.key} more of the name.`);
      process.exit(1);
    }
    if (widened) {
      console.log(`Note: "${matches[0].name}" is filed under "${matches[0].category}", not "${want.category}" — using it anyway.`);
    }
    const product = matches[0];
    const size = smallestSize(product);
    if (!size) {
      console.error(`"${product.name}" has no priced size — cannot put it in a kit.`);
      process.exit(1);
    }
    chosen.push({ ...want, product, size });
  }

  const partsTotal = chosen.reduce((sum, c) => sum + Number(c.size.price), 0);
  const price = Math.round(partsTotal * (1 - savingPercent / 100));
  const mrp = chosen.reduce((sum, c) => sum + Number(c.size.mrp || c.size.price), 0);

  console.log('The kit would contain:');
  for (const c of chosen) {
    console.log(`  ${c.product.name} (${c.size.label})`.padEnd(52) + rupees(c.size.price));
  }
  console.log(`  ${'—'.repeat(50)}`);
  console.log(`  ${'Bought separately'.padEnd(50)}${rupees(partsTotal)}`);
  console.log(`  ${`As a set (${savingPercent}% off)`.padEnd(50)}${rupees(price)}`);
  console.log(`  ${'They save'.padEnd(50)}${rupees(partsTotal - price)}\n`);

  const existing = await db.get('products', KIT_ID);

  const kit = {
    ...(existing || {}),
    id: KIT_ID,
    name: 'Newborn Care Set',
    category: 'baby-kids-care',
    shortDescription: 'Castor oil, coconut oil and a hibiscus soap — the three things a Tamil household reaches for first.',
    description: [
      'The oil bath is usually the first thing a new grandmother teaches a new mother, and it is almost always these three: castor to cool, coconut for everyday, and a mild bar to wash it off with.',
      '',
      'Everything here is cold-pressed at our own mill in Udumalpet, in small batches, and every bottle carries the date it was pressed. Nothing is scented, coloured or thinned.',
      '',
      'Because it is for a baby: try a little on the inside of the forearm a day before you use it properly, and ask your paediatrician if your child has any skin condition or is very premature. We make oil — we are not qualified to tell you how to care for your child, and we would rather say so than pretend otherwise.',
    ].join('\n'),
    // Free text — this is what puts it in the kits listing.
    comboItems: chosen.map((c) => `${c.product.name} (${c.size.label})`),
    // Structured — each component's own page links back to this kit.
    comboProductIds: chosen.map((c) => c.product.id),
    image: chosen[0].product.image || '',
    images: chosen.map((c) => c.product.image).filter(Boolean),
    sizes: [{
      label: 'Set of 3',
      price,
      mrp: Math.max(mrp, price),
      stock: Math.min(...chosen.map((c) => Number(c.size.stock) || 0)),
      costPrice: chosen.every((c) => Number.isFinite(Number(c.size.costPrice)))
        ? chosen.reduce((sum, c) => sum + Number(c.size.costPrice), 0)
        : null,
      wholesalePrice: null,
      materialPerUnit: null,
    }],
    tags: ['baby', 'newborn', 'gift', 'oil bath'],
    isNew: true,
    rating: existing?.rating ?? 0,
    reviewsCount: existing?.reviewsCount ?? 0,
    createdAt: existing?.createdAt || new Date().toISOString(),
  };

  console.log(`Stock would be ${kit.sizes[0].stock} sets — the smallest component stock, since a set needs all three.`);
  if (kit.sizes[0].costPrice == null) {
    console.log('Cost: not set, because at least one component has no Cost recorded. Admin → Profit will leave this kit out until they all do.');
  } else {
    console.log(`Cost: ${rupees(kit.sizes[0].costPrice)} — the three component costs added up.`);
  }

  if (!write) {
    console.log(`\nDry run — nothing written. Re-run with --write to ${existing ? 'update' : 'create'} it.`);
    process.exit(0);
  }

  await db.put('products', kit);
  console.log(`\n${existing ? 'Updated' : 'Created'} "${kit.name}" at ${rupees(price)}.`);
  console.log('Check it in Admin → Products — the photo is the castor oil\'s; replace it with a picture of the three together.');
  process.exit(0);
})().catch((err) => {
  console.error('Failed:', err.message);
  process.exit(1);
});
