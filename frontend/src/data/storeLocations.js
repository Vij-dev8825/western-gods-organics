// Single source of truth for physical location(s) — shared by Footer's map
// accordion and the /store-locator page. Add more entries here as/when
// additional retail outlets open; both consumers already render a list.
export const STORE_LOCATIONS = [
  {
    id: 'udumalpet-mill',
    name: 'Shri Gopal Flour & Oil Mills — Udumalpet',
    // Kept word-for-word in step with the Google Business Profile listing.
    // Google cross-checks a business's name, address and phone across the web
    // and treats a mismatch as a reason to trust the listing less, so these
    // two must be edited together or not at all.
    address: 'SH 97, Udumalpet, Tiruppur District, Tamil Nadu – 642126',
    locality: 'Udumalpet',
    region: 'Tamil Nadu',
    postalCode: '642126',
    phone: '+918825875607',
    phoneDisplay: '+91 88258 75607',
    hours: 'Mon–Sat, 9am–7pm',
    blurb: 'Our family mill, where the wooden ghani runs. Come and watch your oil being pressed.',
  },
  {
    id: 'vedapatti-shop',
    name: 'Western Gods Organics — Vedapatti',
    address: 'Vedapatti, Coimbatore, Tamil Nadu',
    locality: 'Vedapatti, Coimbatore',
    region: 'Tamil Nadu',
    postalCode: '',
    phone: '+918825875607',
    phoneDisplay: '+91 88258 75607',
    hours: 'Mon–Sat, 9am–7pm',
    blurb: 'Our Coimbatore counter for oils, soaps, herbal powders and bulk orders.',
  },
];

/** Where we send to, stated plainly — it's what a first-time buyer and a bulk
 * enquirer both want to know, and it's what a search for "cold pressed oil
 * delivery" is actually asking. */
export const DELIVERY_REACH = {
  domestic: 'Courier and parcel service to every state in India.',
  international: 'We ship abroad too — see checkout for countries and rates.',
  trade: 'Retail and bulk/wholesale both available from either shop.',
};

export function mapEmbedSrc(address) {
  return `https://maps.google.com/maps?q=${encodeURIComponent(address)}&z=14&output=embed`;
}

export function directionsUrl(address) {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
}
