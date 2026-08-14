/**
 * "Is this actually a number, or is it just missing?"
 *
 * Written down once because JavaScript answers it badly and the wrong answer
 * is expensive here. `Number(null)` is 0, not NaN — and so is `Number('')` —
 * so the obvious test, `Number.isFinite(Number(v))`, calls a missing value a
 * real zero. That is precisely backwards for the fields it gets used on:
 * a cost of null means "nobody recorded it", a cost of 0 means "free". The
 * product routes store null for every field an admin leaves blank, so the
 * naive test would quietly treat every uncosted product as free to make and
 * overstate profit — the one failure the profit report exists to avoid.
 */

/** The number, or null when the value is absent or not numeric. A genuine 0
 *  comes back as 0, which is the whole point of not using a falsy check. */
function finiteOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** True only for a value that is really a number — including 0. */
const isNumber = (value) => finiteOrNull(value) !== null;

module.exports = { finiteOrNull, isNumber };
