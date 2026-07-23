import { useState } from 'react';
import { useCurrency } from '../context/CurrencyContext';

const MIN_BUSINESS_DAYS = 3;
const MAX_BUSINESS_DAYS = 5;
const INTL_MIN_BUSINESS_DAYS = 10;
const INTL_MAX_BUSINESS_DAYS = 20;

function isValidPincode(pin) {
  return /^[1-9]\d{5}$/.test(pin);
}

function addBusinessDays(from, days) {
  const d = new Date(from);
  let added = 0;
  while (added < days) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0 && d.getDay() !== 6) added++;
  }
  return d;
}

function formatDate(d) {
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}

/** Pincode-based delivery estimate. There's no live courier/serviceability
 * lookup behind this — it just validates the pincode and applies the same
 * 3-5 business day window quoted elsewhere on the product page, rendered as
 * actual calendar dates instead of a generic range. */
export default function DeliveryEstimate() {
  const { isForeign } = useCurrency();
  const [pincode, setPincode] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  if (isForeign) {
    return (
      <div className="delivery-estimate">
        <div className="delivery-estimate-label">📦 Estimated delivery date</div>
        <p className="delivery-estimate-result">
          International delivery typically takes <b>{INTL_MIN_BUSINESS_DAYS}-{INTL_MAX_BUSINESS_DAYS} business days</b>,
          depending on your country's customs clearance.
        </p>
      </div>
    );
  }

  function handleChange(e) {
    setPincode(e.target.value.replace(/\D/g, '').slice(0, 6));
    setResult(null);
    setError('');
  }

  function check(e) {
    e.preventDefault();
    if (!isValidPincode(pincode)) {
      setError('Enter a valid 6-digit pincode.');
      setResult(null);
      return;
    }
    setError('');
    const today = new Date();
    setResult({
      from: formatDate(addBusinessDays(today, MIN_BUSINESS_DAYS)),
      to: formatDate(addBusinessDays(today, MAX_BUSINESS_DAYS)),
    });
  }

  return (
    <div className="delivery-estimate">
      <div className="delivery-estimate-label">📦 Estimated delivery date</div>
      <form className="delivery-estimate-form" onSubmit={check}>
        <input
          value={pincode}
          onChange={handleChange}
          placeholder="Enter pincode"
          inputMode="numeric"
          aria-label="Pincode"
        />
        <button type="submit" className="btn btn-forest btn-sm">
          Check
        </button>
      </form>
      {error && <div className="field-error">{error}</div>}
      {result && (
        <p className="delivery-estimate-result">
          Arrives between <b>{result.from}</b> and <b>{result.to}</b>
        </p>
      )}
    </div>
  );
}
