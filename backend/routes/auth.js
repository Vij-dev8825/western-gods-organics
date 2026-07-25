const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { v4: uuid } = require('uuid');
const db = require('../data/db');
const { requireAuth } = require('../middleware/auth');
const { verifyIdToken } = require('../utils/firebaseAdmin');

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

function signToken(user) {
  return jwt.sign(
    { id: user.id, phone: user.phone, role: user.role || 'customer' },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '30d' }
  );
}

// POST /api/auth/firebase-login  { idToken, name?, referralCode? }
// idToken comes from the frontend's Firebase phone-auth flow (see
// hooks/useFirebasePhoneAuth.js) — Firebase itself generates and verifies the
// OTP client-side; this route just verifies the resulting token server-side
// and resolves/creates the matching account, same as the old verify-otp did.
router.post('/firebase-login', async (req, res, next) => {
  try {
    const { idToken, name, referralCode } = req.body;

    if (!idToken) {
      return res.status(400).json({ success: false, message: 'Missing verification token.' });
    }

    let decoded;
    try {
      decoded = await verifyIdToken(idToken);
    } catch (err) {
      return res.status(err.status || 401).json({
        success: false,
        message: err.status === 503 ? err.message : 'Could not verify your phone number. Please try again.',
      });
    }

    const rawPhone = decoded.phone_number; // E.164, e.g. +919876543210
    if (!rawPhone) {
      return res.status(400).json({ success: false, message: 'No verified phone number found.' });
    }

    // Existing accounts store Indian numbers as bare 10 digits (pre-Firebase
    // convention) — normalize so returning customers still match their
    // account instead of silently getting a duplicate. Every other country
    // keeps the full "+"-prefixed E.164 form, same as before.
    const indiaMatch = rawPhone.match(/^\+91([6-9]\d{9})$/);
    const phone = indiaMatch ? indiaMatch[1] : rawPhone;

    const users = await db.list('users');
    let user = users.find((u) => u.phone === phone);

    if (!user && (!name || name.trim().length < 2)) {
      return res.status(400).json({ success: false, message: 'Enter your name.' });
    }

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
