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

  return (
    <div className="container section" style={{ maxWidth: 640 }}>
      <SeoMeta title={`Batch ${batch.batchNumber} — Western Gods Organics`} path={`/batch/${batch.batchNumber}`} />
      <div className="breadcrumb">Home / Batch {batch.batchNumber}</div>
      <div className="form-card">
        <div className="flex gap-2" style={{ alignItems: 'center', marginBottom: 16 }}>
          <img src={getProductImage(batch.image)} alt={batch.productName} style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 'var(--radius-sm)' }} />
          <div>
            <span className="eyebrow">Batch passport</span>
            <h2 style={{ margin: 0 }}>{batch.productName}</h2>
            {batch.sellerName && <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>by {batch.sellerName}</p>}
          </div>
        </div>

        <table className="admin-table">
          <tbody>
            <tr><td><b>Batch number</b></td><td>{batch.batchNumber}</td></tr>
            {batch.productionDate && <tr><td><b>Made on</b></td><td>{formatDate(batch.productionDate)}</td></tr>}
            {batch.bestBeforeDate && <tr><td><b>Best before</b></td><td>{formatDate(batch.bestBeforeDate)}</td></tr>}
            {batch.fssaiLicense && <tr><td><b>FSSAI license</b></td><td>{batch.fssaiLicense}</td></tr>}
            {/* Our own mill only — saying a marketplace seller's product came
                out of it would simply be untrue. */}
            <tr><td><b>Made {batch.sellerName ? 'by' : 'at'}</b></td><td>{batch.sellerName || mill.address}</td></tr>
            {batch.inciIngredients && <tr><td><b>Ingredients</b></td><td>{batch.inciIngredients}</td></tr>}
          </tbody>
        </table>

        {batch.labReportUrl && (
          <p style={{ marginTop: 16 }}>
            <a href={batch.labReportUrl} target="_blank" rel="noreferrer" className="btn btn-outline btn-sm">
              View lab report
            </a>
          </p>
        )}

        <p className="muted" style={{ marginTop: 20, fontSize: '0.85rem' }}>
          Every batch is pressed/made in small quantities and traced back to this record — scan the
          code on your bottle or pack anytime to check it's genuine.
        </p>

        <Link to={`/product/${batch.productId}`} className="btn btn-gold btn-sm" style={{ marginTop: 8 }}>
          View product
        </Link>
      </div>
    </div>
  );
}
