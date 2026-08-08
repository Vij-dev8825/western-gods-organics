const db = require('../data/db');

// Matches what the invoice page previously hard-coded, so nothing on a
// printed invoice changes until an admin actually edits these.
// documentTitle is a tax classification, not styling: "Bill of Supply" is
// correct only when no GST is charged on the sale; a GST-registered seller
// charging tax must issue a "Tax Invoice".
const DEFAULTS = {
  businessName: 'Western Gods Organics',
  legalName: 'Shri Gopal Flour & Oil Mills — Udumalpet',
  address: 'SH 97, Udumalpet, Tiruppur District, Tamil Nadu – 642126',
  phone: '+91 88258 75607',
  email: 'westerngodsorganic@gmail.com',
  gstin: '',
  fssai: '',
  documentTitle: 'BILL OF SUPPLY',
  signatureImage: '',
  signatoryName: 'Authorised Signatory',
  dueDays: 7,
  terms: [
    'Goods once sold will not be taken back or exchanged, except for damaged or incorrect items reported within 7 days of delivery.',
    'All disputes are subject to Udumalpet, Tamil Nadu jurisdiction only.',
  ],
};

async function getInvoiceSettings() {
  const stored = await db.get('invoice-settings', 'main');
  const merged = { ...DEFAULTS, ...stored };
  // A stored record that predates a field, or was saved with terms cleared,
  // must not blank the section out entirely on every printed invoice.
  if (!Array.isArray(merged.terms) || merged.terms.length === 0) merged.terms = DEFAULTS.terms;
  return merged;
}

module.exports = { getInvoiceSettings, DEFAULTS };
