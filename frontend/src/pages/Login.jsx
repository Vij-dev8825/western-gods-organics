import { useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useCurrency } from '../context/CurrencyContext';
import { useResendCooldown } from '../hooks/useResendCooldown';
import logo from '../assets/logo.svg';

function isValidPhoneInput(phone, country) {
  if (country === 'IN') return /^[6-9]\d{9}$/.test(phone);
  return /^\+\d{6,15}$/.test(phone.replace(/[\s-]/g, ''));
}

export default function Login() {
  const { country, countries } = useCurrency();
  const [step, setStep] = useState('phone'); // 'phone' | 'otp'
  const [phoneCountry, setPhoneCountry] = useState(country.code);
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState(['', '', '', '']);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [devOtp, setDevOtp] = useState('');
  const otpRefs = useRef([]);
  const { secondsLeft, start: startCooldown } = useResendCooldown(30);

  const { login } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const referralCode = searchParams.get('ref') || undefined;
  const redirectTo = location.state?.from || '/';
  const redirectState = location.state?.buyNow ? { buyNow: location.state.buyNow } : undefined;

  const isIndia = phoneCountry === 'IN';
  // Normalized form actually sent to the API — India stays bare digits;
  // everything else must be the full "+"-prefixed number with no spaces/
  // hyphens (matches auth.js's isValidPhone and sms.js's routing check).
  const apiPhone = isIndia ? phone : phone.replace(/[\s-]/g, '');

  // Deliberately NOT wired to a <form onSubmit> — mobile Chrome ignores
  // autocomplete="off" on phone fields and can both autofill AND
  // auto-dispatch a native form "submit" event after doing so, silently
  // resubmitting a stale number. Requiring an explicit button click (or the
  // Enter-key handler below) sidesteps that vector entirely.
  async function handleSendOtp() {
    if (loading) return;
    setError('');
    if (!isValidPhoneInput(phone, phoneCountry)) {
      setError(
        isIndia
          ? 'Enter a valid 10-digit mobile number.'
          : 'Enter a valid phone number with your country code (e.g. +1 555 123 4567).'
      );
      return;
    }
    if (name.trim().length < 2) {
      setError('Enter your name.');
      return;
    }
    setLoading(true);
    try {
      const data = await api.sendOtp(apiPhone, phoneCountry);
      setStep('otp');
      setOtp(['', '', '', '']);
      if (data.devOtp) setDevOtp(data.devOtp);
      showToast('OTP sent to your mobile number.');
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
      const data = await api.verifyOtp(apiPhone, code, name, referralCode);
      login(data.token, data.user);
      showToast(
        data.welcomeCoupon
          ? `Welcome${data.user.name ? `, ${data.user.name}` : ''}! Use code ${data.welcomeCoupon.code} for ₹${data.welcomeCoupon.value} off your first order.`
          : `Welcome${data.user.name ? `, ${data.user.name}` : ''}!`
      );
      navigate(redirectTo, { replace: true, state: redirectState });
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

  function handleChangeNumber() {
    setStep('phone');
    setPhone('');
    setOtp(['', '', '', '']);
    setError('');
    setDevOtp('');
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
    <div className="container section">
      <div className="form-card">
        <div className="center" style={{ marginBottom: 20 }}>
          <img src={logo} alt="Western Gods Organics" height={48} />
        </div>
        <h2 className="center">{step === 'phone' ? 'Log in / Sign up' : 'Verify OTP'}</h2>
        <p className="muted center" style={{ marginBottom: 26 }}>
          {step === 'phone'
            ? 'We will send a one-time password to your mobile number.'
            : `Enter the 4-digit code sent to ${isIndia ? `+91 ${phone}` : apiPhone}`}
        </p>

        {referralCode && step === 'phone' && (
          <div className="alert alert-info">
            🎁 Referred by a friend — sign up now and get ₹100 off your first order!
          </div>
        )}
        {error && <div className="alert alert-error">{error}</div>}
        {devOtp && step === 'otp' && (
          <div className="alert alert-info">Test mode — your OTP is <b>{devOtp}</b></div>
        )}

        {step === 'phone' ? (
          <div>
            <div className="field">
              <label>Country</label>
              <select value={phoneCountry} onChange={(e) => setPhoneCountry(e.target.value)}>
                {countries.map((c) => (
                  <option key={c.code} value={c.code}>{c.label}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Mobile number</label>
              <input
                type="tel"
                inputMode={isIndia ? 'numeric' : 'tel'}
                autoComplete="off"
                placeholder={isIndia ? '98765 43210' : '+1 555 123 4567'}
                value={phone}
                maxLength={isIndia ? 10 : 17}
                onChange={(e) => setPhone(
                  isIndia
                    ? e.target.value.replace(/\D/g, '')
                    : e.target.value.replace(/[^\d+\s-]/g, '')
                )}
                onKeyDown={onEnterKey(handleSendOtp)}
              />
            </div>
            <div className="field">
              <label>Your name</label>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={onEnterKey(handleSendOtp)}
                placeholder="e.g. Priya Sharma"
              />
            </div>
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
              className="link-btn resend-btn"
              disabled={secondsLeft > 0 || loading}
              onClick={handleSendOtp}
            >
              {secondsLeft > 0 ? `Resend OTP in ${secondsLeft}s` : "Didn't get it? Resend OTP"}
            </button>

            <button
              type="button"
              className="btn btn-ghost btn-block"
              style={{ marginTop: 10 }}
              onClick={handleChangeNumber}
            >
              Change mobile number
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
