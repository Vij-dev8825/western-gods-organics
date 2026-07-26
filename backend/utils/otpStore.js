// Shared in-memory OTP store — phone -> { otp, expiresAt, attempts }. Used
// by both account login/signup (routes/auth.js) and the lightweight guest
// Cash-on-Delivery phone check (routes/orders.js), so a guest only ever
// needs one "enter phone, get code" flow regardless of which one triggered it.
const otpStore = new Map();

const OTP_EXPIRY_MS = (parseInt(process.env.OTP_EXPIRY_MINUTES, 10) || 5) * 60 * 1000;

function generateOtp() {
  return String(Math.floor(1000 + Math.random() * 9000)); // 4-digit OTP
}

module.exports = { otpStore, OTP_EXPIRY_MS, generateOtp };
