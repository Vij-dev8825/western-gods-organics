/**
 * Builds a Google Merchant Center product feed (RSS 2.0 with the g: namespace)
 * from the live catalog — see https://support.google.com/merchants/answer/7052112
 *
 * Merchant Center is how a product gets into Google Shopping. Free listings
 * are what matter here: they cost nothing, and they put a product with its
 * price and photo into Shopping results without an ad budget. The same feed is
 * what a paid Shopping campaign would later read from, so setting it up now
 * costs one URL and rules nothing out.
 *
 * Deliberately reuses buildCatalogRows from whatsappCatalog.js rather than
 * re-deriving prices and availability. Meta and Google's feed specs overlap
 * almost exactly on the fields we populate, and two independent copies of
 * "what is this product's price right now" is how the two feeds end up
 * disagreeing with each other and with the site.
 */
const { buildCatalogRows } = require('./whatsappCatalog');

const FEED_TITLE = 'Western Gods Organics';
const FEED_DESCRIPTION = 'Cold-pressed oils, herbal soaps and herbal powders from our own mill.';

/** XML has five reserved characters and no tolerance for any of them appearing
 * raw in text. Product descriptions are admin-authored free text, so an
 * ampersand in "Neem & Tulsi" would otherwise make the whole feed unparseable
 * and Merchant Center would reject every item in it, not just that one. */
function xmlEscape(value) {
  return String(value === undefined || value === null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function tag(name, value) {
  if (value === undefined || value === null || value === '') return '';
  return `      <g:${name}>${xmlEscape(value)}</g:${name}>\n`;
}

function itemXml(row) {
  return (
    '    <item>\n' +
    tag('id', row.id) +
    tag('title', row.title) +
    tag('description', row.description) +
    tag('link', row.link) +
    tag('image_link', row.image_link) +
    tag('availability', row.availability) +
    tag('price', row.price) +
    tag('sale_price', row.sale_price) +
    tag('brand', row.brand) +
    tag('condition', row.condition) +
    tag('google_product_category', row.google_product_category) +
    // Groups every size of one product together, so Shopping shows a single
    // product with size options rather than four unrelated-looking listings
    // competing with each other.
    tag('item_group_id', row.item_group_id) +
    // These are own-brand goods with no retail barcode. Google requires a
    // GTIN or MPN unless you say explicitly that neither exists — omitting
    // this is the single most common reason a small brand's feed gets
    // every item disapproved.
    tag('identifier_exists', 'no') +
    '    </item>\n'
  );
}

/**
 * @param {{siteUrl: string}} opts
 * @returns {Promise<{xml: string, count: number, warnings: string[]}>}
 */
async function buildGoogleFeed({ siteUrl }) {
  const { rows, warnings } = await buildCatalogRows({ siteUrl });

  const xml =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">\n' +
    '  <channel>\n' +
    `    <title>${xmlEscape(FEED_TITLE)}</title>\n` +
    `    <link>${xmlEscape(siteUrl)}</link>\n` +
    `    <description>${xmlEscape(FEED_DESCRIPTION)}</description>\n` +
    rows.map(itemXml).join('') +
    '  </channel>\n' +
    '</rss>\n';

  return { xml, count: rows.length, warnings };
}

module.exports = { buildGoogleFeed, xmlEscape };
