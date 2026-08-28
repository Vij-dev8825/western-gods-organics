import { useState } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { useCurrency } from '../context/CurrencyContext';
import { isValidEmail, isValidPhone } from '../utils/validators';
import ChakkiWheel from '../components/ChakkiWheel';
import PageBanner from '../components/PageBanner';
import SeoMeta from '../components/SeoMeta';

const SUPPORT_PHONE = '+918825875607';

const PRODUCT_OPTIONS = [
  ['castor-oil', 'Castor Oil'],
  ['coconut-oil', 'Coconut Oil'],
  ['sesame-oil', 'Sesame (Til) Oil'],
  ['groundnut-oil', 'Groundnut Oil'],
  ['mixed', 'Mixed / Not sure'],
];

const emptyItem = () => ({ productCategory: 'castor-oil', quantity: '', unit: 'Litres' });

function initialForm(countryCode) {
  return {
    name: '', company: '', phone: '', email: '', city: '', country: countryCode, gstin: '',
    items: [emptyItem()],
    sampleRequested: false,
    privateLabel: false,
    message: '',
  };
}

function validate(form) {
  const errors = {};
  if (!form.name || form.name.trim().length < 2) errors.name = 'Enter your name.';
  if (!isValidPhone(form.phone)) errors.phone = 'Enter a valid 10-digit mobile number.';
  if (form.email && !isValidEmail(form.email)) errors.email = 'Enter a valid email address, or leave it blank.';
  const itemErrors = form.items.map((it) => (!it.quantity || Number(it.quantity) < 1 ? 'Enter a quantity of at least 1.' : null));
  if (itemErrors.some(Boolean)) errors.items = itemErrors;
  return errors;
}

function whatsappUrl(form) {
  const lines = form.items
    .filter((it) => it.quantity)
    .map((it) => `${it.quantity} ${it.unit} of ${PRODUCT_OPTIONS.find(([v]) => v === it.productCategory)?.[1] || it.productCategory}`);
  const text = form.name
    ? `Hi, I'm ${form.name}${form.company ? ` from ${form.company}` : ''}. I'd like a bulk quote for: ${lines.join(', ') || 'your oils'}.`
    : "Hi, I'd like a bulk order quote for your oils.";
  return `https://wa.me/${SUPPORT_PHONE.replace('+', '')}?text=${encodeURIComponent(text)}`;
}

