/**
 * The game's sound, synthesised rather than downloaded.
 *
 * Laying a flower wants a tick you hear two hundred times without getting sick
 * of it, and a sampled sound file would be both a network request and a licence
 * question. So every noise here is a few WebAudio oscillators: a short
 * sine-plus-triangle pluck tuned to a pentatonic scale, which is why placing
 * flowers in a row comes out sounding like a melody instead of a typewriter.
 *
 * The AudioContext is created lazily on the first sound, because browsers
 * refuse to start one before a user gesture and constructing it at import time
 * just logs a warning and leaves you with a dead context.
 */

let ctx = null;
let master = null;
let enabled = true;

/* Kerala's own scale is roughly a pentatonic, and a pentatonic has no wrong
   two notes — the point is that rapid placement never sounds dissonant. */
const SCALE = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21];
const BASE = 392; // G4

function hz(step) {
  return BASE * Math.pow(2, SCALE[((step % SCALE.length) + SCALE.length) % SCALE.length] / 12);
}

function ac() {
  if (ctx) return ctx;
  const Ctor = window.AudioContext || window.webkitAudioContext;
  if (!Ctor) return null;
  try {
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = 0.18;
    master.connect(ctx.destination);
  } catch {
    ctx = null;
  }
  return ctx;
}

/** One plucked note. `type` shapes the timbre, `dur` the decay. */
function pluck({ freq, when = 0, dur = 0.16, type = 'sine', gain = 1 }) {
  const c = ac();
  if (!c || !master) return;
  const t = c.currentTime + when;
  const osc = c.createOscillator();
  const env = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  env.gain.setValueAtTime(0, t);
  env.gain.linearRampToValueAtTime(gain, t + 0.008);
  env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(env);
  env.connect(master);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

/**
 * Play a named cue. `step` lets the caller walk up the scale — the page passes
 * the flower count, so a pookalam fills in rising pitch.
 */
export function play(name, step = 0) {
  if (!enabled) return;
  const c = ac();
  if (!c) return;
  // A context can be suspended by the browser between gestures.
  if (c.state === 'suspended') c.resume().catch(() => {});

  switch (name) {
    case 'place':
      pluck({ freq: hz(step), dur: 0.14, type: 'sine', gain: 0.9 });
      pluck({ freq: hz(step) * 2, dur: 0.07, type: 'triangle', gain: 0.25 });
      break;
    case 'select':
      pluck({ freq: 660, dur: 0.06, type: 'triangle', gain: 0.4 });
      break;
    case 'delete':
      pluck({ freq: 300, dur: 0.12, type: 'sawtooth', gain: 0.28 });
      pluck({ freq: 190, when: 0.05, dur: 0.14, type: 'sine', gain: 0.3 });
      break;
    case 'pattern':
      // A whole symmetry group landing at once: a quick upward flourish.
      [0, 2, 4, 6].forEach((s, i) =>
        pluck({ freq: hz(step + s), when: i * 0.035, dur: 0.16, type: 'sine', gain: 0.55 })
      );
      break;
    case 'undo':
      pluck({ freq: 440, dur: 0.08, type: 'triangle', gain: 0.3 });
      pluck({ freq: 330, when: 0.045, dur: 0.1, type: 'triangle', gain: 0.3 });
      break;
    case 'complete':
      // Full Bloom. Worth a proper little fanfare.
      [0, 2, 4, 7, 9, 12].forEach((s, i) =>
        pluck({ freq: BASE * Math.pow(2, s / 12), when: i * 0.09, dur: 0.5, type: 'sine', gain: 0.6 })
      );
      [0, 4, 7].forEach((s) =>
        pluck({ freq: BASE * Math.pow(2, s / 12) * 2, when: 0.56, dur: 0.9, type: 'triangle', gain: 0.22 })
      );
      break;
    case 'tick':
      pluck({ freq: 880, dur: 0.04, type: 'square', gain: 0.16 });
      break;
    default:
      break;
  }
}

export function setEnabled(on) {
  enabled = !!on;
  if (!on && ctx && ctx.state === 'running') ctx.suspend().catch(() => {});
}

export function isEnabled() {
  return enabled;
}
