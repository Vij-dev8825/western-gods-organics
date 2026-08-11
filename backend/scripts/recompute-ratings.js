/**
 * Recomputes every product's rating and review count from the reviews that
 * actually exist.
 *
 * routes/products.js already does this whenever a review is submitted, so the
 * numbers stay honest from here on. What it never did was correct the values
 * products were *seeded* with — several carried a rating and a review count
 * with no reviews behind them, which the storefront then displayed, and which
 * ProductDetail published to Google as aggregateRating. This is the one-time
 * pass that reconciles them.
 *
 * Safe to run repeatedly: it derives, it doesn't accumulate. Prints the before
 * and after for every product it changes so there's a record of what the
 * seeded values were, in case you want them back.
 *
 *   cd ~/westerngodsorganic/backend && node scripts/recompute-ratings.js
 *
 * Add --dry-run to see what it would change without writing anything.
 */
require('dotenv').config();
const db = require('../data/db');

const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
  const [products, reviews] = await Promise.all([db.list('products'), db.list('reviews')]);

  const byProduct = new Map();
  for (const r of reviews) {
    if (!byProduct.has(r.productId)) byProduct.set(r.productId, []);
    byProduct.get(r.productId).push(r);
  }

  const changed = [];
  for (const product of products) {
    const mine = byProduct.get(product.id) || [];
    const reviewsCount = mine.length;
    const rating = reviewsCount
      ? Math.round((mine.reduce((sum, r) => sum + r.rating, 0) / reviewsCount) * 10) / 10
      : 0;

    if (product.rating === rating && product.reviewsCount === reviewsCount) continue;

    changed.push({
      id: product.id,
      name: product.name,
      was: `${product.rating ?? 0}★ / ${product.reviewsCount ?? 0}`,
      now: `${rating}★ / ${reviewsCount}`,
    });
    if (!DRY_RUN) await db.put('products', { ...product, rating, reviewsCount });
  }

  console.log(`${products.length} products, ${reviews.length} real reviews.`);
  if (!changed.length) {
    console.log('Everything already matches — nothing to change.');
    return;
  }
  console.log(`${DRY_RUN ? 'Would correct' : 'Corrected'} ${changed.length}:\n`);
  for (const c of changed) {
    console.log(`  ${c.name.padEnd(36)} ${c.was.padStart(12)}  ->  ${c.now}`);
  }
  if (DRY_RUN) console.log('\n(dry run — nothing was written)');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Failed:', err.message);
    process.exit(1);
  });