export default function BulkEnquiry() {
  const { country, countries } = useCurrency();
  const [form, setForm] = useState(() => initialForm(country.code));
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState(null); // null | { enquiryNumber } | 'error message'
  const [loading, setLoading] = useState(false);
  const { token } = useAuth();

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function updateItem(i, field, value) {
    setForm((f) => ({ ...f, items: f.items.map((it, idx) => (idx === i ? { ...it, [field]: value } : it)) }));
  }

  function addItem() {
    setForm((f) => ({ ...f, items: [...f.items, emptyItem()] }));
  }

  function removeItem(i) {
    setForm((f) => ({ ...f, items: f.items.filter((_, idx) => idx !== i) }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const fieldErrors = validate(form);
    setErrors(fieldErrors);
    if (Object.keys(fieldErrors).length) return;
    setLoading(true);
    setStatus(null);
    try {
      const data = await api.submitBulkEnquiry(form, token);
      setStatus({ enquiryNumber: data.enquiryNumber });
      setForm(initialForm(country.code));
      setErrors({});
    } catch (err) {
      setStatus(err.message || 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="section" style={{ paddingTop: 0 }}>
      <SeoMeta
        title="Bulk & Wholesale Enquiry | Western Gods Organics"
        description="Buy wholesale cold-pressed oils, herbal soaps and powders in bulk. GST invoicing, private-label bottling, and worldwide export shipping available."
        path="/bulk-enquiry"
      />
      <PageBanner
        page="bulk-enquiry"
        title="Stock our oils in your store or kitchen"
        subtitle="We supply restaurants, retailers, gyms (for massage oils), and distributors across India and worldwide in 5L, 15L and 35L containers, with GST invoicing and flexible delivery schedules."
      />
      <div className="container">
      <div className="breadcrumb">Home / Bulk Sales Enquiry</div>
      <div className="two-col-split">
        <div>
          <ul style={{ listStyle: 'disc', paddingLeft: 20, color: 'var(--forest-light)' }}>
            <li>Minimum order: 20 litres per product</li>
            <li>Custom private-label bottling available on request</li>
            <li>Sample bottles shipped before large orders</li>
            <li>Our team responds within 24 working hours</li>
          </ul>
          <a
            href={whatsappUrl(form)}
            target="_blank"
            rel="noreferrer"
            className="btn btn-outline btn-block"
            style={{ marginTop: 20 }}
          >
            💬 Quick enquiry on WhatsApp
          </a>
          <div className="center" style={{ marginTop: 40 }}>
            <ChakkiWheel size={70} />
          </div>
        </div>

        <form className="form-card" style={{ margin: 0 }} onSubmit={handleSubmit} noValidate>
          {status?.enquiryNumber && (
            <div className="alert alert-success">
              Thanks! Your reference number is <b>{status.enquiryNumber}</b>. Our bulk sales team will contact you within 24 hours.
            </div>
          )}
          {status && typeof status === 'string' && <div className="alert alert-error">{status}</div>}

          <div className="field">
            <label htmlFor="bulk-enquiry-name">Full name *</label>
            <input id="bulk-enquiry-name" required value={form.name} onChange={(e) => update('name', e.target.value)} />
            {errors.name && <div className="field-error">{errors.name}</div>}
          </div>
          <div className="field">
            <label htmlFor="bulk-enquiry-company">Company / Store name</label>
            <input id="bulk-enquiry-company" value={form.company} onChange={(e) => update('company', e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="bulk-enquiry-phone">Mobile number *</label>
            <input
              id="bulk-enquiry-phone"
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
            <label htmlFor="bulk-enquiry-email">Email</label>
            <input id="bulk-enquiry-email" type="email" value={form.email} onChange={(e) => update('email', e.target.value)} />
            {errors.email && <div className="field-error">{errors.email}</div>}
          </div>
          <div className="flex gap-1">
            <div className="field" style={{ flex: 1 }}>
              <label htmlFor="bulk-enquiry-city">City</label>
              <input id="bulk-enquiry-city" value={form.city} onChange={(e) => update('city', e.target.value)} />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label htmlFor="bulk-enquiry-country">Country</label>
              <select id="bulk-enquiry-country" value={form.country} onChange={(e) => update('country', e.target.value)}>
                {countries.map((c) => (
                  <option key={c.code} value={c.code}>{c.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="field">
            <label htmlFor="bulk-enquiry-gstin">GST / Business Registration ID (optional)</label>
            <input id="bulk-enquiry-gstin" value={form.gstin} onChange={(e) => update('gstin', e.target.value.toUpperCase())} placeholder="e.g. 22AAAAA0000A1Z5" />
          </div>

          {form.items.map((item, i) => (
            <div className="flex gap-1" key={i} style={{ alignItems: 'flex-start' }}>
              <div className="field" style={{ flex: 2 }}>
                <label htmlFor={`bulk-enquiry-product-${i}`}>{i === 0 ? 'Product *' : `Product ${i + 1}`}</label>
                <select id={`bulk-enquiry-product-${i}`} value={item.productCategory} onChange={(e) => updateItem(i, 'productCategory', e.target.value)}>
                  {PRODUCT_OPTIONS.map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
              <div className="field" style={{ flex: 1 }}>
                <label htmlFor={`bulk-enquiry-quantity-${i}`}>Quantity *</label>
                <input id={`bulk-enquiry-quantity-${i}`} required type="number" min="1" value={item.quantity} onChange={(e) => updateItem(i, 'quantity', e.target.value)} />
                {errors.items?.[i] && <div className="field-error">{errors.items[i]}</div>}
              </div>
              <div className="field" style={{ flex: 1 }}>
                <label htmlFor={`bulk-enquiry-unit-${i}`}>Unit</label>
                <select id={`bulk-enquiry-unit-${i}`} value={item.unit} onChange={(e) => updateItem(i, 'unit', e.target.value)}>
                  <option>Litres</option>
                  <option>Bottles</option>
                  <option>Drums</option>
                </select>
              </div>
              {form.items.length > 1 && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  style={{ marginTop: 28 }}
                  aria-label="Remove this product"
                  onClick={() => removeItem(i)}
                >
                  ✕
                </button>
              )}
            </div>
          ))}
          <button type="button" className="btn btn-outline btn-sm" style={{ marginBottom: 18 }} onClick={addItem}>
            + Add another product
          </button>

          <label className="filter-option">
            <input type="checkbox" checked={form.sampleRequested} onChange={(e) => update('sampleRequested', e.target.checked)} />
            <span className="filter-radio filter-checkbox" aria-hidden="true" />
            Send me a sample before the bulk order
          </label>
          <label className="filter-option" style={{ marginBottom: 18 }}>
            <input type="checkbox" checked={form.privateLabel} onChange={(e) => update('privateLabel', e.target.checked)} />
            <span className="filter-radio filter-checkbox" aria-hidden="true" />
            I'm interested in private-label / custom bottling
          </label>

          <div className="field">
            <label htmlFor="bulk-enquiry-message">Message</label>
            <textarea id="bulk-enquiry-message" value={form.message} onChange={(e) => update('message', e.target.value)} placeholder="Tell us about your requirement, delivery timeline, etc." />
          </div>
          <button className="btn btn-gold btn-block" disabled={loading}>
            {loading ? 'Sending…' : 'Submit enquiry'}
          </button>
        </form>
      </div>
      </div>
    </div>
  );
}
