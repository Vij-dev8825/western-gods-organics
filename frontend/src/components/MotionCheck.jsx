import { useEffect, useState } from 'react';

/** A read-out of the four things that decide whether the product-photo morph
 *  runs, shown only when ?motion-check is in the URL.
 *
 *  It exists because the alternative was another round of me guessing at a
 *  phone I cannot inspect. Three of these four are device settings rather than
 *  anything in the code — Android turns reduced-motion on automatically in
 *  Battery Saver, which silently disables the transition by design — and there
 *  is no way to read them from the outside.
 *
 *  Invisible to customers: it renders nothing at all without the query
 *  parameter, so it costs a mounted component and no markup. Safe to leave in;
 *  delete whenever the question is settled. */
export default function MotionCheck() {
  const [on, setOn] = useState(false);

  useEffect(() => {
    setOn(new URLSearchParams(window.location.search).has('motion-check'));
  }, []);

  if (!on) return null;

  const supportsVT = typeof document.startViewTransition === 'function';
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const supportsTimeline = CSS.supports('animation-timeline: view()');
  const supportsVibrate = typeof navigator.vibrate === 'function';
  // The morph runs only when the API exists AND motion is not being reduced.
  const willMorph = supportsVT && !reduced;

  const chrome = (navigator.userAgent.match(/Chrome\/(\d+)/) || [])[1] || null;

  const row = (label, value, good) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, padding: '5px 0' }}>
      <span>{label}</span>
      <b style={{ color: good ? '#7bd67b' : '#ff9b9b' }}>{value}</b>
    </div>
  );

  return (
    <div
      style={{
        position: 'fixed', left: 10, right: 10, bottom: 10, zIndex: 9999,
        background: 'rgba(12,20,14,0.96)', color: '#eaf3e6',
        border: '1px solid #35492f', borderRadius: 10,
        padding: '14px 16px', font: '13px/1.45 ui-monospace, Menlo, monospace',
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 8 }}>
        Morph will run: <span style={{ color: willMorph ? '#7bd67b' : '#ff9b9b' }}>
          {willMorph ? 'YES' : 'NO'}
        </span>
      </div>
      {row('View Transitions API', supportsVT ? 'supported' : 'MISSING', supportsVT)}
      {row('Reduced motion', reduced ? 'ON — blocks it' : 'off', !reduced)}
      {row('Scroll timeline', supportsTimeline ? 'supported' : 'missing', supportsTimeline)}
      {row('Vibration', supportsVibrate ? 'supported' : 'missing', supportsVibrate)}
      {row('Chrome', chrome || 'not Chrome', chrome ? Number(chrome) >= 111 : false)}
      <div style={{ marginTop: 8, opacity: 0.6, fontSize: 11, wordBreak: 'break-all' }}>
        {navigator.userAgent}
      </div>
    </div>
  );
}
