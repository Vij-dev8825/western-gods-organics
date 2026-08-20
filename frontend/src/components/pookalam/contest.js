/**
 * The entrant's side of the pookalam contest.
 *
 * Submitting is a multipart POST because the picture is a ~1 MB PNG and the
 * app's JSON body limit is 2 MB — base64 inflates by a third, which puts a
 * large carpet uncomfortably close to the ceiling. The blob goes as a file
 * through the same upload path the review photos use.
 *
 * The claim token is the interesting part. A guest has no login, so there would
 * otherwise be no way to show them whether their entry was approved or whether
 * they won. Looking entries up by phone number would let anyone walk the
 * contest and read other people's prize codes, so the server instead hands back
 * a secret once, at submission, and this module keeps it on the device. It is
 * the entrant's receipt.
 */
import { api } from '../../api';

const TOKENS_KEY = 'wg_pookalam_claim_tokens';

/* --- the receipt drawer --------------------------------------------------- */

/** Every claim token this browser holds. Tolerant of a corrupt value. */
export function readClaimTokens() {
  try {
    const raw = JSON.parse(localStorage.getItem(TOKENS_KEY) || '[]');
    return Array.isArray(raw) ? raw.filter((t) => typeof t === 'string' && t.length >= 16) : [];
  } catch {
    return [];
  }
}

export function rememberClaimToken(token) {
  if (!token) return;
  try {
    const next = [token, ...readClaimTokens().filter((t) => t !== token)].slice(0, 10);
    localStorage.setItem(TOKENS_KEY, JSON.stringify(next));
  } catch {
    /* Private-mode Safari throws on write. The entry still exists server-side;
       this device just cannot prove it owns it later. */
  }
}

/* --- submitting ---------------------------------------------------------- */

/**
 * Enter a pookalam into the contest.
 *
 * `blob` is the PNG the exporter already built for sharing, so the picture that
 * gets judged is the same one the player saw and could have downloaded.
 */
export async function submitEntry({ blob, title, name, phone, score, blooms, token }) {
  if (!blob) throw new Error('There is no picture to send yet.');

  const form = new FormData();
  /* Field name and extension both matter: multer's fileFilter tests the
     original filename against /\.(jpe?g|png|webp)$/i and rejects anything else,
     so a nameless blob would be turned away. */
  form.append('image', blob, 'pookalam.png');
  form.append('title', title || '');
  form.append('name', name || '');
  form.append('phone', phone || '');
  form.append('score', String(score ?? 0));
  form.append('blooms', String(blooms ?? 0));

  const res = await api.submitPookalam(form, token || undefined);
  if (res?.claimToken) rememberClaimToken(res.claimToken);
  return res;
}

/**
 * Everything this person has entered — their account's entries if logged in,
 * plus anything this device holds a token for. Deduplicated, because a member
 * who entered on this browser matches both ways.
 */
export async function loadMyEntries(token) {
  const tokens = readClaimTokens();
  const calls = [];

  if (token) calls.push(api.myPookalamEntries({ token }));
  for (const claimToken of tokens) calls.push(api.myPookalamEntries({ token, claimToken }));
  if (!calls.length) return [];

  /* One dead token must not hide the rest, so failures are dropped rather than
     rejecting the lot. */
  const settled = await Promise.allSettled(calls);
  const byId = new Map();
  for (const r of settled) {
    if (r.status !== 'fulfilled') continue;
    for (const entry of r.value?.entries || []) byId.set(entry.id, entry);
  }
  return [...byId.values()].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

export async function loadGallery() {
  const res = await api.pookalamGallery();
  return res?.entries || [];
}
