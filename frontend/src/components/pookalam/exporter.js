/**
 * exporter.js — a finished pookalam, turned into something you can post.
 *
 * The approach is split in two on purpose. The *artwork* is built as one
 * standalone SVG string (cream paper, the mat, then every bloom placed with the
 * exact same `translate/rotate/scale` transform the board uses) and rasterised
 * through `new Image()` on a data URI. That keeps screen and file identical,
 * because both read the same descriptor objects from the injected
 * `bloomChildren`. The *text furniture* — title, creator, rule, score, code,
 * site — is then painted on top with canvas 2D, never inside the SVG: a font
 * named inside a rasterised SVG is not guaranteed to resolve, so a title drawn
 * that way can silently fall back to something ugly. Canvas 2D resolves fonts
 * against the real document, so what we measure is what lands.
 *
 * Everything here is dependency-free: no stylesheet, no React, no packages, no
 * network, no Math.random(). The one impure call is Date.now() inside
 * saveDesign; the helpers that can take an `at` do.
 *
 * Layouts are hand-placed per format rather than letterboxed — the story frame
 * carries the mat high and the words low, which is where a thumb expects them.
 */

/* ------------------------------------------------------------------ tokens */

const PAPER = '#fff8e8';
const PAPER_2 = '#f7e9c7';
const CARD = '#fffdf6';
const INK = '#18382c';
const INK_SOFT = '#5b6651';
const OCHRE = '#e4a52b';
const OCHRE_D = '#a76a0a';
const OLIVE_D = '#28593f';

const SERIF = 'Georgia, "Times New Roman", "Iowan Old Style", serif';
const SANS =
  '"Helvetica Neue", Helvetica, Arial, "Segoe UI", system-ui, sans-serif';

const SITE = 'westerngodsorganic.com';

/** The board's fixed geometry. Art boxes are -50..50, so 100 units across. */
const MAT_R = 96;
const ART_SPAN = 100;
const CANVAS_SPAN = 200; /* -100..100 */

export const FORMATS = {
  post: { w: 1080, h: 1080, label: '1:1 Post' },
  story: { w: 1080, h: 1920, label: '9:16 Story' },
};

/**
 * Where the mat sits and where each line of type lands, per format. Baselines,
 * not boxes — canvas 2D draws from a baseline and this saves guessing later.
 */
const LAYOUT = {
  post: {
    w: 1080,
    h: 1080,
    frame: true,
    mat: { cx: 540, cy: 420, side: 740 },
    eyebrow: null,
    title: { y: 880, size: 60, min: 30, maxW: 880 },
    rule: { y: 908, w: 76, h: 3 },
    creator: { y: 954, size: 21, track: 2.4 },
    score: { y: 992, size: 21 },
    footer: { y: 1038, size: 18, track: 1.8, inset: 72 },
  },
  story: {
    w: 1080,
    h: 1920,
    frame: true,
    mat: { cx: 540, cy: 700, side: 900 },
    eyebrow: { y: 170, size: 20, track: 6.5, text: 'ONAM POOKALAM' },
    title: { y: 1300, size: 82, min: 38, maxW: 900 },
    rule: { y: 1338, w: 96, h: 4 },
    creator: { y: 1400, size: 28, track: 3.2 },
    score: { y: 1452, size: 28 },
    footer: { y: 1836, size: 22, track: 2.2, inset: 76 },
  },
};

function layoutFor(format) {
  return LAYOUT[format] || LAYOUT.post;
}

/* ------------------------------------------------- descriptor → SVG string */

/**
 * SVG attributes that are genuinely camelCase. Everything else that carries a
 * capital came in as a React-style name for a hyphenated attribute
 * (strokeWidth → stroke-width) and gets kebab-cased.
 */
const KEEP_CAMEL = new Set([
  'viewBox',
  'preserveAspectRatio',
  'pathLength',
  'gradientUnits',
  'gradientTransform',
  'spreadMethod',
  'patternUnits',
  'patternContentUnits',
  'patternTransform',
  'clipPathUnits',
  'maskUnits',
  'maskContentUnits',
  'primitiveUnits',
  'filterUnits',
  'markerWidth',
  'markerHeight',
  'markerUnits',
  'refX',
  'refY',
  'startOffset',
  'textLength',
  'lengthAdjust',
  'baseFrequency',
  'numOctaves',
  'stitchTiles',
  'xChannelSelector',
  'yChannelSelector',
  'diffuseConstant',
  'specularConstant',
  'specularExponent',
  'surfaceScale',
  'kernelMatrix',
  'kernelUnitLength',
  'targetX',
  'targetY',
  'edgeMode',
  'tableValues',
  'attributeName',
  'keyTimes',
  'keySplines',
  'repeatCount',
  'calcMode',
]);

