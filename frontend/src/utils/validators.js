export const PHONE_REGEX = /^[6-9]\d{9}$/;
export const PINCODE_REGEX = /^[1-9]\d{5}$/;
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// International addresses vary too widely for a single rigid pattern (UK/
// Canada postcodes are alphanumeric, phone lengths vary by country), so
// non-India addresses get a permissive sanity check instead of a strict one.
export const INTL_POSTAL_REGEX = /^[A-Za-z0-9][A-Za-z0-9\s-]{2,9}$/;
export const INTL_PHONE_REGEX = /^\+?\d{6,15}$/;

export function isValidPhone(phone, country = 'IN') {
  const v = (phone || '').trim();
  return country === 'IN' ? PHONE_REGEX.test(v) : INTL_PHONE_REGEX.test(v.replace(/[\s-]/g, ''));
}

export function isValidPincode(pincode, country = 'IN') {
  const v = (pincode || '').trim();
  return country === 'IN' ? PINCODE_REGEX.test(v) : INTL_POSTAL_REGEX.test(v);
}

export function isValidEmail(email) {
  return EMAIL_REGEX.test((email || '').trim());
}

/** Delivery address validation shared by Cart checkout and the subscription
 * form. Returns an { fieldName: message } map — empty object means valid.
 * address.country (a CurrencyContext country code) selects strict India
 * rules vs a permissive international check; defaults to India when unset. */
export function validateAddress(address) {
  const country = address.country || 'IN';
  const errors = {};
  if (!address.line1 || address.line1.trim().length < 5) {
    errors.line1 = 'Enter your full address (at least 5 characters).';
  }
  if (!address.city || address.city.trim().length < 2) {
    errors.city = 'Enter a valid city.';
  }
  if (!address.state || address.state.trim().length < 2) {
    errors.state = country === 'IN' ? 'Enter a valid state.' : 'Enter a valid state/province.';
  }
  if (!isValidPincode(address.pincode, country)) {
    errors.pincode = country === 'IN' ? 'Enter a valid 6-digit pincode.' : 'Enter a valid postal/ZIP code.';
  }
  if (!isValidPhone(address.phone, country)) {
    errors.phone = country === 'IN'
      ? 'Enter a valid 10-digit mobile number starting with 6-9.'
      : 'Enter a valid phone number, with country code (e.g. +1 555 123 4567).';
  }
  return errors;
}
