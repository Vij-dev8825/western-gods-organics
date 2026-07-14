import { useEffect, useRef, useState } from 'react';

/** Countdown timer for "Resend OTP in Ns" — call start() after each send. */
export function useResendCooldown(seconds = 30) {
  const [secondsLeft, setSecondsLeft] = useState(0);
  const intervalRef = useRef(null);

  function start() {
    clearInterval(intervalRef.current);
    setSecondsLeft(seconds);
    intervalRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(intervalRef.current);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  }

  useEffect(() => () => clearInterval(intervalRef.current), []);

  return { secondsLeft, start };
}
