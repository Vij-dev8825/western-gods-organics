import { useRef, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { useResendCooldown } from '../hooks/useResendCooldown';

function isValidEmailInput(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** A seller-branded entry point to the same OTP login every customer uses —
 * a seller account IS a customer account with the isSeller flag, so there's
 * no separate credential system here, just a separate front door that lands
 * on the seller dashboard instead of the storefront. */
export default function SellerLogin() {
  const [step, setStep] = useState('phone'); // 'phone' | 'otp'
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [channel, setChannel] = useState('sms'); // 'sms' | 'email'
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState(['', '', '', '']);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [devOtp, setDevOtp] = useState('');
  const otpRefs = useRef([]);
  const { secondsLeft, start: startCooldown } = useResendCooldown(30);

  const { login, isLoggedIn } = useAuth();
  const navigate = useNavigate();

  if (isLoggedIn) return <Navigate to="/seller/dashboard" replace />;

  async function handleSendOtp() {
    if (loading) return;
    setError('');
    if (!/^[6-9]\d{9}$/.test(phone)) {
      setError('Enter a valid 10-digit mobile number.');
      return;
    }
    if (channel === 'email' && !isValidEmailInput(email)) {
      setError('Enter a valid email address.');
      return;
    }
    setLoading(true);
    try {
      const data = await api.sendOtp(phone, 'IN', channel, channel === 'email' ? email : undefined);
      setStep('otp');
      setOtp(['', '', '', '']);
      if (data.devOtp) setDevOtp(data.devOtp);
      startCooldown();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp() {
    if (loading) return;
    setError('');
    const code = otp.join('');
    if (code.length !== 4) {
      setError('Enter the 4-digit OTP.');
      return;
    }
    setLoading(true);
    try {
      const data = await api.verifyOtp(phone, code, name);
      login(data.token, data.user);
      navigate('/seller/dashboard', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleOtpChange(i, value) {
    if (!/^\d?$/.test(value)) return;
    const next = [...otp];
    next[i] = value;
    setOtp(next);
    if (value && i < 3) otpRefs.current[i + 1]?.focus();
  }

  function onEnterKey(handler) {
    return (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handler();
      }
    };
  }

  return (
    <div className="admin-login-page">
      <div className="admin-login-card">
        <div className="center" style={{ marginBottom: 18 }}>
          <img src="/favicon.svg" alt="Western Gods Organics" width={52} height={52} />
        </div>
        <span className="eyebrow" style={{ display: 'block', textAlign: 'center' }}>Western Gods Organics</span>
        <h2 className="center" style={{ color: '#fffdf8' }}>
          {step === 'phone' ? 'Seller Login' : 'Verify OTP'}
        </h2>
        <p className="muted center" style={{ marginBottom: 26, color: 'rgba(250,246,236,0.65)' }}>
          {step === 'phone'
            ? 'Sign in to manage your listings and earnings. New here? Sign in and apply to sell.'
            : channel === 'email'
              ? `Enter the 4-digit code sent to ${email}`
              : `Enter the 4-digit code sent to +91 ${phone}`}
        </p>

        {error && <div className="alert alert-error">{error}</div>}
        {devOtp && step === 'otp' && (
          <div className="alert alert-info">Test mode — your OTP is <b>{devOtp}</b></div>
        )}

        {step === 'phone' ? (
          <div>
            <div className="field">
              <label style={{ color: 'rgba(250,246,236,0.85)' }}>Mobile number</label>
              <input
                type="tel"
                inputMode="numeric"
                autoComplete="off"
                placeholder="98765 43210"
                value={phone}
                maxLength={10}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                onKeyDown={onEnterKey(handleSendOtp)}
                autoFocus
              />
            </div>

            <div className="field">
              <label style={{ color: 'rgba(250,246,236,0.85)' }}>Your name</label>
              <input
                autoComplete="off"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={onEnterKey(handleSendOtp)}
                placeholder="Only needed the first time"
              />
            </div>

            <div className="field">
              <label style={{ color: 'rgba(250,246,236,0.85)' }}>Send my code via</label>
              <div className="flex gap-2">
                <label
                  className={`payment-option ${channel === 'sms' ? 'active' : ''}`}
                  style={{ flex: 1, justifyContent: 'center' }}
                  onClick={() => setChannel('sms')}
                >
                  <input type="radio" name="seller-otp-channel" readOnly checked={channel === 'sms'} />
                  Mobile (SMS)
                </label>
                <label
                  className={`payment-option ${channel === 'email' ? 'active' : ''}`}
                  style={{ flex: 1, justifyContent: 'center' }}
                  onClick={() => setChannel('email')}
                >
                  <input type="radio" name="seller-otp-channel" readOnly checked={channel === 'email'} />
                  Email
                </label>
              </div>
            </div>

            {channel === 'email' && (
              <div className="field">
                <label style={{ color: 'rgba(250,246,236,0.85)' }}>Email address</label>
                <input
                  type="email"
                  autoComplete="off"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={onEnterKey(handleSendOtp)}
                  placeholder="you@example.com"
                />
              </div>
            )}

            <button type="button" className="btn btn-gold btn-block" disabled={loading} onClick={handleSendOtp}>
              {loading ? 'Sending OTP…' : 'Send OTP'}
            </button>
          </div>
        ) : (
          <div>
            <div className="field">
              <div className="otp-inputs">
                {otp.map((digit, i) => (
                  <input
                    key={i}
                    ref={(el) => (otpRefs.current[i] = el)}
                    value={digit}
                    maxLength={1}
                    inputMode="numeric"
                    autoComplete="off"
                    onChange={(e) => handleOtpChange(i, e.target.value)}
                    onKeyDown={onEnterKey(handleVerifyOtp)}
                    autoFocus={i === 0}
                  />
                ))}
              </div>
            </div>
            <button type="button" className="btn btn-gold btn-block" disabled={loading} onClick={handleVerifyOtp}>
              {loading ? 'Verifying…' : 'Verify & continue'}
            </button>

            <button
              type="button"
              className="link-btn resend-btn resend-btn-dark"
              disabled={secondsLeft > 0 || loading}
              onClick={handleSendOtp}
            >
              {secondsLeft > 0 ? `Resend OTP in ${secondsLeft}s` : "Didn't get it? Resend OTP"}
            </button>

            <button
              type="button"
              className="btn btn-ghost btn-block"
              style={{ marginTop: 10 }}
              onClick={() => { setStep('phone'); setOtp(['', '', '', '']); setError(''); setDevOtp(''); }}
            >
              Change mobile number
            </button>
          </div>
        )}

        <p className="center" style={{ marginTop: 18, fontSize: '0.85rem', color: 'rgba(250,246,236,0.7)' }}>
          Don't have a seller account? <Link to="/seller/register" style={{ color: 'var(--gold-2)' }}>Apply to sell</Link>
        </p>
        <Link to="/seller" className="admin-login-back">← Back to Seller Central</Link>
      </div>
    </div>
  );
}
