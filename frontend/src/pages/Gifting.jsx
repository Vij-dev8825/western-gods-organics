import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import ProductCard from '../components/ProductCard';
import ChakkiWheel from '../components/ChakkiWheel';
import PageBanner from '../components/PageBanner';
import SeoMeta from '../components/SeoMeta';

const REASONS = [
  { icon: '🎁', title: 'Ready-made hampers', text: 'Curated kits of our oils, soaps and powders, ready to send as they are.' },
  { icon: '🏢', title: 'Corporate bulk orders', text: 'Volume pricing, GST invoicing and private labelling for employee or client gifting.' },
  { icon: '💌', title: 'A personal touch', text: "Add a free gift message at checkout — we keep the price off the packing slip." },
];

export default function Gifting() {
  const [hampers, setHampers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getProducts({ combo: true }).then((d) => setHampers(d.products)).finally(() => setLoading(false));
  }, []);

  return (
    <div className="section" style={{ paddingTop: 0 }}>
      <SeoMeta
        title="Corporate & Festival Gifting | Western Gods Organics"
        description="Curated gift hampers, corporate bulk orders with private labelling, and personal gift messages — cold-pressed oils, soaps and powders for festivals, weddings and employee gifting."
        path="/gifting"
      />
      <PageBanner
        page="gifting"
        title="Corporate & Festival Gifting"
        subtitle="Thoughtful, natural gifting for festivals, weddings and your team — from a single hamper to a few hundred."
      />

      <section className="usp-strip">
        <div className="container usp-grid">
          {REASONS.map((r) => (
            <div className="usp" key={r.title}>
              <span className="usp-icon" aria-hidden="true">{r.icon}</span>
              <div>
                <h3>{r.title}</h3>
                <p>{r.text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="container" style={{ marginTop: 32 }}>
        <div className="breadcrumb">Home / Corporate & Festival Gifting</div>

        <h2>Ready-made gift hampers</h2>
        <p className="muted" style={{ maxWidth: 640, marginBottom: 20 }}>
          Curated combos of our cold-pressed oils, handmade soaps and herbal powders — order one for
          yourself, or a few hundred for your team.
        </p>

        {loading ? (
          <div className="center" style={{ padding: '60px 0' }}>
            <ChakkiWheel size={50} />
          </div>
        ) : hampers.length ? (
          <div className="grid">
            {hampers.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        ) : (
          <p className="muted">No hampers listed right now — get in touch and we'll help you put one together.</p>
        )}

        <div className="form-card" style={{ margin: '48px 0 0' }}>
          <h2 style={{ marginTop: 0 }}>Ordering for a company or a festival in bulk?</h2>
          <p className="muted" style={{ maxWidth: 640 }}>
            We supply festival and corporate gifting in volume — mixed hampers, custom quantities, GST
            invoicing, and private labelling on request. Tell us what you need and we'll quote you directly.
          </p>
          <Link to="/bulk-enquiry" className="btn btn-gold">Get a bulk gifting quote</Link>
        </div>

        <div className="form-card" style={{ margin: '20px 0 0' }}>
          <h2 style={{ marginTop: 0 }}>Not sure what they'd like?</h2>
          <p className="muted" style={{ maxWidth: 640, marginBottom: 14 }}>
            Send a Western Gods Organics Gift Card instead — they pick exactly what they want.
          </p>
          <Link to="/gift-cards" className="btn btn-outline">Send a gift card</Link>
        </div>
      </div>
    </div>
  );
}
