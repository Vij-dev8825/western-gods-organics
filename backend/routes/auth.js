const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { v4: uuid } = require('uuid');
const db = require('../data/db');
const { requireAuth } = require('../middleware/auth');
const { sendOtpSms } = require('../utils/sms');

const router = express.Router();

const REFERRAL_WELCOME_INR = 100;

// Short, shareable code (not the DB id) every customer gets so they can
// refer friends. Retries on the near-impossible collision rather than
// trusting randomness alone, since this doubles as a lookup key.
async function generateReferralCode() {
  const users = await db.list('users');
  const existing = new Set(users.map((u) => u.referralCode).filter(Boolean));
  let code;
  do {
    code = crypto.randomBytes(4).toString('hex').toUpperCase();
  } while (existing.has(code));
  return code;
}

// Creates the one-time "welcome" discount for a customer who signed up via
// a friend's referral link — assignedToUserId + redeemed make it personal
// and single-use (see utils/coupons.js), unlike the site's regular coupons.
async function issueWelcomeCoupon(userId) {
  const coupon = {
    id: uuid(),
    code: `WELCOME${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
    type: 'flat',
    value: REFERRAL_WELCOME_INR,
    minOrder: 0,
    expiresAt: null,
    active: true,
    featured: false,
    promoImage: '',
    promoHeadline: '',
    promoSubtext: '',
    assignedToUserId: userId,
    redeemed: false,
    createdAt: new Date().toISOString(),
  };
  await db.put('coupons', coupon);
  return coupon;
}

// In-memory OTP store: { [phone]: { otp, expiresAt, attempts } }
const otpStore = new Map();

const OTP_EXPIRY_MS = (parseInt(process.env.OTP_EXPIRY_MINUTES, 10) || 5) * 60 * 1000;

function generateOtp() {
  return String(Math.floor(1000 + Math.random() * 9000)); // 4-digit OTP
}

// India keeps the existing 10-digit format. Every other country must submit
// the full number with a leading "+" and its own calling code (e.g.
// +15551234567) — the leading "+" doubles as the signal sms.js uses to route
// through Twilio instead of the India-only Fast2SMS/MSG91 gateways.
function isValidPhone(phone, country = 'IN') {
  if (country === 'IN') return /^[6-9]\d{9}$/.test(phone);
  return /^\+\d{6,15}$/.test(phone);
}

function signToken(user) {
  return jwt.sign(
    { id: user.id, phone: user.phone, role: user.role || 'customer' },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '30d' }
  );
}

// POST /api/auth/send-otp  { phone, country? }  — country defaults to 'IN'
// for older clients; anything else expects a full "+"-prefixed number.
router.post('/send-otp', async (req, res, next) => {
  try {
    const { phone, country = 'IN' } = req.body;

    if (!phone || !isValidPhone(phone, country)) {
      return res.status(400).json({
        success: false,
        message: country === 'IN'
          ? 'Enter a valid 10-digit mobile number.'
          : 'Enter a valid phone number with your country code (e.g. +15551234567).',
      });
    }

    const otp = generateOtp();
    otpStore.set(phone, { otp, expiresAt: Date.now() + OTP_EXPIRY_MS, attempts: 0 });

    // Goes through the SMS provider when configured; logs to console otherwise.
    await sendOtpSms(phone, otp);

    const response = { success: true, message: 'OTP sent to your mobile number.' };

    // Echo the OTP back so the flow can be tested without a working SMS gateway.
    // Always on outside production; in production it requires an explicit opt-in
    // (SHOW_OTP_ONSCREEN=true) since it would otherwise expose real login codes
    // in the API response — turn it off again once real SMS delivery works.
    if (process.env.NODE_ENV !== 'production' || process.env.SHOW_OTP_ONSCREEN === 'true') {
      response.devOtp = otp;
    }

    res.json(response);
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/verify-otp  { phone, otp, name?, referralCode? }
router.post('/verify-otp', async (req, res, next) => {
  try {
    const { phone, otp, name, referralCode } = req.body;

    if (!phone || !otp) {
      return res.status(400).json({ success: false, message: 'Mobile number and OTP are required.' });
    }

    const record = otpStore.get(phone);

    if (!record) {
      return res.status(400).json({ success: false, message: 'Please request a new OTP.' });
    }

    if (Date.now() > record.expiresAt) {
      otpStore.delete(phone);
      return res.status(400).json({ success: false, message: 'OTP expired. Please request a new one.' });
    }

    record.attempts += 1;
    if (record.attempts > 5) {
      otpStore.delete(phone);
      return res.status(429).json({ success: false, message: 'Too many attempts. Please request a new OTP.' });
    }

    if (record.otp !== otp) {
      return res.status(400).json({ success: false, message: 'Incorrect OTP. Please try again.' });
    }

    const users = await db.list('users');
    let user = users.find((u) => u.phone === phone);

    // Correct OTP but missing name for a new signup — don't consume the OTP
    // for this, so the customer can just resubmit with a name using the
    // same code instead of waiting for a whole new SMS.
    if (!user && (!name || name.trim().length < 2)) {
      return res.status(400).json({ success: false, message: 'Enter your name.' });
    }

    otpStore.delete(phone);

    let welcomeCoupon = null;

    if (!user) {
      const referrer = referralCode
        ? users.find((u) => u.referralCode === referralCode.trim().toUpperCase())
        : null;

      user = {
        id: uuid(),
        phone,
        name: name.trim(),
        email: '',
        role: phone === (process.env.ADMIN_PHONE || '9999999999') ? 'admin' : 'customer',
        addresses: [],
        referralCode: await generateReferralCode(),
        referredBy: referrer ? referrer.id : null,
        referralRewardIssued: false,
        createdAt: new Date().toISOString(),
      };
      await db.put('users', user);

      if (referrer) {
        welcomeCoupon = await issueWelcomeCoupon(user.id);
      }
    }

    res.json({
      success: true,
      message: 'Logged in successfully.',
      token: signToken(user),
      user,
      ...(welcomeCoupon ? { welcomeCoupon } : {}),
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/me
router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const user = await db.get('users', req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }
    // Backfill for accounts created before the referral program existed.
    if (!user.referralCode) {
      user.referralCode = await generateReferralCode();
      await db.put('users', user);
    }
    res.json({ success: true, user });
  } catch (err) {
    next(err);
  }
});

// PUT /api/auth/me  (update profile - name, email, addresses)
router.put('/me', requireAuth, async (req, res, next) => {
  try {
    const user = await db.get('users', req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }
    const { name, email, addresses } = req.body;
    if (name !== undefined) user.name = name;
    if (email !== undefined) user.email = email;
    if (addresses !== undefined) user.addresses = addresses;
    await db.put('users', user);
    res.json({ success: true, user });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
module.exports.signToken = signToken;
