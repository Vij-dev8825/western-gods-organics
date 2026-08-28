/**
 * A shareable card for the current festival — its name, greeting and the
 * same colour theme dressing the rest of the site, turned into a PNG a
 * visitor can post or save. Not a screenshot of the door garland (which
 * would mean duplicating its per-variety bloom rendering here); instead it
 * borrows the one thing that actually carries the festival's identity —
 * theme.palette — into a small standalone composition.
 *
 * Deliberately self-contained rather than importing pookalam/exporter.js:
 * that module's SVG-serialisation and bloom-placement machinery is real but
 * pookalam-specific, and reaching into an unrelated feature's file for a
 * handful of generic canvas/share helpers would be a stranger dependency
 * than re-writing the ~40 lines those helpers actually are.
 */

const SERIF = 'Georgia, "Times New Roman", "Iowan Old Style", serif';
const SANS = '"Helvetica Neue", Helvetica, Arial, "Segoe UI", system-ui, sans-serif';
const SITE = 'westerngodsorganic.com';
const SIZE = 1080;

function clean(value, max) {
  if (value == null) return '';
  const text = String(value).replace(/\s+/g, ' ').trim();
  return max && text.length > max ? text.slice(0, max - 1).trim() + '…' : text;
}

function fontString(weight, size, family) {
  return `${weight} ${size}px ${family}`;
}

/** Shrink until it fits on one line, matching the pookalam exporter's approach. */
function fitText(ctx, text, maxW, size, min, weight, family) {
  let s = size;
  ctx.font = fontString(weight, s, family);
  while (s > min && ctx.measureText(text).width > maxW) {
    s -= 2;
    ctx.font = fontString(weight, s, family);
  }
  return s;
}

function drawTracked(ctx, text, x, y, track, align = 'center') {
  const chars = Array.from(text);
  if (!chars.length) return;
  let total = 0;
  for (const ch of chars) total += ctx.measureText(ch).width + track;
  total -= track;
  let cursor = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
  const prevAlign = ctx.textAlign;
  ctx.textAlign = 'left';
  for (const ch of chars) {
    ctx.fillText(ch, cursor, y);
    cursor += ctx.measureText(ch).width + track;
  }
  ctx.textAlign = prevAlign;
}

/** Three small diamonds in the accent colour — a light decorative flourish
 * rather than an attempt to recreate the door garland's actual artwork. */
function drawFlourish(ctx, cx, y, accent) {
  const gap = 26;
  ctx.fillStyle = accent;
  for (let i = -1; i <= 1; i += 1) {
    const x = cx + i * gap;
    const s = i === 0 ? 9 : 6;
    ctx.beginPath();
    ctx.moveTo(x, y - s);
    ctx.lineTo(x + s, y);
    ctx.lineTo(x, y + s);
    ctx.lineTo(x - s, y);
    ctx.closePath();
    ctx.fill();
  }
}

function paintCard(ctx, { eyebrow, greeting, lede, label, palette }) {
  const cx = SIZE / 2;

  const bg = ctx.createLinearGradient(0, 0, 0, SIZE);
  bg.addColorStop(0, palette.paper2 || palette.paper);
  bg.addColorStop(1, palette.paper);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, SIZE, SIZE);

  ctx.strokeStyle = palette.accent;
  ctx.globalAlpha = 0.35;
  ctx.lineWidth = 3;
  ctx.strokeRect(34, 34, SIZE - 68, SIZE - 68);
  ctx.globalAlpha = 1;

  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'center';

  if (eyebrow) {
    ctx.fillStyle = palette.accentDeep || palette.accent;
    ctx.font = fontString(700, 26, SANS);
    drawTracked(ctx, clean(eyebrow, 40).toUpperCase(), cx, 420, 5);
  }

  const title = clean(greeting, 44) || clean(label, 44) || 'Season’s greetings';
  const titleSize = fitText(ctx, title, SIZE - 200, 84, 44, 400, SERIF);
  ctx.fillStyle = palette.ink;
  ctx.font = fontString(400, titleSize, SERIF);
  ctx.fillText(title, cx, 500);

  drawFlourish(ctx, cx, 552, palette.accent);

  if (lede) {
    const sub = clean(lede, 90);
    const subSize = fitText(ctx, sub, SIZE - 220, 30, 20, 400, SANS);
    ctx.fillStyle = palette.ink;
    ctx.globalAlpha = 0.72;
    ctx.font = fontString(400, subSize, SANS);
    ctx.fillText(sub, cx, 610);
    ctx.globalAlpha = 1;
  }

  ctx.fillStyle = palette.accentDeep || palette.accent;
  ctx.font = fontString(700, 20, SANS);
  drawTracked(ctx, SITE.toUpperCase(), cx, SIZE - 70, 2.4);
}

function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    if (typeof canvas.toBlob !== 'function') {
      try {
        resolve(dataUrlToBlob(canvas.toDataURL('image/png')));
      } catch (err) {
        reject(err);
      }
      return;
    }
    canvas.toBlob((blob) => {
      if (blob) return resolve(blob);
      try {
        resolve(dataUrlToBlob(canvas.toDataURL('image/png')));
      } catch (err) {
        reject(err);
      }
    }, 'image/png');
  });
}

function dataUrlToBlob(dataUrl) {
  const comma = dataUrl.indexOf(',');
  const body = dataUrl.slice(comma + 1);
  const binary = atob(body);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: 'image/png' });
}

/** Renders the current festival's card to a PNG blob. */
export async function renderFestivalCard({ eyebrow, greeting, lede, label, palette }) {
  if (typeof document === 'undefined') throw new Error('Needs a browser.');
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get a 2D canvas.');
  paintCard(ctx, { eyebrow, greeting, lede, label, palette });
  return canvasToBlob(canvas);
}

/** Share sheet where there is one, download everywhere else — same shape as
 * pookalam/exporter.js's shareOrDownload so callers can handle it the same way. */
export async function shareOrDownload(blob, filename, shareTitle) {
  const name = clean(filename, 80) || 'festival-card.png';
  if (!blob) return { ok: false, method: 'none', error: 'Nothing to share.' };

  if (typeof navigator !== 'undefined' && typeof File === 'function') {
    let file = null;
    try {
      file = new File([blob], name, { type: blob.type || 'image/png' });
    } catch {
      file = null;
    }
    if (file && typeof navigator.share === 'function' && typeof navigator.canShare === 'function') {
      let shareable = false;
      try {
        shareable = navigator.canShare({ files: [file] });
      } catch {
        shareable = false;
      }
      if (shareable) {
        try {
          await navigator.share({ files: [file], title: clean(shareTitle, 80) || 'Western Gods Organics' });
          return { ok: true, method: 'share' };
        } catch (err) {
          const aborted = err && (err.name === 'AbortError' || err.name === 'NotAllowedError' || err.code === 20);
          if (aborted) return { ok: true, method: 'cancelled' };
        }
      }
    }
  }
  return downloadBlob(blob, name);
}

function downloadBlob(blob, name) {
  if (typeof document === 'undefined' || typeof URL === 'undefined') {
    return { ok: false, method: 'none', error: 'No browser to download into.' };
  }
  let url = '';
  try {
    url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.rel = 'noopener';
    a.style.position = 'fixed';
    a.style.left = '-9999px';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return { ok: true, method: 'download' };
  } catch (err) {
    return { ok: false, method: 'none', error: (err && err.message) || 'Could not save the image.' };
  } finally {
    if (url) setTimeout(() => URL.revokeObjectURL(url), 4000);
  }
}
