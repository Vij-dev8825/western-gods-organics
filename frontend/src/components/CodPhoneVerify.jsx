import { useEffect, useState } from 'react';
import { api } from '../api';
import { useResendCooldown } from '../hooks/useResendCooldown';

/** Gate for guest Cash-on-Delivery checkout — requires proving ownership of
 * the delivery phone via OTP before a COD order can be placed. Guests are
 * the one checkout path with no account history behind them, so this is
 * the highest-value place to stop fake/prank COD orders; logged-in
 * customers already proved phone ownership once at signup, and prepaid
 * orders are already trust-gated by a captured payment. */
export default function CodPhoneVerify({ phone, country, verified, onVerified }) {
  const [sent, setSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [devOtp, setDevOtp] = useState('');
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');
  const { secondsLeft, start: startCooldown } = useResendCooldown(30);

  // The delivery phone changed since the last send/verify — that proof no
  // longer applies to this number, so drop back to the initial state.
  useEffect(() => {
    setSent(false);
    setOtp('');
    setDevOtp('');
    setError('');
  }, [phone]);

  async function handleSend() {
    setError('');
    if (!phone) {
      setError('Enter your delivery phone number first.');
      return;
    }
    setSending(true);
    try {
      const data = await api.sendOtp(phone, country, 'whatsapp');
      setSent(true);
      setOtp('');
      if (data.devOtp) setDevOtp(data.devOtp);
      startCooldown();
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  async function handleVerify() {
    if (otp.length !== 4) {
      setError('Enter the 4-digit code.');
      return;
    }
    setVerifying(true);
    setError('');
    try {
      await api.verifyCodPhone(phone, otp);
      onVerified(phone);
    } catch (err) {
      setError(err.message);
    } finally {
      setVerifying(false);
    }
  }

  if (verified) {
    return <div className="alert alert-info cod-verify-done">✅ Phone verified for Cash on Delivery</div>;
  }

  return (
    <div className="cod-verify">
      <p className="muted" style={{ fontSize: '0.85rem', marginBottom: 10 }}>
        To prevent fake orders, please verify your phone number before placing a Cash on Delivery order.
      </p>
      {error && <div className="field-error" style={{ marginBottom: 8 }}>{error}</div>}
      {devOtp && (
        <div className="alert alert-info" style={{ marginBottom: 8 }}>
          Test mode — your code is <b>{devOtp}</b>
        </div>
      )}
      {!sent ? (
        <button type="button" className="btn btn-outline btn-sm" disabled={sending} onClick={handleSend}>
          {sending ? 'Sending…' : 'Send verification code'}
        </button>
      ) : (
        <div className="cod-verify-otp-row">
          <input
            className="cod-verify-otp-input"
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 4))}
            maxLength={4}
            inputMode="numeric"
            placeholder="Code"
          />
          <button type="button" className="btn btn-gold btn-sm" disabled={verifying} onClick={handleVerify}>
            {verifying ? 'Verifying…' : 'Verify'}
          </button>
          <button type="button" className="link-btn" disabled={secondsLeft > 0 || sending} onClick={handleSend}>
            {secondsLeft > 0 ? `Resend in ${secondsLeft}s` : 'Resend'}
          </button>
        </div>
      )}
    </div>
  );
}
