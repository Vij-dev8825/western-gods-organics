/**
 * Builds a Meta Commerce Manager-compatible product feed (CSV) from the live
 * product catalog. Meta's catalog format is what both Facebook Shop and a
 * linked WhatsApp Business catalog read from — see:
 * https://www.facebook.com/business/help/120325381656392 (feed spec)
 *
 * One row per size/variant, since each is sold at its own price and Meta's
 * feed has no native concept of a product's size variants.
 */
const db = require('../data/db');
const { resolveImageLink, isPlaceholderIllustration } = require('./catalogImages');

const BRAND = 'Western Gods Organics';

/**
 * Site category → Google product taxonomy, as numeric ids.
 *
 * Ids rather than full paths on purpose. Google accepts either, but a path has
 * to match its taxonomy character for character or the value is discarded
 * silently — and three of the paths previously written here (Cooking Oils &
 * Sprays, a top-level Herbs & Spices, Sweeteners > Honey) were near-misses
 * that don't exist, so most of the catalogue was being sent with a category
 * Google threw away. An id can't drift like that.
 *
 * Verified against taxonomy-with-ids.en-US.txt. Path kept alongside each id
 * for reading, not for sending.
 *
 * Meta reads the same field and also accepts ids, so both feeds benefit.
 */
const GOOGLE_CATEGORY = {
  // Food, Beverages & Tobacco > Food Items > Cooking & Baking Ingredients > Cooking Oils
  oils: '2126',
  // Health & Beauty > Personal Care > Cosmetics > Bath & Body > Bar Soap
  soaps: '2503',
  // Health & Beauty > Personal Care — deliberately the broad one: these are
  // sold as both a culinary and a hair/skin ingredient, and picking a narrower
  // leaf would be a claim about the product the shop hasn't made.
  powders: '2915',
  // Food, Beverages & Tobacco > Food Items > Seasonings & Spices > Herbs & Spices
  'spices-masalas': '1529',
  // Food, Beverages & Tobacco > Food Items > Condiments & Sauces > Honey
  honey: '4947',
  // Food, Beverages & Tobacco > Food Items > Cooking & Baking Ingredients > Sugar & Sweeteners
  'natural-sweeteners': '503734',
  // Food, Beverages & Tobacco > Food Items > Soups & Broths.
  // Two slugs for one shelf: the category list registers 'soup-dip' while the
  // soup mix itself is filed under 'soup-mix'. Both are mapped rather than one
  // picked, because guessing which is canonical would silently drop whichever
  // products sit under the other.
  'soup-dip': '2423',
  'soup-mix': '2423',
  // Health & Beauty > Personal Care > Cosmetics > Skin Care
  'baby-kids-care': '567',
};

const CSV_COLUMNS = [
  'id',
  'title',
  'description',
  'availability',
  'condition',
  'price',
  'sale_price',
  'link',
  'image_link',
  'brand',
  'google_product_category',
  'quantity_to_sell_on_facebook',
];

function slugify(label) {
  return String(label)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function csvEscape(value) {
  const str = value === undefined || value === null ? '' : String(value);
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

/**
 * @param {{siteUrl: string}} opts
 * @returns {Promise<{rows: object[], warnings: string[]}>}
 */
async function buildCatalogRows({ siteUrl }) {
  const products = await db.list('products');
  const rows = [];
  const warnings = [];

  for (const product of products) {
    const imageLink = resolveImageLink(product.image, siteUrl);
    if (!imageLink) {
      warnings.push(`Skipped "${product.name}" (${product.id}): no known image mapping for "${product.image}".`);
      continue;
    }
    if (isPlaceholderIllustration(product.image)) {
      warnings.push(
        `"${product.name}" uses a placeholder illustration, not a real photo — replace the file in backend/public/catalog-images before this goes live in the catalog.`
      );
    }

    for (const size of product.sizes || []) {
      const hasDiscount = size.mrp && size.mrp > size.price;
      rows.push({
        id: `${product.id}--${slugify(size.label)}`,
        title: `${product.name} — ${size.label}`,
        description: product.shortDescription || product.description || product.name,
        availability: size.stock > 0 ? 'in stock' : 'out of stock',
        condition: 'new',
        price: `${(hasDiscount ? size.mrp : size.price).toFixed(2)} INR`,
        sale_price: hasDiscount ? `${size.price.toFixed(2)} INR` : '',
        link: `${siteUrl}/product/${product.id}`,
        image_link: imageLink,
        brand: BRAND,
        google_product_category: GOOGLE_CATEGORY[product.category] || '',
        quantity_to_sell_on_facebook: Math.max(0, Math.min(size.stock ?? 0, 999)),
        // Not in CSV_COLUMNS, so this never reaches the Meta CSV — rowsToCsv
        // only emits the listed columns. It exists for the Google feed
        // (utils/googleFeed.js), which uses it to group a product's sizes into
        // one Shopping listing. Derived here rather than there so both feeds
        // keep reading the same single description of a product.
        item_group_id: product.id,
      });
    }
  }

  return { rows, warnings };
}

function rowsToCsv(rows) {
  const header = CSV_COLUMNS.join(',');
  const lines = rows.map((row) => CSV_COLUMNS.map((col) => csvEscape(row[col])).join(','));
  return [header, ...lines].join('\n') + '\n';
}

module.exports = { buildCatalogRows, rowsToCsv, slugify };
