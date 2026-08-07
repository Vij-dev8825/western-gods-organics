import { useEffect, useRef, useState } from 'react';

/** Fades + slides children up the first time they scroll into view, via
 * IntersectionObserver so sections off-screen cost nothing until they're
 * near the viewport. Unobserves after the first reveal — a section
 * shouldn't hide again just because the user scrolled past it — and skips
 * the animation entirely under prefers-reduced-motion. */
export default function Reveal({ children, className = '', as: Tag = 'div', delay = 0, style, ...rest }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setVisible(true);
      return undefined;
    }
    const el = ref.current;
    if (!el) return undefined;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.unobserve(el);
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -60px 0px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

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
