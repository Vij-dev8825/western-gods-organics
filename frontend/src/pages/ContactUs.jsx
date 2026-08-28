import { useState } from 'react';
import { api } from '../api';
import { isValidEmail, isValidPhone } from '../utils/validators';
import ChakkiWheel from '../components/ChakkiWheel';
import PageBanner from '../components/PageBanner';
import SeoMeta from '../components/SeoMeta';
import { STORE_LOCATIONS } from '../data/storeLocations';

const MILL = STORE_LOCATIONS[0];

function validate(form) {
  const errors = {};
  if (!form.name || form.name.trim().length < 2) errors.name = 'Enter your name.';
  if (!isValidEmail(form.email)) errors.email = 'Enter a valid email address.';
  if (form.phone && !isValidPhone(form.phone)) errors.phone = 'Enter a valid 10-digit mobile number, or leave it blank.';
  if (!form.message || form.message.trim().length < 10) errors.message = 'Tell us a bit more (at least 10 characters).';
  return errors;
}

export default function ContactUs() {
  const [form, setForm] = useState({ name: '', email: '', phone: '', subject: '', message: '' });
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);

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
      await api.submitContact(form);
      setStatus('sent');
      setForm({ name: '', email: '', phone: '', subject: '', message: '' });
      setErrors({});
    } catch (err) {
      setStatus(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="section" style={{ paddingTop: 0 }}>
      <SeoMeta
        title="Contact Us | Western Gods Organics"
        description="Get in touch with Western Gods Organics for questions about our cold-pressed oils, herbal soaps, herbal powders, orders, or bulk enquiries."
        path="/contact"
      />
      <PageBanner
        page="contact"
        title="We'd love to hear from you"
        subtitle="Questions about an order, a product, or just want to say hello — reach us any way that's easy for you."
      />
      <div className="container">
      <div className="breadcrumb">Home / Contact Us</div>
      <div className="two-col-split contact-split">
        <div>
          <div>
            <h3>Visit the mill</h3>
            {/* From the shared record — this is the page Google is most
                likely to read an address off, so it must match the Business
                Profile character for character. It previously opened with the
                mill's name and dropped SH 97. */}
            <p className="muted">{MILL.name}, {MILL.address}</p>
            <h3>Call us</h3>
            <p className="muted"><a href={`tel:${MILL.phone}`}>{MILL.phoneDisplay}</a> ({MILL.hours})</p>
            <h3>Email</h3>
            <p className="muted"><a href="mailto:westerngodsorganic@gmail.com">westerngodsorganic@gmail.com</a></p>
          </div>
          <ChakkiWheel size={60} />
        </div>

        <form className="form-card" style={{ margin: 0 }} onSubmit={handleSubmit} noValidate>
          {status === 'sent' && <div className="alert alert-success">Thanks for reaching out — we'll get back to you soon.</div>}
          {status && status !== 'sent' && <div className="alert alert-error">{status}</div>}

          <div className="field">
            <label htmlFor="contact-name">Name *</label>
            <input id="contact-name" required value={form.name} onChange={(e) => update('name', e.target.value)} />
            {errors.name && <div className="field-error">{errors.name}</div>}
          </div>
          <div className="field">
            <label htmlFor="contact-email">Email *</label>
            <input id="contact-email" required type="email" value={form.email} onChange={(e) => update('email', e.target.value)} />
            {errors.email && <div className="field-error">{errors.email}</div>}
          </div>
          <div className="field">
            <label htmlFor="contact-phone">Phone</label>
            <input
              id="contact-phone"
              type="tel"
              inputMode="numeric"
              maxLength={10}
              value={form.phone}
              onChange={(e) => update('phone', e.target.value.replace(/\D/g, ''))}
            />
            {errors.phone && <div className="field-error">{errors.phone}</div>}
          </div>
          <div className="field">
            <label htmlFor="contact-subject">Subject</label>
            <input id="contact-subject" value={form.subject} onChange={(e) => update('subject', e.target.value)} placeholder="Order enquiry, feedback, etc." />
          </div>
          <div className="field">
            <label htmlFor="contact-message">Message *</label>
            <textarea id="contact-message" required value={form.message} onChange={(e) => update('message', e.target.value)} />
            {errors.message && <div className="field-error">{errors.message}</div>}
          </div>
          <button className="btn btn-gold btn-block" disabled={loading}>
            {loading ? 'Sending…' : 'Send message'}
          </button>
        </form>
      </div>
      </div>
    </div>
  );
}
