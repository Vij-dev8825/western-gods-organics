import { useEffect, useState } from 'react';

const COLORS = ['var(--gold-1)', 'var(--gold-2)', 'var(--gold-3)', '#e0b354', '#d1495b', '#3a5f42'];
const PARTICLE_COUNT = 40;
const DURATION_MS = 2600;

/** One-shot confetti burst for a success moment (e.g. order placed). Plain
 * CSS/DOM particles, no canvas or animation library, matching how every
 * other animation in this app is built. Mount with a stable `key` tied to
 * the event it celebrates so it doesn't replay on every re-render while
 * that event's data stays on screen. */
export default function Confetti() {
  const [visible, setVisible] = useState(true);
  const [particles] = useState(() =>
    Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 300,
      duration: 1800 + Math.random() * 900,
      rotate: Math.round(Math.random() * 360),
      color: COLORS[i % COLORS.length],
      drift: Math.round((Math.random() - 0.5) * 120),
    }))
  );

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setVisible(false);
      return undefined;
    }
    const timer = setTimeout(() => setVisible(false), DURATION_MS);
    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <div className="confetti-burst" aria-hidden="true">
      {particles.map((p) => (
        <span
          key={p.id}
          className="confetti-piece"
          style={{
            left: `${p.left}%`,
            backgroundColor: p.color,
            animationDelay: `${p.delay}ms`,
            animationDuration: `${p.duration}ms`,
            '--drift': `${p.drift}px`,
            '--rotate': `${p.rotate}deg`,
          }}
        />
      ))}
    </div>
  );
}
