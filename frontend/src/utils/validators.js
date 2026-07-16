export const PHONE_REGEX = /^[6-9]\d{9}$/;
export const PINCODE_REGEX = /^[1-9]\d{5}$/;
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidPhone(phone) {
  return PHONE_REGEX.test((phone || '').trim());
}

export function isValidPincode(pincode) {
  return PINCODE_REGEX.test((pincode || '').trim());
}

export function isValidEmail(email) {
  return EMAIL_REGEX.test((email || '').trim());
}

/** Delivery address validation shared by Cart checkout. Returns an
 * { fieldName: message } map — empty object means valid. */
export function validateAddress(address) {
  const errors = {};
  if (!address.line1 || address.line1.trim().length < 5) {
    errors.line1 = 'Enter your full address (at least 5 characters).';
  }
  if (!address.city || address.city.trim().length < 2) {
    errors.city = 'Enter a valid city.';
  }
  if (!address.state || address.state.trim().length < 2) {
    errors.state = 'Enter a valid state.';
  }
  if (!isValidPincode(address.pincode)) {
    errors.pincode = 'Enter a valid 6-digit pincode.';
  }
  if (!isValidPhone(address.phone)) {
    errors.phone = 'Enter a valid 10-digit mobile number starting with 6-9.';
  }
  return errors;
}
