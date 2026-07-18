import { useRef, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useResendCooldown } from '../../hooks/useResendCooldown';

export default function AdminLogin() {
  const [step, setStep] = useState('phone'); // 'phone' | 'otp'
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState(['', '', '', '']);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [devOtp, setDevOtp] = useState('');
  const otpRefs = useRef([]);
  const { secondsLeft, start: startCooldown } = useResendCooldown(30);

  const { login, isLoggedIn, user } = useAuth();
  const navigate = useNavigate();

  // Already an authenticated admin — skip straight to the dashboard.
  if (isLoggedIn && user?.role === 'admin') {
    return <Navigate to="/admin" replace />;
  }

  async function handleSendOtp() {
    if (loading) return;
    setError('');
    if (!/^[6-9]\d{9}$/.test(phone)) {
      setError('Enter a valid 10-digit mobile number.');
      return;
    }
    setLoading(true);
    try {
      const data = await api.sendOtp(phone);
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
      const data = await api.verifyOtp(phone, code);
      if (data.user.role !== 'admin') {
        setError('This mobile number is not registered for admin access.');
        return;
      }
      login(data.token, data.user);
      navigate('/admin', { replace: true });
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
    <div className="admin-login-page">
      <div className="admin-login-card">
        <div className="center" style={{ marginBottom: 18 }}>
          <img src="/favicon.svg" alt="Western Gods Organics" width={52} height={52} />
        </div>
        <span className="eyebrow" style={{ display: 'block', textAlign: 'center' }}>Western Gods Organics</span>
        <h2 className="center" style={{ color: '#fffdf8' }}>
          {step === 'phone' ? 'Admin Login' : 'Verify OTP'}
        </h2>
        <p className="muted center" style={{ marginBottom: 26, color: 'rgba(250,246,236,0.65)' }}>
          {step === 'phone'
            ? 'Restricted access — sign in with your registered admin number.'
            : `Enter the 4-digit code sent to +91 ${phone}`}
        </p>

        {error && <div className="alert alert-error">{error}</div>}
        {devOtp && step === 'otp' && (
          <div className="alert alert-info">Test mode — your OTP is <b>{devOtp}</b></div>
        )}

        {step === 'phone' ? (
          <div>
            <div className="field">
              <label style={{ color: 'rgba(250,246,236,0.85)' }}>Admin mobile number</label>
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
              onClick={handleChangeNumber}
            >
              Change mobile number
            </button>
          </div>
        )}

        <Link to="/" className="admin-login-back">← Back to store</Link>
      </div>
    </div>
  );
}
