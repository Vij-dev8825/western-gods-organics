// Short-lived, single-use proof that a phone number's OTP was verified,
// entirely separate from login — lets a guest confirm they own the
// delivery number before a Cash-on-Delivery order is accepted, without
// creating or touching any user account.
const verifiedPhones = new Map(); // phone -> expiresAt
const VERIFICATION_TTL_MS = 15 * 60 * 1000; // enough to finish checkout

function markPhoneVerified(phone) {
  verifiedPhones.set(phone, Date.now() + VERIFICATION_TTL_MS);
}

function isPhoneVerified(phone) {
  const expiresAt = verifiedPhones.get(phone);
  if (!expiresAt) return false;
  if (Date.now() > expiresAt) {
    verifiedPhones.delete(phone);
    return false;
  }
  return true;
}

function consumePhoneVerification(phone) {
  verifiedPhones.delete(phone);
}

module.exports = { markPhoneVerified, isPhoneVerified, consumePhoneVerification };
