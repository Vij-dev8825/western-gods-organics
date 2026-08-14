import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { getProductImage } from '../utils/productImages';
import ChakkiWheel from '../components/ChakkiWheel';
import SeoMeta from '../components/SeoMeta';

const formatDate = (d) =>
  new Date(d).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
const shortDate = (d) =>
  new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

function countdown(days) {
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days < 14) return `in ${days} days`;
  if (days < 60) return `in ${Math.round(days / 7)} weeks`;
  return `in ${Math.round(days / 30)} months`;
}

/**
 * The season ahead.
 *
 * Oil in Tamil Nadu is bought to a calendar — sesame for the Karthigai lamps,
 * gingelly before the Aadi bath, hampers ahead of Deepavali. A shop that says
 * nothing about that leaves its customers to remember on their own, and finds
 * out about the season from the orders it didn't get.
 *
 * The useful part is not the date, which everyone knows, but the last day to
 * order for it, which nobody works out.
 */
export default function Festivals() {
  const [festivals, setFestivals] = useState(undefined);

  useEffect(() => {
    api.getFestivals().then((d) => setFestivals(d.festivals)).catch(() => setFestivals(null));
  }, []);

  if (festivals === undefined) {
    return <div className="center" style={{ padding: '120px 0' }}><ChakkiWheel size={56} /></div>;
  }

  const list = festivals || [];

  return (
    <div className="container section" style={{ maxWidth: 760 }}>
      <SeoMeta
        title="Festival calendar — what to order, and by when"
        description="Aadi, Karthigai, Pongal and Deepavali — which cold-pressed oils each season calls for, and the last day to order so it reaches you in time."
        path="/festivals"
      />
      <div className="breadcrumb">Home / Festival calendar</div>
      <span className="eyebrow">The year at the mill</span>
      <h1>What to order, and by when</h1>
      <p className="muted" style={{ maxWidth: '58ch' }}>
        Oil here is bought to a calendar. These are the days coming up that call for it — and,
        more usefully, the last day to order so it actually reaches you beforehand.
      </p>

      {list.length === 0 ? (
        <div className="admin-card" style={{ marginTop: 20 }}>
          <p className="muted" style={{ margin: 0 }}>
            Nothing on the calendar just now. Everything in the shop is pressed and ready —{' '}
            <Link to="/shop">have a look</Link>.
          </p>
        </div>
      ) : (
        <ul className="festival-list">
          {list.map((f) => (
            <li className={`festival ${f.orderingClosed ? 'is-closed' : ''}`} key={f.id}>
              <div className="festival-when">
                <b>{countdown(f.daysAway)}</b>
                <span>{formatDate(f.date)}</span>
              </div>
              <h2 className="festival-name">{f.name}</h2>
              {f.note && <p className="festival-note">{f.note}</p>}

              {f.orderingClosed ? (
                <p className="festival-order closed">
                  Too close to post now — but it's{' '}
                  <Link to="/shop">in the shop</Link> if you're nearby.
                </p>
              ) : (
                <p className="festival-order">
                  Order by <b>{shortDate(f.orderBy)}</b> to have it in time
                </p>
              )}

              {f.products.length > 0 && (
                <div className="festival-products">
                  {f.products.map((p) => (
                    <Link to={`/product/${p.id}`} className="festival-product" key={p.id}>
                      <img src={getProductImage(p.image)} alt="" />
                      <span>
                        {p.name}
                        {p.price != null && <em>from ₹{p.price}</em>}
                        {!p.inStock && <em className="oos">out of stock</em>}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <p className="muted" style={{ fontSize: '0.85rem', marginTop: 28 }}>
        Dates follow the Tamil calendar and shift a little each year — these are the ones the mill
        is working to. <Link to="/pressings">See what's being pressed</Link> if you'd rather have
        oil from a particular run.
      </p>
    </div>
  );
}
