import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { getProductImage } from '../../utils/productImages';

const FIELDS = [
  { key: 'businessName', label: 'Business name', hint: 'Printed large at the top of every invoice.' },
  { key: 'legalName', label: 'Legal / mill name', hint: 'The smaller line under your contact details.' },
  { key: 'address', label: 'Address', hint: 'Full postal address, one line.' },
  { key: 'phone', label: 'Phone' },
  { key: 'email', label: 'Email' },
  { key: 'gstin', label: 'GSTIN', hint: 'Leave blank if you are not GST-registered.' },
  { key: 'fssai', label: 'FSSAI licence no.', hint: 'Optional — shown beside GSTIN.' },
  { key: 'signatoryName', label: 'Signatory line', hint: 'The caption under the signature, e.g. "Authorised Signatory".' },
];

export default function AdminInvoice() {
  const { token } = useAuth();
  const { showToast } = useToast();
  const [settings, setSettings] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState('');

  useEffect(() => {
    api.admin.getInvoiceSettings(token).then((d) => setSettings(d.invoiceSettings)).catch(() => {});
  }, [token]);

  function set(key, value) {
    setSettings((s) => ({ ...s, [key]: value }));
  }

  function setTerm(i, value) {
    setSettings((s) => {
      const terms = [...(s.terms || [])];
      terms[i] = value;
      return { ...s, terms };
    });
  }

  async function save() {
    setSaving(true);
    try {
      const d = await api.admin.updateInvoiceSettings(token, settings);
      // Re-sync from the server so anything it trimmed or rejected (a blank
      // terms list, an out-of-range due-day count) is visible immediately
      // rather than silently disagreeing with what's on screen.
      setSettings(d.invoiceSettings);
      showToast('Invoice details saved.');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function upload(field, file) {
    if (!file) return;
    setUploading(field);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const upload = field === 'logoImage' ? api.admin.uploadInvoiceLogo : api.admin.uploadSignature;
      const d = await upload(token, fd);
      set(field, d.url);
      showToast(`${field === 'logoImage' ? 'Logo' : 'Signature'} uploaded — remember to Save.`);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setUploading('');
    }
  }

  if (!settings) {
    return (
      <div>
        <div className="section-head"><div><span className="eyebrow">Settings</span><h2>Invoice</h2></div></div>
        <p className="muted">Loading…</p>
      </div>
    );
  }

  return (
    <div>
      <div className="section-head">
        <div>
          <span className="eyebrow">Settings</span>
          <h2>Invoice</h2>
        </div>
      </div>

      <p className="muted" style={{ maxWidth: 620 }}>
        These details print on every customer invoice. Changes apply to invoices viewed from now on,
        including invoices for past orders — an invoice is generated fresh each time it's opened,
        so correcting a typo here fixes it everywhere.
      </p>

      <div className="form-card" style={{ maxWidth: 620 }}>
        <h4 style={{ marginTop: 0 }}>Business details</h4>
        {FIELDS.map((f) => (
          <div className="field" key={f.key}>
            <label>{f.label}</label>
            <input value={settings[f.key] || ''} onChange={(e) => set(f.key, e.target.value)} />
            {f.hint && <span className="muted" style={{ fontSize: '0.78rem' }}>{f.hint}</span>}
          </div>
        ))}
      </div>

      <div className="form-card" style={{ maxWidth: 620, marginTop: 18 }}>
        <h4 style={{ marginTop: 0 }}>Document type</h4>
        <p className="muted" style={{ fontSize: '0.82rem' }}>
          This is a tax classification, not a label. <b>Bill of Supply</b> is correct only if you do
          not charge GST on the sale (composition scheme or exempt goods). If you are GST-registered
          and charging tax, you must issue a <b>Tax Invoice</b>. If you're unsure, ask your accountant.
        </p>
        <div className="payment-options">
          {['BILL OF SUPPLY', 'TAX INVOICE'].map((t) => (
            <label key={t} className={`payment-option ${settings.documentTitle === t ? 'active' : ''}`}>
              <input
                type="radio"
                name="documentTitle"
                checked={settings.documentTitle === t}
                onChange={() => set('documentTitle', t)}
              />
              <span className="filter-radio" aria-hidden="true" />
              <span className="payment-option-body"><b>{t}</b></span>
            </label>
          ))}
        </div>
        <div className="field" style={{ marginTop: 14 }}>
          <label>Due date (days after the invoice date)</label>
          <input
            type="number"
            min={0}
            max={180}
            value={settings.dueDays ?? 7}
            onChange={(e) => set('dueDays', e.target.value)}
            style={{ width: 120 }}
          />
        </div>
      </div>

      <div className="form-card" style={{ maxWidth: 620, marginTop: 18 }}>
        <h4 style={{ marginTop: 0 }}>Terms &amp; conditions</h4>
        <p className="muted" style={{ fontSize: '0.82rem' }}>
          Printed as a numbered list beside the totals. Clear a line to remove it — if you clear
          them all, the previous terms are kept rather than printing an empty section.
        </p>
        {(settings.terms || []).map((t, i) => (
          <div className="field" key={i}>
            <label>Term {i + 1}</label>
            <textarea rows={2} value={t} onChange={(e) => setTerm(i, e.target.value)} />
          </div>
        ))}
        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={() => setSettings((s) => ({ ...s, terms: [...(s.terms || []), ''] }))}
        >
          + Add a term
        </button>
      </div>

      <div className="form-card" style={{ maxWidth: 620, marginTop: 18 }}>
        <h4 style={{ marginTop: 0 }}>Logo</h4>
        <p className="muted" style={{ fontSize: '0.82rem' }}>
          Prints at the top left of every invoice and of the trade rate card, in place of your
          business name. A wide logo works best — it is fitted into a box about 45mm across.
          Use a PNG with a transparent background if you have one. Leave empty to print the
          business name as text instead.
        </p>
        {settings.logoImage ? (
          <div style={{ marginBottom: 12 }}>
            <img
              src={getProductImage(settings.logoImage)}
              alt="Current invoice logo"
              style={{ maxHeight: 64, maxWidth: 240, display: 'block', marginBottom: 8 }}
            />
            <button type="button" className="link-btn" onClick={() => set('logoImage', '')}>
              Remove logo
            </button>
          </div>
        ) : (
          <p className="muted" style={{ fontSize: '0.82rem' }}><i>No logo uploaded — your business name prints as text.</i></p>
        )}
        <input
          type="file"
          accept="image/jpeg,image/png"
          disabled={!!uploading}
          onChange={(e) => upload('logoImage', e.target.files?.[0])}
        />
        {uploading === 'logoImage' && <span className="muted"> Uploading…</span>}
      </div>

      <div className="form-card" style={{ maxWidth: 620, marginTop: 18 }}>
        <h4 style={{ marginTop: 0 }}>Signature</h4>
        <p className="muted" style={{ fontSize: '0.82rem' }}>
          Upload a photo or scan of your signature on white paper (jpg/png/webp). It prints above
          the signatory line. Leave empty to print a blank line to sign by hand instead.
        </p>
        {settings.signatureImage ? (
          <div style={{ marginBottom: 12 }}>
            <img
              src={getProductImage(settings.signatureImage)}
              alt="Current signature"
              style={{ maxHeight: 70, maxWidth: 240, display: 'block', marginBottom: 8 }}
            />
            <button type="button" className="link-btn" onClick={() => set('signatureImage', '')}>
              Remove signature
            </button>
          </div>
        ) : (
          <p className="muted" style={{ fontSize: '0.82rem' }}><i>No signature uploaded — a blank line will print.</i></p>
        )}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={!!uploading}
          onChange={(e) => upload('signatureImage', e.target.files?.[0])}
        />
        {uploading === 'signatureImage' && <span className="muted"> Uploading…</span>}
      </div>

      <div className="flex gap-1" style={{ marginTop: 20, alignItems: 'center' }}>
        <button type="button" className="btn btn-gold" disabled={saving} onClick={save}>
          {saving ? 'Saving…' : 'Save invoice details'}
        </button>
        <Link to="/admin/orders" className="link-btn">Open an order to preview its invoice →</Link>
      </div>
    </div>
  );
}
