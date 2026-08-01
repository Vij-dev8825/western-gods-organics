import { Link } from 'react-router-dom';
import SeoMeta from '../components/SeoMeta';

export default function Sourcing() {
  return (
    <div className="policy-page">
      <SeoMeta
        title="Our Sourcing — Where Our Oils Come From | Western Gods Organics"
        description="How Shri Gopal Flour & Oil Mills sources raw material from farmers across Tamil Nadu, and presses it the traditional way."
        path="/sourcing"
      />
      <div className="breadcrumb">Home / Our Sourcing</div>
      <span className="eyebrow">Where It Comes From</span>
      <h1>Directly From Farmers, Pressed the Traditional Way</h1>
      <p className="muted" style={{ maxWidth: 640 }}>
        We're a small family mill in Udumalpet, Tamil Nadu, running for over 60 years. Every batch starts
        with raw material bought directly from farmers in the region — not a middleman-supplied commodity
        blend — and is pressed the same wood-press (kachi ghani) way it always has been.
      </p>

      <h2>Where our raw material comes from</h2>
      <ul>
        <li>
          <b>Groundnut</b> — from the red-soil groundnut belts of western Tamil Nadu, close to our own mill
          in Tiruppur District.
        </li>
        <li>
          <b>Coconut</b> — farm-fresh copra sourced from coconut-growing regions along Tamil Nadu's
          coastal belt.
        </li>
        <li>
          <b>Sesame (til)</b> and <b>castor</b> — bought in season directly from regional growers, rather
          than held in long-term bulk storage.
        </li>
      </ul>

      <h2>Why this matters</h2>
      <p>
        Buying close to source means we know roughly where a batch's raw material came from, and we press
        it soon after — not after months in a warehouse. It's also why supply can vary a little by season,
        and why we press in small weekly batches instead of one large continuous run.
      </p>

      <h2>Trace it yourself</h2>
      <p>
        Every bottle and pack carries a batch number. Scan or enter it on our{' '}
        <Link to="/shop">product pages</Link> to see when it was pressed, its FSSAI license, and (where
        available) a lab report — see any of our product pages for that batch's own passport.
      </p>

      <p style={{ marginTop: 24 }}>
        <Link to="/shop" className="btn btn-gold">Browse our oils</Link>
      </p>
    </div>
  );
}
