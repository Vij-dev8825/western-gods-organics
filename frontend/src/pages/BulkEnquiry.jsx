import { useState } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import ChakkiWheel from '../components/ChakkiWheel';

const initial = {
  name: '', company: '', phone: '', email: '', city: '',
  productCategory: 'castor-oil', quantity: '', unit: 'Litres', message: '',
};

export default function BulkEnquiry() {
  const [form, setForm] = useState(initial);
  const [status, setStatus] = useState(null); // null | 'sent' | 'error'
  const [loading, setLoading] = useState(false);
  const { token } = useAuth();

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setStatus(null);
    try {
      await api.submitBulkEnquiry(form, token);
      setStatus('sent');
      setForm(initial);
    } catch (err) {
      setStatus(err.message || 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container section">
      <div className="breadcrumb">Home / Bulk Sales Enquiry</div>
      <div className="two-col-split">
        <div>
          <span className="eyebrow">Wholesale &amp; Bulk Orders</span>
          <h2>Stock our oils in your store or kitchen</h2>
          <p className="muted">
            We supply restaurants, retailers, gyms (for massage oils), and distributors
            across India in 5L, 15L and 35L containers, with GST invoicing and flexible
            delivery schedules.
          </p>
          <ul style={{ listStyle: 'disc', paddingLeft: 20, color: 'var(--forest-light)' }}>
            <li>Minimum order: 20 litres per product</li>
            <li>Custom private-label bottling available on request</li>
            <li>Sample bottles shipped before large orders</li>
            <li>Our team responds within 24 working hours</li>
          </ul>
          <div className="center" style={{ marginTop: 40 }}>
            <ChakkiWheel size={70} />
          </div>
        </div>

        <form className="form-card" style={{ margin: 0 }} onSubmit={handleSubmit}>
          {status === 'sent' && (
            <div className="alert alert-success">Thanks! Our bulk sales team will contact you within 24 hours.</div>
          )}
          {status && status !== 'sent' && <div className="alert alert-error">{status}</div>}

          <div className="field">
            <label>Full name *</label>
            <input required value={form.name} onChange={(e) => update('name', e.target.value)} />
          </div>
          <div className="field">
            <label>Company / Store name</label>
            <input value={form.company} onChange={(e) => update('company', e.target.value)} />
          </div>
          <div className="field">
            <label>Mobile number *</label>
            <input required value={form.phone} onChange={(e) => update('phone', e.target.value)} />
          </div>
          <div className="field">
            <label>Email</label>
            <input type="email" value={form.email} onChange={(e) => update('email', e.target.value)} />
          </div>
          <div className="field">
            <label>City</label>
            <input value={form.city} onChange={(e) => update('city', e.target.value)} />
          </div>
          <div className="field">
            <label>Product *</label>
            <select value={form.productCategory} onChange={(e) => update('productCategory', e.target.value)}>
              <option value="castor-oil">Castor Oil</option>
              <option value="coconut-oil">Coconut Oil</option>
              <option value="sesame-oil">Sesame (Til) Oil</option>
              <option value="groundnut-oil">Groundnut Oil</option>
              <option value="mixed">Mixed / Not sure</option>
            </select>
          </div>
          <div className="flex gap-1">
            <div className="field" style={{ flex: 2 }}>
              <label>Quantity *</label>
              <input required type="number" min="1" value={form.quantity} onChange={(e) => update('quantity', e.target.value)} />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label>Unit</label>
              <select value={form.unit} onChange={(e) => update('unit', e.target.value)}>
                <option>Litres</option>
                <option>Bottles</option>
                <option>Drums</option>
              </select>
            </div>
          </div>
          <div className="field">
            <label>Message</label>
            <textarea value={form.message} onChange={(e) => update('message', e.target.value)} placeholder="Tell us about your requirement, delivery timeline, etc." />
          </div>
          <button className="btn btn-gold btn-block" disabled={loading}>
            {loading ? 'Sending…' : 'Submit enquiry'}
          </button>
        </form>
      </div>
    </div>
  );
}
