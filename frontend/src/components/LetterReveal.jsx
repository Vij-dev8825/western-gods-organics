const NBSP = String.fromCharCode(160);

/** A headline revealed one letter at a time via CSS animation-delay — plain
 * markup, no JS timers. Meant for a single key phrase, not routine use
 * (Forest Essentials does the same trick with plain CSS on their hero copy;
 * see The Ghani Report). Screen readers get the real text once via a
 * visually-hidden node — the per-letter spans are aria-hidden, since reading
 * a headline out one character at a time would be actively worse than not
 * splitting it at all. */
export default function LetterReveal({ text, as: Tag = 'span', staggerMs = 22, className = '' }) {
  return (
    <Tag className={`letter-reveal ${className}`.trim()}>
      <span className="letter-reveal-chars" aria-hidden="true">
        {Array.from(text).map((ch, i) => (
          <span key={i} style={{ animationDelay: `${i * staggerMs}ms` }}>
            {ch === ' ' ? NBSP : ch}
          </span>
        ))}
      </span>
      <span className="sr-only">{text}</span>
    </Tag>
  );
}
