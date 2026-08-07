import { useReveal } from '../hooks/useReveal';

/** Fades + slides children up the first time they scroll into view. See
 * useReveal for the observer mechanics; this just renders the wrapper. */
export default function Reveal({ children, className = '', as: Tag = 'div', delay = 0, style, ...rest }) {
  const { ref, visible } = useReveal();

  return (
    <Tag
      ref={ref}
      className={`reveal ${visible ? 'reveal-visible' : ''} ${className}`.trim()}
      style={delay ? { transitionDelay: `${delay}ms`, ...style } : style}
      {...rest}
    >
      {children}
    </Tag>
  );
}
