import { Fragment } from 'react';

/** A headline revealed one letter at a time via CSS animation-delay — plain
 * markup, no JS timers. Meant for a single key phrase, not routine use
 * (Forest Essentials does the same trick with plain CSS on their hero copy;
 * see The Ghani Report). Screen readers get the real text once via a
 * visually-hidden node — the per-letter spans are aria-hidden, since reading
 * a headline out one character at a time would be actively worse than not
 * splitting it at all.
 *
 * Each word is wrapped in its own `white-space: nowrap` span so the line can
 * only break BETWEEN words, never between two letters of the same word. The
 * per-letter spans need `display: inline-block` for the rise transform to
 * apply at all (transforms don't affect plain inline boxes) — but a run of
 * adjacent inline-block boxes is independently breakable in every browser,
 * so without the nowrap wrapper a long title wraps wherever it runs out of
 * width, letter by letter, not at an actual word boundary. */
export default function LetterReveal({ text, as: Tag = 'span', staggerMs = 22, className = '' }) {
  const words = text.split(' ');
  let i = 0;
  return (
    <Tag className={`letter-reveal ${className}`.trim()}>
      <span className="letter-reveal-chars" aria-hidden="true">
        {words.map((word, wi) => {
          const letters = Array.from(word).map((ch, ci) => {
            const delay = i * staggerMs;
            i += 1;
            return (
              <span key={ci} style={{ animationDelay: `${delay}ms` }}>
                {ch}
              </span>
            );
          });
          i += 1; // keeps the stagger timing continuous across the space too
          return (
            <Fragment key={wi}>
              <span className="letter-reveal-word">{letters}</span>
              {wi < words.length - 1 ? ' ' : ''}
            </Fragment>
          );
        })}
      </span>
      <span className="sr-only">{text}</span>
    </Tag>
  );
}