const SKIP_PROPS = new Set([
  'tag',
  'children',
  'key',
  'ref',
  'dangerouslySetInnerHTML',
  'suppressHydrationWarning',
]);

const SAFE_TAG = /^[A-Za-z][A-Za-z0-9-]*$/;
const SAFE_ATTR = /^[A-Za-z_:][A-Za-z0-9_:.-]*$/;

function kebab(name) {
  return name.replace(/[A-Z]/g, (ch) => '-' + ch.toLowerCase());
}

function attrName(key) {
  if (key === 'className') return 'class';
  if (key === 'htmlFor') return 'for';
  if (key === 'xlinkHref') return 'xlink:href';
  if (key === 'xlinkTitle') return 'xlink:title';
  if (key === 'xmlSpace') return 'xml:space';
  if (key === 'xmlLang') return 'xml:lang';
  if (KEEP_CAMEL.has(key)) return key;
  if (/[A-Z]/.test(key)) return kebab(key);
  return key;
}

/** The data URI is parsed as XML, so this has to be strict. */
export function escapeAttr(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function escapeText(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function styleString(obj) {
  if (!obj || typeof obj !== 'object') return '';
  const out = [];
  for (const key of Object.keys(obj)) {
    const v = obj[key];
    if (v == null || v === '') continue;
    out.push(`${kebab(key)}:${String(v)}`);
  }
  return out.join(';');
}

/**
 * Serialise one descriptor (or an array / string / number of them) to SVG
 * source. Descriptors are the same `{ tag, ...attrs }` objects the board
 * spreads onto React elements, and an optional `children` array nests.
 */
export function shapeToSvg(node) {
  if (node == null || node === false || node === true) return '';
  if (Array.isArray(node)) return node.map(shapeToSvg).join('');
  if (typeof node === 'string' || typeof node === 'number') {
    return escapeText(node);
  }
  if (typeof node !== 'object') return '';

  const tag = node.tag;
  if (typeof tag !== 'string' || !SAFE_TAG.test(tag)) return '';

  let attrs = '';
  for (const key of Object.keys(node)) {
    if (SKIP_PROPS.has(key)) continue;
    let value = node[key];
    if (value == null || value === false) continue;
    if (typeof value === 'function') continue;
    if (key === 'style') {
      const css = typeof value === 'string' ? value : styleString(value);
      if (css) attrs += ` style="${escapeAttr(css)}"`;
      continue;
    }
    if (typeof value === 'object') continue;
    if (value === true) value = 'true';
    const name = attrName(key);
    if (!SAFE_ATTR.test(name)) continue;
    attrs += ` ${name}="${escapeAttr(value)}"`;
  }

  const kids = shapeToSvg(node.children);
  if (kids) return `<${tag}${attrs}>${kids}</${tag}>`;
  /* Self-closing is well-formed for every element under XML parsing. */
  return `<${tag}${attrs}/>`;
}

/* ------------------------------------------------------------- the artwork */

function num(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function round(n) {
  return Math.round(n * 1000) / 1000;
}

/**
 * Every bloom, in one <g> that maps the -100..100 board onto the image area.
 * Deliberately mirrors Board.jsx's transform so exports never drift from
 * what the player was looking at.
 */
function bloomsToSvg(blooms, bloomChildren, flowerById) {
  if (!Array.isArray(blooms) || typeof bloomChildren !== 'function') return '';
  const resolve =
    typeof flowerById === 'function' ? flowerById : () => null;
  let out = '';
  for (const b of blooms) {
    if (!b) continue;
    const flower = resolve(b.flowerId);
    if (!flower) continue;
    let shapes;
    try {
      shapes = bloomChildren(flower);
    } catch {
      continue;
    }
    const body = shapeToSvg(shapes);
    if (!body) continue;
    const x = round(num(b.x, 0));
    const y = round(num(b.y, 0));
    const rot = round(num(b.rot, 0));
    const k = round(num(b.size, 13) / ART_SPAN);
    out += `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${k})">${body}</g>`;
  }
  return out;
}

/** The full standalone SVG: paper, mat, blooms. No text, no fonts, no CSS. */
/**
 * Gradient definitions for every distinct flower on the mat.
 *
 * Petal shading is done with radial gradients, and a gradient referenced by url()
 * has to be defined inside the same SVG document — the rasteriser gets a
 * standalone file with no page around it, so anything defined back on the board
 * is not available here. Emitted once per distinct flower rather than once per
 * bloom: a full carpet is 200 blooms but at most fifteen species.
 */
function defsToSvg(blooms, flowerDefs, flowerById) {
  if (typeof flowerDefs !== 'function') return '';
  const resolve = typeof flowerById === 'function' ? flowerById : () => null;
  const seen = new Set();
  let out = '';
  for (const b of Array.isArray(blooms) ? blooms : []) {
    if (!b || seen.has(b.flowerId)) continue;
    seen.add(b.flowerId);
    const flower = resolve(b.flowerId);
    if (!flower) continue;
    try {
      out += shapeToSvg(flowerDefs(flower));
    } catch {
      /* a species with no gradients still draws, just flat */
    }
  }
  return out ? `<defs>${out}</defs>` : '';
}

function buildSvg({ blooms, bloomChildren, flowerById, flowerDefs, layout }) {
  const { w, h, mat } = layout;
  const s = mat.side / CANVAS_SPAN;
  const art = bloomsToSvg(blooms, bloomChildren, flowerById);
  const defs = defsToSvg(blooms, flowerDefs, flowerById);

  const frame = layout.frame
    ? `<rect x="26" y="26" width="${w - 52}" height="${h - 52}" rx="26" fill="none" stroke="${OCHRE}" stroke-opacity="0.26" stroke-width="2"/>`
    : '';

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" ` +
    `width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
    defs +
    `<rect x="0" y="0" width="${w}" height="${h}" fill="${PAPER}"/>` +
    frame +
    `<g transform="translate(${mat.cx} ${mat.cy}) scale(${round(s)})">` +
    `<circle r="${MAT_R + 2.5}" fill="${PAPER_2}" fill-opacity="0.55"/>` +
    `<circle r="${MAT_R}" fill="${CARD}"/>` +
    `<circle r="${MAT_R}" fill="none" stroke="${OCHRE}" stroke-opacity="0.34" stroke-width="0.7"/>` +
    `<circle r="${MAT_R - 6}" fill="none" stroke="${OCHRE}" stroke-opacity="0.14" stroke-width="0.5"/>` +
    art +
    `</g>` +
    `</svg>`
  );
}

/* ----------------------------------------------------------- rasterisation */

function svgDataUri(svg) {
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

/** Load an SVG string into a canvas of the given pixel size. */
function rasterise(svg, w, h) {
  return new Promise((resolve, reject) => {
    if (typeof document === 'undefined' || typeof Image === 'undefined') {
      reject(new Error('Pookalam export needs a browser.'));
      return;
    }
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      reject(new Error('Could not get a 2D canvas.'));
      return;
    }
    const img = new Image();
    let done = false;
    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      reject(new Error('Timed out drawing the pookalam.'));
    }, 15000);
    img.onload = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      try {
        ctx.drawImage(img, 0, 0, w, h);
        resolve({ canvas, ctx });
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      reject(new Error('Could not rasterise the pookalam artwork.'));
    };
    img.src = svgDataUri(svg);
  });
}

function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    if (typeof canvas.toBlob === 'function') {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
          return;
        }
        try {
          resolve(dataUrlToBlob(canvas.toDataURL('image/png')));
        } catch (err) {
          reject(err);
        }
      }, 'image/png');
      return;
    }
    try {
      resolve(dataUrlToBlob(canvas.toDataURL('image/png')));
    } catch (err) {
      reject(err);
    }
  });
}

function dataUrlToBlob(dataUrl) {
  const comma = dataUrl.indexOf(',');
  const head = dataUrl.slice(0, comma);
  const body = dataUrl.slice(comma + 1);
  const mime = (head.match(/data:([^;]+)/) || [])[1] || 'image/png';
  const binary = atob(body);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

/* ----------------------------------------------------------- text furniture */

function clean(value, max) {
  if (value == null) return '';
  const text = String(value).replace(/\s+/g, ' ').trim();
  if (max && text.length > max) return text.slice(0, max - 1).trim() + '…';
  return text;
}

function fontString(weight, size, family) {
  return `${weight} ${size}px ${family}`;
}

/** Shrink until it fits, then hard-truncate if the floor still overflows. */
function fitText(ctx, text, maxW, spec, family) {
  let size = spec.size;
  const min = spec.min || Math.round(spec.size * 0.6);
  ctx.font = fontString(spec.weight || 400, size, family);
  while (size > min && ctx.measureText(text).width > maxW) {
    size -= 2;
    ctx.font = fontString(spec.weight || 400, size, family);
  }
  let out = text;
  while (out.length > 4 && ctx.measureText(out + '…').width > maxW) {
    out = out.slice(0, -1);
  }
  if (out !== text) out += '…';
  return { text: out, size };
}

function measureTracked(ctx, text, track) {
  const chars = Array.from(text);
  if (!chars.length) return 0;
  let total = 0;
  for (const ch of chars) total += ctx.measureText(ch).width + track;
  return total - track;
}

/**
 * Canvas 2D has no reliable letter-spacing across browsers, and the reference
 * site's UI type is heavily tracked, so draw it character by character.
 */
function drawTracked(ctx, text, x, y, track, align) {
  const chars = Array.from(text);
  if (!chars.length) return 0;
  const total = measureTracked(ctx, text, track);
  let cursor = x;
  if (align === 'center') cursor = x - total / 2;
  else if (align === 'right') cursor = x - total;
  const prevAlign = ctx.textAlign;
  ctx.textAlign = 'left';
  for (const ch of chars) {
    ctx.fillText(ch, cursor, y);
    cursor += ctx.measureText(ch).width + track;
  }
  ctx.textAlign = prevAlign;
  return total;
}

function formatNumber(n) {
  const v = Math.round(Number(n) || 0);
  return String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** A stable little serial so two people's cards never read the same. */
function hashOf(text) {
  let h = 2166136261;
  const s = String(text);
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function codeFor({ blooms, title, creator, score } = {}) {
  const count = Array.isArray(blooms) ? blooms.length : 0;
  const seed = `${count}|${clean(title, 60)}|${clean(creator, 40)}|${Math.round(
    Number(score) || 0,
  )}`;
  const n = (hashOf(seed) % 99999) + 1;
  return 'WG-' + String(n).padStart(5, '0');
}

function paintFurniture(ctx, layout, info) {
  const { w } = layout;
  const cx = w / 2;
  const title = clean(info.title, 60) || 'My Pookalam';
  const creator = clean(info.creator, 40);
  const count = Array.isArray(info.blooms) ? info.blooms.length : 0;

  ctx.textBaseline = 'alphabetic';

  if (layout.eyebrow) {
    ctx.fillStyle = OLIVE_D;
    ctx.font = fontString(700, layout.eyebrow.size, SANS);
    drawTracked(
      ctx,
      layout.eyebrow.text,
      cx,
      layout.eyebrow.y,
      layout.eyebrow.track,
      'center',
    );
  }

  /* Title — serif display, the one line allowed to be big. */
  const fitted = fitText(
    ctx,
    title,
    layout.title.maxW,
    { size: layout.title.size, min: layout.title.min, weight: 400 },
    SERIF,
  );
  ctx.fillStyle = INK;
  ctx.font = fontString(400, fitted.size, SERIF);
  ctx.textAlign = 'center';
  ctx.fillText(fitted.text, cx, layout.title.y);

  /* Ochre rule. */
  ctx.fillStyle = OCHRE;
  ctx.fillRect(
    cx - layout.rule.w / 2,
    layout.rule.y,
    layout.rule.w,
    layout.rule.h,
  );

  /* Creator, uppercase and tracked like the site's UI type. */
  ctx.fillStyle = INK_SOFT;
  ctx.font = fontString(700, layout.creator.size, SANS);
  const byLine = creator
    ? `LAID BY ${creator.toUpperCase()}`
    : 'LAID FOR ONAM';
  drawTracked(ctx, byLine, cx, layout.creator.y, layout.creator.track, 'center');

  /* Score / bloom count. */
  const hasScore = info.score != null && Number.isFinite(Number(info.score));
  const scoreLine = hasScore
    ? `${formatNumber(count)} blooms  ·  score ${formatNumber(info.score)}`
    : `${formatNumber(count)} blooms laid by hand`;
  ctx.fillStyle = INK_SOFT;
  ctx.font = fontString(400, layout.score.size, SERIF);
  ctx.textAlign = 'center';
  ctx.fillText(scoreLine, cx, layout.score.y);

  /* Footer: serial on the left, home on the right. */
  const code = clean(info.code, 16) || codeFor(info);
  ctx.font = fontString(700, layout.footer.size, SANS);
  ctx.fillStyle = OCHRE_D;
  drawTracked(
    ctx,
    code.toUpperCase(),
    layout.footer.inset,
    layout.footer.y,
    layout.footer.track,
    'left',
  );
  ctx.fillStyle = INK_SOFT;
  drawTracked(
    ctx,
    SITE.toUpperCase(),
    w - layout.footer.inset,
    layout.footer.y,
    layout.footer.track,
    'right',
  );
}

/* --------------------------------------------------------------- rendering */

/**
 * Render a pookalam to a PNG blob in the requested format.
 * `bloomChildren` and `flowerById` are injected so this module never imports
 * the flower art (and so tests can hand it two tiny stubs).
 */
export async function renderPookalam({
  blooms,
  bloomChildren,
  flowerById,
  flowerDefs,
  format = 'post',
  title,
  creator,
  code,
  score,
} = {}) {
  const layout = layoutFor(format);
  const list = Array.isArray(blooms) ? blooms : [];
  const svg = buildSvg({ blooms: list, bloomChildren, flowerById, flowerDefs, layout });
  const { canvas, ctx } = await rasterise(svg, layout.w, layout.h);
  paintFurniture(ctx, layout, {
    title,
    creator,
    code,
    score,
    blooms: list,
  });
  return canvasToBlob(canvas);
}

/**
 * A 256px square PNG data URI for the saved-designs shelf. Returns a promise;
 * awaiting it is the only sane way to rasterise SVG in a browser.
 */
export function makeThumbnail({ blooms, bloomChildren, flowerById, flowerDefs, px = 256 } = {}) {
  const size = Math.max(64, Math.round(px));
  const layout = {
    w: size,
    h: size,
    frame: false,
    mat: { cx: size / 2, cy: size / 2, side: size - 12 },
  };
  const svg = buildSvg({
    blooms: Array.isArray(blooms) ? blooms : [],
    bloomChildren,
    flowerById,
    flowerDefs,
    layout,
  });
  return rasterise(svg, size, size).then(({ canvas }) =>
    canvas.toDataURL('image/png'),
  );
}

/* ------------------------------------------------------------ share / save */

/**
 * Share sheet where there is one, download everywhere else.
 * Returns { ok, method } — method is 'share' | 'download' | 'cancelled' |
 * 'none' — so the caller can word its own toast instead of guessing.
 */
export async function shareOrDownload(blob, filename, shareTitle) {
  const name = clean(filename, 80) || 'pookalam.png';
  if (!blob) return { ok: false, method: 'none', error: 'Nothing to share.' };

  if (typeof navigator !== 'undefined' && typeof File === 'function') {
    let file = null;
    try {
      file = new File([blob], name, { type: blob.type || 'image/png' });
    } catch {
      file = null;
    }
    if (
      file &&
      typeof navigator.share === 'function' &&
      typeof navigator.canShare === 'function'
    ) {
      let shareable = false;
      try {
        shareable = navigator.canShare({ files: [file] });
      } catch {
        shareable = false;
      }
      if (shareable) {
        try {
          await navigator.share({
            files: [file],
            title: clean(shareTitle, 80) || 'My pookalam',
          });
          return { ok: true, method: 'share' };
        } catch (err) {
          /* Backing out of the share sheet is a choice, not a fault. */
          const aborted =
            err &&
            (err.name === 'AbortError' ||
              err.name === 'NotAllowedError' ||
              err.code === 20);
          if (aborted) return { ok: true, method: 'cancelled' };
          /* Anything else: fall through and just hand them the file. */
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
    return {
      ok: false,
      method: 'none',
      error: (err && err.message) || 'Could not save the image.',
    };
  } finally {
    if (url) setTimeout(() => URL.revokeObjectURL(url), 4000);
  }
}

/** A caption worth pasting, short enough to survive a paste. */
export function captionFor({ title, creator, score } = {}) {
  const name = clean(title, 60) || 'My Pookalam';
  const who = clean(creator, 40);
  const hasScore = score != null && Number.isFinite(Number(score));
  const bits = [`“${name}”`];
  if (who) bits.push(`laid by ${who}`);
  bits.push('for Onam');
  let line = bits.join(', ') + '.';
  if (hasScore) line += ` ${formatNumber(score)} points of petals.`;
  return `${line} Make yours at ${SITE} #Onam #Pookalam`;
}

/* ------------------------------------------------------- saved designs */

const DESIGNS_KEY = 'wg_pookalam_designs';
const MAX_DESIGNS = 12;

/** Private-mode Safari throws on touch, not just on write. */
function store() {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage;
  } catch {
    return null;
  }
}

function normaliseBloom(b) {
  if (!b || typeof b !== 'object') return null;
  const flowerId = b.flowerId;
  if (typeof flowerId !== 'string' && typeof flowerId !== 'number') return null;
  return {
    id: typeof b.id === 'string' || typeof b.id === 'number' ? b.id : undefined,
    flowerId,
    x: num(b.x, 0),
    y: num(b.y, 0),
    size: num(b.size, 13),
    rot: num(b.rot, 0),
  };
}

function normaliseDesign(row) {
  if (!row || typeof row !== 'object') return null;
  if (typeof row.id !== 'string' || !row.id) return null;
  const blooms = Array.isArray(row.blooms)
    ? row.blooms.map(normaliseBloom).filter(Boolean)
    : [];
  return {
    id: row.id,
    title: clean(row.title, 60) || 'Untitled pookalam',
    creator: clean(row.creator, 40),
    blooms,
    score: Number.isFinite(Number(row.score)) ? Number(row.score) : null,
    thumbnail: typeof row.thumbnail === 'string' ? row.thumbnail : '',
    at: Number.isFinite(Number(row.at)) ? Number(row.at) : 0,
  };
}

function readRaw() {
  const ls = store();
  if (!ls) return [];
  let text = null;
  try {
    text = ls.getItem(DESIGNS_KEY);
  } catch {
    return [];
  }
  if (!text) return [];
  let parsed = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    /* Someone else's half-written JSON, or a hand-edited value. Start over
       rather than throwing in the caller's render. */
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.map(normaliseDesign).filter(Boolean);
}

/**
 * Write, and keep writing smaller if the quota complains — thumbnails are the
 * expensive part, so they go before whole designs do.
 */
function writeRaw(list) {
  const ls = store();
  if (!ls) return false;
  const attempts = [
    list,
    list.map((d, i) => (i === 0 ? d : { ...d, thumbnail: '' })),
    list.slice(0, 6).map((d, i) => (i === 0 ? d : { ...d, thumbnail: '' })),
    list.slice(0, 3).map((d) => ({ ...d, thumbnail: '' })),
    list.slice(0, 1),
  ];
  for (const attempt of attempts) {
    try {
      ls.setItem(DESIGNS_KEY, JSON.stringify(attempt));
      return true;
    } catch {
      /* Try a leaner payload. */
    }
  }
  return false;
}

/** Newest first. Tolerant of corrupt or foreign values. */
export function listDesigns() {
  return readRaw().sort((a, b) => b.at - a.at);
}

export function makeDesignId({ title, creator, blooms, at } = {}) {
  const stamp = Number.isFinite(Number(at)) ? Number(at) : 0;
  const seed = `${clean(title, 60)}|${clean(creator, 40)}|${
    Array.isArray(blooms) ? blooms.length : 0
  }|${stamp}`;
  return `pk_${stamp.toString(36)}_${hashOf(seed).toString(36)}`;
}

/**
 * Save one design, capped at 12 with the oldest dropped. Returns the stored
 * record plus a `persisted` flag, because a full or locked-down store is a
 * thing the caller should be able to say out loud.
 */
export function saveDesign({
  title,
  creator,
  blooms,
  score,
  thumbnail,
  at,
  id,
} = {}) {
  const stamp = Number.isFinite(Number(at)) ? Number(at) : Date.now();
  const record = normaliseDesign({
    id: typeof id === 'string' && id ? id : makeDesignId({ title, creator, blooms, at: stamp }),
    title,
    creator,
    blooms,
    score,
    thumbnail,
    at: stamp,
  });
  if (!record) return null;

  const rest = readRaw().filter((d) => d.id !== record.id);
  const next = [record, ...rest]
    .sort((a, b) => b.at - a.at)
    .slice(0, MAX_DESIGNS);
  const persisted = writeRaw(next);
  return { ...record, persisted };
}

export function deleteDesign(id) {
  if (typeof id !== 'string' || !id) return listDesigns();
  const next = readRaw().filter((d) => d.id !== id);
  writeRaw(next.sort((a, b) => b.at - a.at));
  return next.sort((a, b) => b.at - a.at);
}
