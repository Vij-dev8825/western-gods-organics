import { useState } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { isValidEmail, isValidPhone } from '../utils/validators';
import ChakkiWheel from '../components/ChakkiWheel';
import SeoMeta from '../components/SeoMeta';

const initial = {
  name: '', company: '', phone: '', email: '', country: '',
  productCategory: 'castor-oil', quantity: '', unit: 'Litres', message: '',
};

function validate(form) {
  const errors = {};
  if (!form.name || form.name.trim().length < 2) errors.name = 'Enter your name.';
  if (!isValidPhone(form.phone)) errors.phone = 'Enter a valid 10-digit mobile number.';
  if (form.email && !isValidEmail(form.email)) errors.email = 'Enter a valid email address, or leave it blank.';
  if (!form.country || form.country.trim().length < 2) errors.country = 'Enter the country you\'re importing to.';
  if (!form.quantity || Number(form.quantity) < 1) errors.quantity = 'Enter a quantity of at least 1.';
  return errors;
}

export default function ImportInfo() {
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState(null); // null | 'sent' | 'error'
  const [loading, setLoading] = useState(false);
  const { token } = useAuth();

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const fieldErrors = validate(form);
    setErrors(fieldErrors);
    if (Object.keys(fieldErrors).length) return;
    setLoading(true);
    setStatus(null);
    try {
      await api.submitBulkEnquiry(form, token);
      setStatus('sent');
      setForm(initial);
      setErrors({});
    } catch (err) {
      setStatus(err.message || 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container section">
      <SeoMeta
        title="Import Cold-Pressed Oils, Herbal Soaps & Powders | Western Gods Organics"
        description="Import authentic Indian cold-pressed oils, herbal soaps and herbal powders to your country. Export-ready, GST/IEC invoicing, worldwide shipping."
        path="/import"
      />
      <div className="breadcrumb">Home / Import to Your Country</div>
      <div className="two-col-split">
        <div>
          <span className="eyebrow">International</span>
          <h2>Import Western Gods Organics to your country</h2>
          <p className="muted">
            We currently ship across India, and we're keen to bring our wood-pressed oils,
            soaps and powders to customers abroad too. Whether it's for personal use, a
            specialty store, or as a distributor, share your details and our team will work
            with you on quantities, packaging and logistics.
          </p>
          <ul style={{ listStyle: 'disc', paddingLeft: 20, color: 'var(--forest-light)' }}>
            <li>Bulk export quantities — drums, cartons or custom packaging</li>
            <li>Product documentation, ingredient lists and lab test summaries for customs/import requirements</li>
            <li>GST invoicing on the India side of the shipment</li>
          </ul>
          <div className="center" style={{ marginTop: 40 }}>
            <ChakkiWheel size={70} />
          </div>
        </div>

        <form className="form-card" style={{ margin: 0 }} onSubmit={handleSubmit} noValidate>
          {status === 'sent' && (
            <div className="alert alert-success">Thanks! Our team will get back to you about importing to your country.</div>
          )}
          {status && status !== 'sent' && <div className="alert alert-error">{status}</div>}

          <div className="field">
            <label>Full name *</label>
            <input required value={form.name} onChange={(e) => update('name', e.target.value)} />
            {errors.name && <div className="field-error">{errors.name}</div>}
          </div>
          <div className="field">
            <label>Company / Store name</label>
            <input value={form.company} onChange={(e) => update('company', e.target.value)} />
          </div>
          <div className="field">
            <label>Mobile number *</label>
            <input
              required
              type="tel"
              inputMode="numeric"
              maxLength={10}
              value={form.phone}
              onChange={(e) => update('phone', e.target.value.replace(/\D/g, ''))}
            />
            {errors.phone && <div className="field-error">{errors.phone}</div>}
          </div>
          <div className="field">
            <label>Email</label>
            <input type="email" value={form.email} onChange={(e) => update('email', e.target.value)} />
            {errors.email && <div className="field-error">{errors.email}</div>}
          </div>
          <div className="field">
            <label>Country *</label>
            <input required value={form.country} onChange={(e) => update('country', e.target.value)} placeholder="e.g. United Arab Emirates" />
            {errors.country && <div className="field-error">{errors.country}</div>}
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
              {errors.quantity && <div className="field-error">{errors.quantity}</div>}
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
            <textarea value={form.message} onChange={(e) => update('message', e.target.value)} placeholder="Import requirements, target market, timeline, etc." />
          </div>
          <button className="btn btn-gold btn-block" disabled={loading}>
            {loading ? 'Sending…' : 'Submit enquiry'}
          </button>
        </form>
      </div>
    </div>
  );
}
