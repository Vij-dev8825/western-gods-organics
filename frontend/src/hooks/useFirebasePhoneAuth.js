import { useRef, useState } from 'react';
import { RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';
import { firebaseAuth } from '../utils/firebase';

const FRIENDLY_ERRORS = {
  'auth/invalid-phone-number': 'Enter a valid phone number.',
  'auth/too-many-requests': 'Too many attempts from this device. Please try again later.',
  'auth/invalid-verification-code': 'Incorrect OTP. Please try again.',
  'auth/code-expired': 'OTP expired. Please request a new one.',
  'auth/network-request-failed': 'Network error — check your connection and try again.',
};

function friendlyError(err) {
  return FRIENDLY_ERRORS[err.code] || err.message || 'Something went wrong. Please try again.';
}

/** Wraps Firebase's phone-auth flow (invisible reCAPTCHA + SMS + code
 * confirmation) behind a simple sendCode/confirmCode shape, so Login.jsx and
 * AdminLogin.jsx barely differ from the old custom-OTP version. `containerId`
 * must match a <div id={containerId} /> rendered in the page. */
export function useFirebasePhoneAuth(containerId) {
  const confirmationRef = useRef(null);
  const verifierRef = useRef(null);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);

  function getVerifier() {
    if (!verifierRef.current) {
      verifierRef.current = new RecaptchaVerifier(firebaseAuth, containerId, { size: 'invisible' });
    }
    return verifierRef.current;
  }

  async function sendCode(e164Phone) {
    setSending(true);
    try {
      confirmationRef.current = await signInWithPhoneNumber(firebaseAuth, e164Phone, getVerifier());
    } catch (err) {
      throw new Error(friendlyError(err));
    } finally {
      setSending(false);
    }
  }

  async function confirmCode(code) {
    setVerifying(true);
    try {
      if (!confirmationRef.current) throw new Error('Please request a new OTP.');
      const result = await confirmationRef.current.confirm(code);
      return result.user.getIdToken();
    } catch (err) {
      throw new Error(err.code ? friendlyError(err) : err.message);
    } finally {
      setVerifying(false);
    }
  }

  function reset() {
    confirmationRef.current = null;
    verifierRef.current?.clear();
    verifierRef.current = null;
  }

  return { sendCode, confirmCode, reset, sending, verifying };
}
