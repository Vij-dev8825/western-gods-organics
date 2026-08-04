import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useResendCooldown } from '../../hooks/useResendCooldown';
import ChakkiWheel from '../../components/ChakkiWheel';
import SeoMeta from '../../components/SeoMeta';

function isValidEmailInput(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** Self-contained seller signup: verify a phone/email by OTP, then submit the
 * business application — all inside the seller site, never routing through the
 * customer storefront. An account created here is an ordinary customer account
 * that gains isSeller once approved (see backend/routes/sellerPortal.js). */
export default function SellerRegister() {
  const { login, isLoggedIn, token, user } = useAuth();
  const navigate = useNavigate();

  // 'phone' | 'otp' -> account exists; then 'apply' -> business details.
  const [step, setStep] = useState(isLoggedIn ? 'apply' : 'phone');
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [channel, setChannel] = useState('sms');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState(['', '', '', '']);
  const [devOtp, setDevOtp] = useState('');
  const otpRefs = useRef([]);
  const { secondsLeft, start: startCooldown } = useResendCooldown(30);

  const [business, setBusiness] = useState({ businessName: '', phone: '', whatTheySell: '' });
  const [status, setStatus] = useState(null); // existing application status, once known
  const [checking, setChecking] = useState(isLoggedIn);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Someone arriving already logged in may already be a seller, or may have an
  // application in flight — check before showing them the form again.
  useEffect(() => {
    if (!isLoggedIn || !token) return;
    setChecking(true);
    api.seller
      .getMe(token)
      .then((d) => {
        setStatus(d.status);
        if (d.status === 'none' || d.status === 'rejected') setStep('apply');
      })
      .catch(() => setStep('apply'))
      .finally(() => setChecking(false));
  }, [isLoggedIn, token]);

  useEffect(() => {
    if (user?.phone) setBusiness((b) => (b.phone ? b : { ...b, phone: user.phone }));
  }, [user?.phone]);

  if (status === 'approved') return <Navigate to="/seller/dashboard" replace />;

  async function handleSendOtp() {
    if (loading) return;
    setError('');
    if (!/^[6-9]\d{9}$/.test(phone)) return setError('Enter a valid 10-digit mobile number.');
    if (channel === 'email' && !isValidEmailInput(email)) return setError('Enter a valid email address.');
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
    if (code.length !== 4) return setError('Enter the 4-digit OTP.');
    setLoading(true);
    try {
      const data = await api.verifyOtp(phone, code, name);
      login(data.token, data.user);
      setBusiness((b) => ({ ...b, phone: b.phone || data.user.phone }));
      setStep('apply');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function submitApplication(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.seller.apply(token, business);
      setStatus('pending');
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

  if (checking) {
    return (
      <div className="center" style={{ padding: '120px 0' }}>
        <ChakkiWheel size={56} />
      </div>
    );
  }

  if (status === 'pending') {
    return (
      <div className="seller-form-page">
        <SeoMeta title="Application received — Seller Central" path="/seller/register" />
        <div className="empty-state">
          <ChakkiWheel size={56} spin={false} />
          <h2>Application received</h2>
          <p className="muted" style={{ maxWidth: 460 }}>
            Thanks for applying. We review every seller application by hand — usually within a few business
            days — and we'll email you the moment there's news.
          </p>
          <Link to="/seller" className="btn btn-outline btn-sm">Back to Seller Central</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="seller-form-page">
      <SeoMeta
        title="Start selling — Seller Central | Western Gods Organics"
        description="Create your seller account and apply to list your products on Western Gods Organics."
        path="/seller/register"
      />

      <div className="seller-form-head">
        <span className="eyebrow">Seller Central</span>
        <h1>Start selling</h1>
        <ol className="seller-progress">
          <li className={step !== 'apply' ? 'active' : 'done'}>1. Verify your number</li>
          <li className={step === 'apply' ? 'active' : ''}>2. Tell us about your business</li>
        </ol>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {devOtp && step === 'otp' && <div className="alert alert-info">Test mode — your OTP is <b>{devOtp}</b></div>}

      {step === 'phone' && (
        <div className="form-card">
          <p className="muted" style={{ marginTop: 0 }}>
            We'll send a one-time code to confirm it's really you. Already applied?{' '}
            <Link to="/seller/login">Log in instead</Link>.
          </p>
          <div className="field">
            <label>Mobile number</label>
            <input
              type="tel"
              inputMode="numeric"
              placeholder="98765 43210"
              value={phone}
              maxLength={10}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
              onKeyDown={onEnterKey(handleSendOtp)}
              autoFocus
            />
          </div>
          <div className="field">
            <label>Your name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={onEnterKey(handleSendOtp)} />
          </div>
          <div className="field">
            <label>Send my code via</label>
            <div className="flex gap-2">
              <label className={`payment-option ${channel === 'sms' ? 'active' : ''}`} style={{ flex: 1, justifyContent: 'center' }} onClick={() => setChannel('sms')}>
                <input type="radio" name="reg-channel" readOnly checked={channel === 'sms'} /> Mobile (SMS)
              </label>
              <label className={`payment-option ${channel === 'email' ? 'active' : ''}`} style={{ flex: 1, justifyContent: 'center' }} onClick={() => setChannel('email')}>
                <input type="radio" name="reg-channel" readOnly checked={channel === 'email'} /> Email
              </label>
            </div>
          </div>
          {channel === 'email' && (
            <div className="field">
              <label>Email address</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={onEnterKey(handleSendOtp)} placeholder="you@example.com" />
            </div>
          )}
          <button type="button" className="btn btn-gold" disabled={loading} onClick={handleSendOtp}>
            {loading ? 'Sending OTP…' : 'Send OTP'}
          </button>
        </div>
      )}

      {step === 'otp' && (
        <div className="form-card">
          <p className="muted" style={{ marginTop: 0 }}>
            {channel === 'email' ? `Enter the 4-digit code sent to ${email}` : `Enter the 4-digit code sent to +91 ${phone}`}
          </p>
          <div className="field">
            <div className="otp-inputs">
              {otp.map((digit, i) => (
                <input
                  key={i}
                  ref={(el) => (otpRefs.current[i] = el)}
                  value={digit}
                  maxLength={1}
                  inputMode="numeric"
                  onChange={(e) => handleOtpChange(i, e.target.value)}
                  onKeyDown={onEnterKey(handleVerifyOtp)}
                  autoFocus={i === 0}
                />
              ))}
            </div>
          </div>
          <button type="button" className="btn btn-gold" disabled={loading} onClick={handleVerifyOtp}>
            {loading ? 'Verifying…' : 'Verify & continue'}
          </button>
          <button type="button" className="link-btn resend-btn" disabled={secondsLeft > 0 || loading} onClick={handleSendOtp}>
            {secondsLeft > 0 ? `Resend OTP in ${secondsLeft}s` : "Didn't get it? Resend OTP"}
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setStep('phone'); setOtp(['', '', '', '']); setError(''); setDevOtp(''); }}>
            Change mobile number
          </button>
        </div>
      )}

      {step === 'apply' && (
        <form className="form-card" onSubmit={submitApplication}>
          {status === 'rejected' && (
            <div className="alert alert-error">
              Your last application wasn't approved. You're welcome to apply again with more detail below.
            </div>
          )}
          <p className="muted" style={{ marginTop: 0 }}>
            Last step — tell us who you are and what you make. No company, GST or licence needed to start.
          </p>
          <div className="field">
            <label>Your name, or your farm's name</label>
            <input
              value={business.businessName}
              onChange={(e) => setBusiness((b) => ({ ...b, businessName: e.target.value }))}
              placeholder="e.g. Muthu, or Muthu Family Oil Press"
              required
              autoFocus
            />
            <p className="muted" style={{ fontSize: '0.78rem', marginTop: 4 }}>
              This is what shoppers see on your products. Your own name is perfectly fine — you don't need a
              company.
            </p>
          </div>
          <div className="field">
            <label>Contact phone</label>
            <input
              value={business.phone}
              onChange={(e) => setBusiness((b) => ({ ...b, phone: e.target.value }))}
              placeholder={user?.phone}
            />
          </div>
          <div className="field">
            <label>What will you sell?</label>
            <textarea
              rows={4}
              value={business.whatTheySell}
              onChange={(e) => setBusiness((b) => ({ ...b, whatTheySell: e.target.value }))}
              placeholder="Tell us what you make, how you make it, and roughly how much you can supply."
              required
            />
          </div>
          <button className="btn btn-gold" disabled={loading}>
            {loading ? 'Submitting…' : 'Submit application'}
          </button>
        </form>
      )}
    </div>
  );
}
