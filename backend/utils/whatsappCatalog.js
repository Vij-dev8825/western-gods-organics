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

const GOOGLE_CATEGORY = {
  oils: 'Food, Beverages & Tobacco > Food Items > Cooking & Baking Ingredients > Cooking Oils & Sprays',
  soaps: 'Health & Beauty > Personal Care > Cosmetics > Bath & Body > Soaps',
  powders: 'Health & Beauty > Personal Care',
  'spices-masalas': 'Food, Beverages & Tobacco > Food Items > Herbs & Spices',
  honey: 'Food, Beverages & Tobacco > Food Items > Sweeteners > Honey',
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
