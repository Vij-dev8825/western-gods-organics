import PageBanner from '../components/PageBanner';
import SeoMeta from '../components/SeoMeta';
import StructuredData from '../components/StructuredData';
import { STORE_LOCATIONS, DELIVERY_REACH, mapEmbedSrc, directionsUrl } from '../data/storeLocations';

// One LocalBusiness entry per shop. This is what Google reads to decide
// whether a real business exists at an address — it's the difference between
// being a website that mentions Udumalpet and being a shop in Udumalpet that
// can surface for "oil mill near me".
const STORES_SCHEMA = {
  '@context': 'https://schema.org',
  '@graph': STORE_LOCATIONS.map((loc) => ({
    '@type': 'Store',
    '@id': `https://www.westerngodsorganic.com/store-locator#${loc.id}`,
    name: loc.name,
    description: loc.blurb,
    telephone: loc.phone,
    url: 'https://www.westerngodsorganic.com/store-locator',
    address: {
      '@type': 'PostalAddress',
      streetAddress: loc.address,
      addressLocality: loc.locality,
      addressRegion: loc.region,
      ...(loc.postalCode ? { postalCode: loc.postalCode } : {}),
      addressCountry: 'IN',
    },
    openingHours: 'Mo-Sa 09:00-19:00',
    currenciesAccepted: 'INR',
    areaServed: [{ '@type': 'Country', name: 'India' }],
  })),
};

export default function StoreLocator() {
  return (
    <div className="section" style={{ paddingTop: 0 }}>
      <SeoMeta
        title="Our Shops in Udumalpet & Vedapatti, Coimbatore | Western Gods Organics"
        description="Visit our wood-pressing mill in Udumalpet or our Vedapatti shop in Coimbatore for cold-pressed oils, herbal soaps and powders. Retail and bulk. Courier across India and abroad."
        path="/store-locator"
      />
      <StructuredData id="ld-stores" data={STORES_SCHEMA} />
      <PageBanner
        page="store-locator"
        title="Visit Us"
        subtitle="Come see where your oils are pressed, straight from the source."
      />
      <div className="container">
        <div className="breadcrumb">Home / Visit Us</div>

        <div className="store-locations">
          {STORE_LOCATIONS.map((loc) => (
            <div className="store-card" key={loc.id}>
              <div className="store-card-map">
                <iframe
                  title={loc.name}
                  src={mapEmbedSrc(loc.address)}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>
              <div className="store-card-body">
                <h3>{loc.name}</h3>
                {loc.blurb && <p className="muted">{loc.blurb}</p>}
                <p className="muted">{loc.address}</p>
                {loc.hours && <p className="muted">🕒 {loc.hours}</p>}
                <a href={`tel:${loc.phone}`} className="footer-service-row" style={{ padding: 0 }}>
                  <span aria-hidden="true">📞</span> {loc.phoneDisplay || loc.phone}
                </a>
                <a
                  href={directionsUrl(loc.address)}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-forest btn-sm"
                  style={{ marginTop: 16 }}
                >
                  Get Directions
                </a>
              </div>
            </div>
          ))}
        </div>

        {/* Plain answers to the two questions every new customer and every
            bulk enquirer asks before they buy. Also the words people type. */}
        <div className="form-card" style={{ marginTop: 26 }}>
          <h2 style={{ marginTop: 0 }}>Can't come to the shop?</h2>
          <ul className="muted" style={{ lineHeight: 1.9, marginBottom: 0 }}>
            <li>📦 {DELIVERY_REACH.domestic}</li>
            <li>✈️ {DELIVERY_REACH.international}</li>
            <li>🧾 {DELIVERY_REACH.trade}</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
