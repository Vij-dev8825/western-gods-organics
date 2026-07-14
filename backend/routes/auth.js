const express = require('express');
const jwt = require('jsonwebtoken');
const { v4: uuid } = require('uuid');
const db = require('../data/db');
const { requireAuth } = require('../middleware/auth');
const { sendOtpSms } = require('../utils/sms');

const router = express.Router();

// In-memory OTP store: { [phone]: { otp, expiresAt, attempts } }
const otpStore = new Map();

const OTP_EXPIRY_MS = (parseInt(process.env.OTP_EXPIRY_MINUTES, 10) || 5) * 60 * 1000;

function generateOtp() {
  return String(Math.floor(1000 + Math.random() * 9000)); // 4-digit OTP
}

function isValidPhone(phone) {
  return /^[6-9]\d{9}$/.test(phone); // Indian 10-digit mobile format
}

function signToken(user) {
  return jwt.sign(
    { id: user.id, phone: user.phone, role: user.role || 'customer' },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '30d' }
  );
}

// POST /api/auth/send-otp  { phone }
router.post('/send-otp', async (req, res, next) => {
  try {
    const { phone } = req.body;

    if (!phone || !isValidPhone(phone)) {
      return res.status(400).json({ success: false, message: 'Enter a valid 10-digit mobile number.' });
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

// POST /api/auth/verify-otp  { phone, otp, name? }
router.post('/verify-otp', async (req, res, next) => {
  try {
    const { phone, otp, name } = req.body;

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

    otpStore.delete(phone);

    const users = await db.list('users');
    let user = users.find((u) => u.phone === phone);

    if (!user) {
      user = {
        id: uuid(),
        phone,
        name: name || '',
        email: '',
        role: phone === (process.env.ADMIN_PHONE || '9999999999') ? 'admin' : 'customer',
        addresses: [],
        createdAt: new Date().toISOString(),
      };
      await db.put('users', user);
    }

    res.json({ success: true, message: 'Logged in successfully.', token: signToken(user), user });
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
