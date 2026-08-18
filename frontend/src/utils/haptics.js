/* A short haptic tick for the moments where something is actually committed.
 *
 * On a phone this is the difference between a tap and a press: the screen
 * confirms with a picture, the hand confirms with a click. It is the cheapest
 * piece of polish in the codebase and one of the few that registers below
 * conscious attention.
 *
 * Deliberately NOT gated on prefers-reduced-motion. Android already has a
 * system-level "touch vibration" setting, and navigator.vibrate is a no-op
 * when it is off — so the person has already answered this question at the OS
 * level, where it belongs. Gating again on a *motion* preference would
 * silently override a haptic setting they explicitly turned on.
 *
 * iOS Safari does not implement the Vibration API at all, so this is inert
 * there rather than broken; nothing depends on it firing.
 */

/** Coarse pointer means a finger. A desktop browser can expose vibrate()
 *  without any hardware behind it, and buzzing a laptop trackpad on add-to-cart
 *  is not the intention. */
function isTouchDevice() {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(pointer: coarse)').matches
  );
}

function buzz(pattern) {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
  if (!isTouchDevice()) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    // Some browsers throw if the page has never been interacted with. A failed
    // buzz must never take a cart action down with it.
  }
}

/** Something was added, saved, or accepted. Short enough to read as a click
 *  rather than an alert — anything past ~20ms starts to feel like an error. */
export function hapticTap() {
  buzz(10);
}

/** Reserved for the end of a flow worth marking — an order placed. Two light
 *  pulses read as "done", where one longer buzz reads as "something's wrong". */
export function hapticSuccess() {
  buzz([12, 60, 18]);
}
