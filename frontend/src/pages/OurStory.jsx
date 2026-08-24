/**
 * "People buy from people" — the Zero Rupee Marketing notes make this
 * point about founder-story content, and it's a real gap here: /sourcing
 * covers where the raw material comes from, but nothing on the site talks
 * about the mill itself or shows real customers saying something about it.
 *
 * Every fact below is already published elsewhere on this site (Sourcing,
 * the store locator) — this page doesn't add any new claim about the
 * business, it just puts the existing ones somewhere built to be shared,
 * with real reviews alongside rather than invented testimonials.
 */
import { Link } from 'react-router-dom';
import SeoMeta from '../components/SeoMeta';
import CustomerReviews from '../components/CustomerReviews';

export default function OurStory() {
  return (
    <div className="policy-page">
      <SeoMeta
        title="Our Story — Western Gods Organics"
        description="A family mill in Udumalpet, Tamil Nadu, running for over 60 years — and what customers say about what comes out of it."
        path="/our-story"
      />
      <div className="breadcrumb">Home / Our Story</div>
      <span className="eyebrow">Who we are</span>
      <h1>A Mill, Not a Brand</h1>
      <p className="muted" style={{ maxWidth: 640 }}>
        Shri Gopal Flour & Oil Mills has been running in Udumalpet, Tamil Nadu, for over 60
        years — a family mill first, with a website second. Everything sold here still comes
        out of that same mill.
      </p>

      <h2>What hasn't changed</h2>
      <p>
        The wooden ghani (kachi ghani) still runs the way it always has — slow, at low
        temperature, with nothing pressed through a solvent. We're open about it: visit the
        Udumalpet mill and you can watch your oil actually being pressed, not just read a claim
        that it was.
      </p>
      <p>
        That same openness is why every bottle carries a batch code you can look up yourself —
        production date, which grower it came from, lab reports, all of it — rather than asking
        you to take "traditional" and "traceable" on faith.
      </p>
      <p style={{ marginTop: -6 }}>
        <Link to="/sourcing">Where our raw material actually comes from →</Link>
      </p>

      <h2>Two places, one mill</h2>
      <p>
        The mill itself is in Udumalpet — come and watch the ghani run. There's also a shop in
        Vedapatti, Coimbatore, for oils, soaps, herbal powders and bulk orders if Udumalpet isn't
        on your way.
      </p>
      <p style={{ marginTop: -6 }}>
        <Link to="/store-locator">Find both locations →</Link>
      </p>

      <h2>What customers say</h2>
      <p className="muted" style={{ fontSize: '0.9rem', marginBottom: 20 }}>
        Pulled directly from real reviews left on the products themselves — nothing here is
        written for this page.
      </p>
      <CustomerReviews limit={9} />

      <div style={{ textAlign: 'center', margin: '40px 0 20px' }}>
        <Link to="/shop" className="btn btn-gold">Shop the mill's oils</Link>
      </div>
    </div>
  );
}
