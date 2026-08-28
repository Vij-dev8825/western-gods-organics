import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api';
import { getProductImage } from '../utils/productImages';
import { STORE_LOCATIONS } from '../data/storeLocations';
import ChakkiWheel from '../components/ChakkiWheel';
import SeoMeta from '../components/SeoMeta';

function formatDate(d) {
  return d ? new Date(d).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' }) : null;
}

/** One real sentence built only from fields this batch actually has —
 * never a fixed template with blanks, so a batch missing grower info still
 * reads naturally instead of leaving a gap. */
function buildStory(batch, mill) {
  const verb = batch.category === 'oils' ? 'pressed' : 'made';
  const made = batch.sellerName ? `made by ${batch.sellerName}` : `made at ${mill.address}`;

  if (!batch.productionDate && !batch.growerName && !batch.growerVillage) {
    return `This is batch ${batch.batchNumber} of ${batch.productName}, ${made}.`;
  }

  const when = batch.productionDate ? ` on ${formatDate(batch.productionDate)}` : '';
  // The village alone is worth saying when a grower asked not to be named —
  // where it came from is still more than most labels say.
  const grower = batch.growerName || (batch.growerVillage ? 'a grower' : '');
  const village = batch.growerVillage ? ` in ${batch.growerVillage}` : '';
  const from = grower ? `, from ${grower}'s harvest${village}` : '';
  return `This ${batch.productName} was ${verb}${when}${from} — ${made}.`;
}

export default function BatchPassport() {
  const { batchNumber } = useParams();
  const [batch, setBatch] = useState(undefined); // undefined = loading, null = not found

  useEffect(() => {
    api.getBatch(batchNumber).then((d) => setBatch(d.batch)).catch(() => setBatch(null));
  }, [batchNumber]);

  if (batch === undefined) {
    return (
      <div className="center" style={{ padding: '120px 0' }}>
        <ChakkiWheel size={56} />
      </div>
    );
  }

  if (!batch) {
    return (
      <div className="container section empty-state">
        <ChakkiWheel size={56} spin={false} />
        <h3>Batch not found</h3>
        <p className="muted">We couldn't find a record for batch "{batchNumber}".</p>
        <Link to="/shop" className="btn btn-gold">Browse the shop</Link>
      </div>
    );
  }

  const mill = STORE_LOCATIONS[0];
  const hasDetails = batch.bestBeforeDate || batch.fssaiLicense || batch.inciIngredients || batch.labReportUrl;

  return (
    <div className="container section" style={{ maxWidth: 640 }}>
      <SeoMeta title={`Batch ${batch.batchNumber} — Western Gods Organics`} path={`/batch/${batch.batchNumber}`} />
      <div className="breadcrumb">Home / Batch {batch.batchNumber}</div>
      <div className="form-card batch-story">
        <span className="eyebrow">The story of this batch</span>

        <div className="batch-story-hero">
          <img
            src={batch.batchPhoto ? batch.batchPhoto : getProductImage(batch.image)}
            alt={batch.batchPhoto ? `Batch ${batch.batchNumber} on the day it was made` : batch.productName}
            className="batch-story-photo"
          />
          <p className="batch-story-lede">{buildStory(batch, mill)}</p>
        </div>

        <p className="muted" style={{ fontSize: '0.85rem' }}>
          Batch {batch.batchNumber} — scan the code on your bottle or pack anytime to check it's genuine.
        </p>

        {hasDetails && (
          <div className="batch-story-details">
            <span className="eyebrow" style={{ fontSize: '0.68rem' }}>Batch details</span>
            <table className="admin-table">
              <tbody>
                {batch.bestBeforeDate && <tr><td><b>Best before</b></td><td>{formatDate(batch.bestBeforeDate)}</td></tr>}
                {batch.fssaiLicense && <tr><td><b>FSSAI license</b></td><td>{batch.fssaiLicense}</td></tr>}
                {batch.inciIngredients && <tr><td><b>Ingredients</b></td><td>{batch.inciIngredients}</td></tr>}
              </tbody>
            </table>
            {batch.labReportUrl && (
              <p style={{ marginTop: 12 }}>
                <a href={batch.labReportUrl} target="_blank" rel="noreferrer" className="btn btn-outline btn-sm">
                  View lab report
                </a>
              </p>
            )}
          </div>
        )}

        <Link to={`/product/${batch.productId}`} className="btn btn-gold btn-sm" style={{ marginTop: 20 }}>
          View product
        </Link>
      </div>
    </div>
  );
}
