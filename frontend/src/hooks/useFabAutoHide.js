import { useEffect } from 'react';

// Small scrolls are jitter, not intent — a thumb resting on a moving page
// shouldn't make the buttons flicker.
const MOVE_THRESHOLD_PX = 8;
// Long enough that they don't flash back mid-flick, short enough that they
// feel present the instant someone stops to read.
const RETURN_AFTER_MS = 220;
// Above this the header is still on screen and nothing is being covered yet.
const IGNORE_ABOVE_PX = 60;

/** Steps the three floating buttons out of the way while the page is scrolling
 *  down, and brings them back when it stops or reverses.
 *
 *  They sit a fixed distance from the bottom corners, so on a short phone —
 *  where Safari's toolbar leaves about 590px of usable height — that is
 *  exactly where the hero's "Shop all products" and "Enquire in bulk" land
 *  after a small scroll. Two contact buttons covering the two buy buttons.
 *
 *  Nothing is removed: every channel stays reachable. They are simply not in
 *  front of anything at the moment somebody is trying to read it. Scrolling
 *  up brings them straight back, because heading upward usually means heading
 *  for help.
 *
 *  Only the CSS is phone-scoped; this hook can run anywhere and costs a
 *  passive listener. */
export function useFabAutoHide() {
  useEffect(() => {
    let last = window.scrollY;
    let idle;

    const show = () => document.body.classList.remove('fabs-hidden');

    const onScroll = () => {
      const y = window.scrollY;
      const delta = y - last;
      if (Math.abs(delta) > MOVE_THRESHOLD_PX) {
        document.body.classList.toggle('fabs-hidden', delta > 0 && y > IGNORE_ABOVE_PX);
        last = y;
      }
      clearTimeout(idle);
      idle = setTimeout(show, RETURN_AFTER_MS);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      clearTimeout(idle);
      // Never leave them stranded invisible if this unmounts mid-scroll.
      show();
    };
  }, []);
}
