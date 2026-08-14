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
 *   node scripts/create-newborn-set.js            # show what it would do
 *   node scripts/create-newborn-set.js --write    # actually do it
 *   node scripts/create-newborn-set.js --write --save 10   # 10% off the parts
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const db = require('../data/db');

const KIT_ID = 'newborn-care-set';
const DEFAULT_SAVING_PERCENT = 8;

// Matched on the words a mill actually uses, not on an id we'd have to be told.
// Each entry needs one unambiguous match or the script stops — silently
// picking the wrong oil for a baby's kit is not a thing to be relaxed about.
const WANTED = [
  { key: 'castor', match: /castor/i, why: 'For the oil bath — the cooling one, and the one most households use on a baby.' },
  { key: 'coconut', match: /coconut/i, why: 'Lighter, for everyday use on skin and scalp.' },
  { key: 'soap', match: /hibiscus/i, why: 'A mild bar for washing the oil off, made with hibiscus.' },
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

  const chosen = [];
  for (const want of WANTED) {
    const matches = products.filter((p) => want.match.test(p.name) && p.id !== KIT_ID);
    if (matches.length === 0) {
      console.error(`No product matching /${want.match.source}/ — nothing to put in the kit for "${want.key}".`);
      console.error('Add it to the catalogue first, or edit WANTED in this script to match what you call it.');
      process.exit(1);
    }
    if (matches.length > 1) {
      console.error(`${matches.length} products match /${want.match.source}/:`);
      matches.forEach((m) => console.error(`   - ${m.name}`));
      console.error('Too ambiguous to choose for you. Narrow the pattern in WANTED and run again.');
      process.exit(1);
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
