import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { getProductImage } from '../utils/productImages';
import ChakkiWheel from '../components/ChakkiWheel';
import SeoMeta from '../components/SeoMeta';

const formatDate = (d) =>
  new Date(d).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'long' });

/** "in 3 days" reads as a plan; "12 August" reads as a date to look up. Both
 *  are on the card, but this is the one that tells you whether to act. */
function relativeDays(iso) {
  const days = Math.round((new Date(iso).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 86400000);
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days > 1) return `in ${days} days`;
  if (days === -1) return 'yesterday';
  return `${Math.abs(days)} days ago`;
}

function Run({ p, past }) {
  return (
    <li className={`pressing-run ${past ? 'is-past' : ''}`}>
      <img src={getProductImage(p.productImage)} alt="" className="pressing-run-img" />
      <div className="pressing-run-body">
        <div className="pressing-run-when">
          <b>{formatDate(p.pressDate)}</b>
          <span className="muted">{relativeDays(p.pressDate)}</span>
        </div>
        <Link to={`/product/${p.productId}`} className="pressing-run-name">
          {p.productName} <span className="muted">· {p.size}</span>
        </Link>
        {p.note && <p className="pressing-run-note">{p.note}</p>}
        {past && p.batchNumber && (
          <Link to={`/batch/${p.batchNumber}`} className="pressing-run-batch">
            Batch {p.batchNumber} →
          </Link>
        )}
      </div>
      {!past && (
        <span className={`pressing-run-tag ${p.soldOut ? 'full' : ''}`}>
          {p.soldOut ? 'Fully reserved' : 'Open to reserve'}
        </span>
      )}
    </li>
  );
}

/**
 * The mill's schedule, in public — what is being pressed, and what just was.
 *
 * Everything else on the site describes oil that already exists. This is the
 * only page that says when it is made, which is what turns "fresh" from a word
 * on a label into something a customer can check. It reads the way a bakery
 * board does: today's, this week's, and what came out yesterday.
 *
 * Shows runs that are fully reserved rather than hiding them — a booked-out
 * run is the most persuasive thing here, and dropping it would make a busy
 * mill look like an idle one.
 */
export default function PressingCalendar() {
  const [data, setData] = useState(undefined);

  useEffect(() => {
    api.getPressingCalendar().then(setData).catch(() => setData(null));
  }, []);

  if (data === undefined) {
    return (
      <div className="center" style={{ padding: '120px 0' }}>
        <ChakkiWheel size={56} />
      </div>
    );
  }

  const upcoming = data?.upcoming || [];
  const recent = data?.recent || [];

  return (
    <div className="container section" style={{ maxWidth: 720 }}>
      <SeoMeta
        title="Pressing schedule — Western Gods Organics"
        description="When each oil goes under our wood press at the mill in Udumalpet, and which batches came off it recently."
        path="/pressings"
      />
      <div className="breadcrumb">Home / Pressing schedule</div>
      <span className="eyebrow">The mill</span>
      <h1>What we're pressing</h1>
      <p className="muted" style={{ maxWidth: '58ch' }}>
        Our oil is pressed in batches at the mill in Udumalpet, not drawn from a tank. This is the
        schedule — when each run goes under the wood press, and which ones have just come off it.
      </p>

      <h2 className="pressing-heading">Coming up</h2>
      {upcoming.length === 0 ? (
        <p className="muted">
          Nothing scheduled just now. Everything in the shop is pressed and bottled —{' '}
          <Link to="/shop">have a look</Link>.
        </p>
      ) : (
        <ul className="pressing-list">
          {upcoming.map((p) => <Run key={p.id} p={p} />)}
        </ul>
      )}

      {recent.length > 0 && (
        <>
          <h2 className="pressing-heading">Recently pressed</h2>
          <ul className="pressing-list">
            {recent.map((p) => <Run key={p.id} p={p} past />)}
          </ul>
        </>
      )}

      <p className="muted" style={{ fontSize: '0.85rem', marginTop: 28 }}>
        Reserving from a run means your bottle is filled from that pressing and goes out the day it
        comes off the press. You'll find the option on the product's own page.
      </p>
    </div>
  );
}
