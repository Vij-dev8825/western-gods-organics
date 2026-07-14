import { useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import ChakkiWheel from '../components/ChakkiWheel';

export default function Login() {
  const [step, setStep] = useState('phone'); // 'phone' | 'otp'
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState(['', '', '', '']);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [devOtp, setDevOtp] = useState('');
  const otpRefs = useRef([]);

  const { login } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = location.state?.from || '/';

  async function handleSendOtp(e) {
    e.preventDefault();
    setError('');
    if (!/^[6-9]\d{9}$/.test(phone)) {
      setError('Enter a valid 10-digit mobile number.');
      return;
    }
    setLoading(true);
    try {
      const data = await api.sendOtp(phone);
      setStep('otp');
      if (data.devOtp) setDevOtp(data.devOtp);
      showToast('OTP sent to your mobile number.');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(e) {
    e.preventDefault();
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
      showToast(`Welcome${data.user.name ? `, ${data.user.name}` : ''}!`);
      navigate(redirectTo, { replace: true });
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

  return (
    <div className="container section">
      <div className="form-card">
        <div className="center" style={{ marginBottom: 20 }}>
          <ChakkiWheel size={50} />
        </div>
        <h2 className="center">{step === 'phone' ? 'Log in / Sign up' : 'Verify OTP'}</h2>
        <p className="muted center" style={{ marginBottom: 26 }}>
          {step === 'phone'
            ? 'We will send a one-time password to your mobile number.'
            : `Enter the 4-digit code sent to +91 ${phone}`}
        </p>

        {error && <div className="alert alert-error">{error}</div>}
        {devOtp && step === 'otp' && (
          <div className="alert alert-info">Test mode — your OTP is <b>{devOtp}</b></div>
        )}

        {step === 'phone' ? (
          <form onSubmit={handleSendOtp}>
            <div className="field">
              <label>Mobile number</label>
              <input
                type="tel"
                inputMode="numeric"
                autoComplete="off"
                placeholder="98765 43210"
                value={phone}
                maxLength={10}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                autoFocus
              />
            </div>
            <div className="field">
              <label>Your name (optional)</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Priya Sharma" />
            </div>
            <button className="btn btn-gold btn-block" disabled={loading}>
              {loading ? 'Sending OTP…' : 'Send OTP'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp}>
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
                    autoFocus={i === 0}
                  />
                ))}
              </div>
            </div>
            <button className="btn btn-gold btn-block" disabled={loading}>
              {loading ? 'Verifying…' : 'Verify & continue'}
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-block"
              style={{ marginTop: 10 }}
              onClick={handleChangeNumber}
            >
              Change mobile number
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
