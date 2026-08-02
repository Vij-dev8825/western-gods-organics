import { useEffect, useState } from 'react';
import { useCurrency } from '../context/CurrencyContext';
import { countryFlagEmoji } from '../utils/countryFlag';
import { api } from '../api';

/** Shared delivery-address field set — country, address line, pincode (with
 * auto city/state lookup for India), city, state, phone — used by Cart
 * checkout, the subscription address form, and the Profile address book so
 * the pincode-lookup behavior only needs to live in one place. */
export default function AddressForm({ address, onChange, errors, showLabel = false, showCustomsNote = false }) {
  const { countries } = useCurrency();
  const [cityOptions, setCityOptions] = useState([]);
  const [stateOptions, setStateOptions] = useState([]);
  const [pincodeLookupError, setPincodeLookupError] = useState('');

  useEffect(() => {
    if (address.country !== 'IN' || !/^\d{6}$/.test(address.pincode)) {
      setCityOptions([]);
      setStateOptions([]);
      setPincodeLookupError('');
      return undefined;
    }
    let cancelled = false;
    api
      .lookupPincode(address.pincode)
      .then((d) => {
        if (cancelled) return;
        setCityOptions(d.cities);
        setStateOptions(d.states);
        setPincodeLookupError('');
        onChange('city', d.cities.includes(address.city) ? address.city : d.cities[0] || '');
        onChange('state', d.states.includes(address.state) ? address.state : d.states[0] || '');
      })
      .catch(() => {
        if (cancelled) return;
        setCityOptions([]);
        setStateOptions([]);
        setPincodeLookupError("Couldn't look up this pincode — enter city/state manually.");
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address.pincode, address.country]);

  return (
    <>
      {showLabel && (
        <div className="field">
          <label>Label (optional)</label>
          <input
            value={address.label || ''}
            onChange={(e) => onChange('label', e.target.value)}
            placeholder="e.g. Home, Work"
          />
        </div>
      )}
      <div className="field">
        <label>Country</label>
        <select value={address.country} onChange={(e) => onChange('country', e.target.value)}>
          {countries.map((c) => (
            <option key={c.code} value={c.code}>{countryFlagEmoji(c.code)} {c.label}</option>
          ))}
        </select>
      </div>
      <div className="field">
        <label>Address line</label>
        <input required value={address.line1} onChange={(e) => onChange('line1', e.target.value)} />
        {errors.line1 && <div className="field-error">{errors.line1}</div>}
      </div>
      <div className="field">
        <label>{address.country === 'IN' ? 'Pincode' : 'Postal / ZIP code'}</label>
        <input
          required
          inputMode={address.country === 'IN' ? 'numeric' : 'text'}
          maxLength={address.country === 'IN' ? 6 : 10}
          value={address.pincode}
          onChange={(e) => onChange(
            'pincode',
            address.country === 'IN'
              ? e.target.value.replace(/\D/g, '')
              : e.target.value.replace(/[^A-Za-z0-9\s-]/g, '')
          )}
        />
        {errors.pincode && <div className="field-error">{errors.pincode}</div>}
        {pincodeLookupError && <div className="field-error">{pincodeLookupError}</div>}
      </div>
      <div className="field">
        <label>City</label>
        {cityOptions.length > 0 ? (
          <select value={address.city} onChange={(e) => onChange('city', e.target.value)}>
            {cityOptions.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        ) : (
          <input
            required
            value={address.city}
            onChange={(e) => onChange('city', e.target.value)}
            placeholder={address.country === 'IN' ? 'Enter your 6-digit pincode above to auto-fill' : 'Enter your city'}
          />
        )}
        {errors.city && <div className="field-error">{errors.city}</div>}
      </div>
      <div className="field">
        <label>State</label>
        {stateOptions.length > 0 ? (
          <select value={address.state} onChange={(e) => onChange('state', e.target.value)}>
            {stateOptions.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        ) : (
          <input
            required
            value={address.state}
            onChange={(e) => onChange('state', e.target.value)}
            placeholder={address.country === 'IN' ? 'Enter your 6-digit pincode above to auto-fill' : 'Enter your state/province'}
          />
        )}
        {errors.state && <div className="field-error">{errors.state}</div>}
      </div>
      <div className="field">
        <label>Phone</label>
        <input
          required
          type="tel"
          inputMode={address.country === 'IN' ? 'numeric' : 'tel'}
          maxLength={address.country === 'IN' ? 10 : 16}
          value={address.phone}
          placeholder={address.country === 'IN' ? undefined : '+1 555 123 4567'}
          onChange={(e) => onChange(
            'phone',
            address.country === 'IN'
              ? e.target.value.replace(/\D/g, '')
              : e.target.value.replace(/[^\d+\s-]/g, '')
          )}
        />
        {errors.phone && <div className="field-error">{errors.phone}</div>}
      </div>
      {showCustomsNote && address.country !== 'IN' && (
        <p className="muted" style={{ fontSize: '0.8rem' }}>
          🌍 International orders may be subject to customs duties or import taxes charged by your
          country on delivery — these aren't included in the total shown here.
        </p>
      )}
    </>
  );
}
