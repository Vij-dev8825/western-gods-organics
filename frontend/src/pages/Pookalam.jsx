/**
 * Lay a pookalam — the Onam flower game at /onam
 *
 * Onam's flower carpet is the one ritual of the festival everybody takes part
 * in: it is laid on the doorstep over ten days, growing a ring at a time, out
 * of whatever happens to be in flower. So this is not a spin-wheel with an
 * Onam skin on it. You get two hundred flowers and an empty mat, and what you
 * do with them is yours.
 *
 * The page is a thin shell. All the rules live in `engine.js` as a pure
 * reducer, the art in `flowers.jsx`, the layouts in `templates.js`, and the
 * image writing in `exporter.js` — which means the interesting parts are
 * testable without a browser and this file stays readable.
 *
 * The shop's own stake in it is the reward: whatever offer the admin attached
 * to the Onam entry in the festival calendar is revealed on Full Bloom. If no
 * code is set the pookalam is still worth laying and the page says so —
 * inventing a discount here would be writing a promise the shop has not made.
 */
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import SeoMeta from '../components/SeoMeta';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import Board from '../components/pookalam/Board';
import {
  Bloom,
  FAMILIES,
  FLOWERS,
  bloomChildren,
  flowerById,
  flowerDefs,
} from '../components/pookalam/flowers';
import { TEMPLATES, surprise } from '../components/pookalam/templates';
import {
  BUDGET,
  fillInside,
  fillPolyline,
  initialState,
  reducer,
  scoreOf,
  symmetryPositions,
} from '../components/pookalam/engine';
import {
  FORMATS,
  captionFor,
  deleteDesign,
  listDesigns,
  makeThumbnail,
  renderPookalam,
  saveDesign,
  shareOrDownload,
} from '../components/pookalam/exporter';
import { loadGallery, loadMyEntries, submitEntry } from '../components/pookalam/contest';
import * as sound from '../components/pookalam/sound';
import {
  IconCheck,
  IconClose,
  IconCopy,
  IconDesigns,
  IconDice,
  IconDownload,
  IconEraser,
  IconFinish,
  IconFlower,
  IconGrid,
  IconHelp,
  IconLamp,
  IconMenu,
  IconMinus,
  IconMirror,
  IconPalette,
  IconPlus,
  IconRedo,
  IconReset,
  IconRotateLeft,
  IconRotateRight,
  IconSave,
  IconShare,
  IconSketch,
  IconSoundOff,
  IconSoundOn,
  IconTimer,
  IconTools,
  IconTrash,
  IconTrophy,
  IconUndo,
  IconWhatsApp,
  IconZoomFit,
  IconZoomIn,
  IconZoomOut,
} from '../components/pookalam/icons';
import '../styles/pookalam.css';

const SIZES = [
  { id: 'small', label: 'Small', value: 9 },
  { id: 'medium', label: 'Medium', value: 13 },
  { id: 'large', label: 'Large', value: 18 },
];

const FOLDS = [
  { n: 1, label: 'Off' },
  { n: 2, label: '2×' },
  { n: 4, label: '4×' },
  { n: 6, label: '6×' },
  { n: 8, label: '8×' },
  { n: 12, label: '12×' },
];

const TABS = [
  { id: 'flowers', label: 'Flowers', Icon: IconFlower },
  { id: 'colours', label: 'Colours', Icon: IconPalette },
  { id: 'tools', label: 'Tools', Icon: IconTools },
  { id: 'symmetry', label: 'Symmetry', Icon: IconMirror },
  { id: 'sketch', label: 'Sketch', Icon: IconSketch },
  { id: 'finish', label: 'Finish', Icon: IconFinish },
];

const CHALLENGE_SECONDS = 6 * 60;
const WELCOMED_KEY = 'wg_pookalam_welcomed';

/* The engine's centrepiece is one large bloom plus two rings of eight, laid all
   or not at all. Kept here so the button can explain a refusal before it
   happens. */
const CENTREPIECE_COST = 17;

/** Same format the festival calendar uses, so a customer moving between the
 *  two pages reads the same deadline written the same way. */
const shortDate = (d) =>
  new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

const mmss = (s) =>
  `${String(Math.floor(Math.max(0, s) / 60)).padStart(2, '0')}:${String(
    Math.max(0, s) % 60
  ).padStart(2, '0')}`;

/** A short stable serial for the exported image. Not an identifier anything
 *  depends on — it just makes a shared picture feel like a numbered print. */
function serialOf(blooms) {
  let h = 2166136261;
  for (const b of blooms) {
    h ^= Math.round(b.x * 7 + b.y * 13 + b.size * 3 + b.rot);
    h = Math.imul(h, 16777619);
  }
  return `WG-${String(Math.abs(h) % 100000).padStart(5, '0')}`;
}

/** Save a blob to the device. Used when the picture must land on disk rather
 *  than go through the share sheet — see doExport's `download` option. */
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Can this browser share an actual file?
 *
 * Only mobile Safari/Chrome really can. Probed once with a throwaway file
 * because `navigator.share` existing says nothing about whether it accepts
 * `files` — desktop Chrome has the method and rejects the payload. Getting this
 * wrong means a button labelled "Share picture" that silently downloads.
 */
function probeFileShare() {
  try {
    if (!navigator.canShare) return false;
    const probe = new File([new Blob(['x'])], 'probe.png', { type: 'image/png' });
    return navigator.canShare({ files: [probe] });
  } catch {
    return false;
  }
}

const STATUS_COPY = {
  pending: { label: 'Being checked', cls: 'is-pending' },
  approved: { label: 'Posted', cls: 'is-approved' },
  rejected: { label: 'Not posted', cls: 'is-rejected' },
};

/** One of the entrant's own entries: where it got to, and the prize if it won. */
function MyEntry({ entry }) {
  const status = STATUS_COPY[entry.status] || STATUS_COPY.pending;
  return (
    <div className="onam-mine">
      {entry.image ? <img src={entry.image} alt={entry.title || 'Your pookalam'} /> : null}
      <span className="mt">
        <b>{entry.title || 'Your pookalam'}</b>
        <span>
          {entry.blooms} flowers · {entry.score} pts
          {entry.prize?.couponCode ? ` · code ${entry.prize.couponCode}` : ''}
          {entry.prize?.giftNote ? ` · ${entry.prize.giftNote}` : ''}
        </span>
      </span>
      <span className={`onam-badge ${entry.winner ? 'is-winner' : status.cls}`}>
        {entry.winner ? 'Winner' : status.label}
      </span>
    </div>
  );
}

function readWelcomed() {
  try {
    return !!localStorage.getItem(WELCOMED_KEY);
  } catch {
    return true; // storage blocked: do not nag on every load
  }
}

export default function Pookalam() {
  const { showToast } = useToast();
  const [state, dispatch] = useReducer(reducer, undefined, initialState);

  /* --- editor UI ------------------------------------------------------- */
  const [tab, setTab] = useState('flowers');
  const [activeFlower, setActiveFlower] = useState(FLOWERS[0].id);
  const [activeSize, setActiveSize] = useState(13);
  const [tool, setTool] = useState('place');
  const [view, setView] = useState({ zoom: 1, pan: { x: 0, y: 0 } });
  const [newIds, setNewIds] = useState(() => new Set());

  /* --- chrome ---------------------------------------------------------- */
  const [soundOn, setSoundOn] = useState(true);
  const [drawer, setDrawer] = useState(false);
  const [modal, setModal] = useState(() => (readWelcomed() ? null : 'welcome'));
  const [designs, setDesigns] = useState([]);

  /* --- finish ---------------------------------------------------------- */
  const [title, setTitle] = useState('My Onam Pookalam');
  const [creator, setCreator] = useState('');
  const [format, setFormat] = useState('post');
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState('');

  /* --- challenge ------------------------------------------------------- */
  const [secondsLeft, setSecondsLeft] = useState(null);

  /* --- shop data ------------------------------------------------------- */
  const [onam, setOnam] = useState(null);
  const [claimed, setClaimed] = useState(false);

  /* --- contest --------------------------------------------------------- */
  const { token, user } = useAuth();
  const [gallery, setGallery] = useState([]);
  const [myEntries, setMyEntries] = useState([]);
  const [entryName, setEntryName] = useState('');
  const [entryPhone, setEntryPhone] = useState('');
  const [entryConsent, setEntryConsent] = useState(false);
  const [entryError, setEntryError] = useState('');
  const canShareFiles = useMemo(probeFileShare, []);

  const used = state.blooms.length;
  const remaining = BUDGET - used;
  const pct = Math.round((used / BUDGET) * 100);
  const score = useMemo(() => scoreOf(state.blooms), [state.blooms]);
  const selected = state.blooms.find((b) => b.id === state.selectedId) || null;
  const full = remaining <= 0;

  const visibleFlowers = useMemo(
    () => (state.family === 'all' ? FLOWERS : FLOWERS.filter((f) => f.family === state.family)),
    [state.family]
  );

  const flowerIds = useMemo(() => visibleFlowers.map((f) => f.id), [visibleFlowers]);

  /* --- festival offer -------------------------------------------------- */
  useEffect(() => {
    api
      .getFestivals()
      .then((d) => {
        const list = d.festivals || [];
        setOnam(list.find((f) => /onam/i.test(f.name)) || null);
      })
      .catch(() => setOnam(null));
  }, []);

  /* Keep the picker honest: narrowing the palette must not leave a flower
     selected that the palette no longer offers. */
  useEffect(() => {
    if (!visibleFlowers.some((f) => f.id === activeFlower)) {
      setActiveFlower(visibleFlowers[0]?.id ?? FLOWERS[0].id);
    }
  }, [visibleFlowers, activeFlower]);

  /* Flag freshly landed flowers so they can fade in, then stop flagging them
     so a later re-render does not replay the animation. */
  const seenIds = useRef(new Set());
  useEffect(() => {
    const current = new Set(state.blooms.map((b) => b.id));
    const added = [];
    current.forEach((id) => {
      if (!seenIds.current.has(id)) added.push(id);
    });
    seenIds.current = current;
    if (!added.length) return undefined;
    setNewIds(new Set(added));
    const t = setTimeout(() => setNewIds(new Set()), 340);
    return () => clearTimeout(t);
  }, [state.blooms]);

  const cue = useCallback(
    (name) => {
      if (!soundOn) return;
      sound.play(name, used);
    },
    [soundOn, used]
  );

  useEffect(() => {
    sound.setEnabled(soundOn);
  }, [soundOn]);

  /* Full Bloom. Fires once per filled mat; resetting arms it again. */
  const celebrated = useRef(false);
  useEffect(() => {
    if (!full) {
      celebrated.current = false;
      return;
    }
    if (celebrated.current) return;
    celebrated.current = true;
    setClaimed(true);
    setModal('bloom');
    setSecondsLeft(null);
    if (soundOn) sound.play('complete');
  }, [full, soundOn]);

  /* The timed challenge. */
  useEffect(() => {
    if (secondsLeft === null) return undefined;
    if (secondsLeft <= 0) {
      setSecondsLeft(null);
      showToast("Time! Your pookalam is where you left it — keep going or finish up.");
      return undefined;
    }
    const t = setTimeout(() => setSecondsLeft((s) => (s === null ? null : s - 1)), 1000);
    return () => clearTimeout(t);
  }, [secondsLeft, showToast]);

  useEffect(() => {
    if (secondsLeft !== null && secondsLeft <= 10 && secondsLeft > 0 && soundOn) {
      sound.play('tick');
    }
  }, [secondsLeft, soundOn]);

  /* --- keyboard -------------------------------------------------------- */
  /* The handler needs the current blooms to nudge one, but `state.blooms` is a
     fresh array on every pointermove of a drag. Reading it through a ref keeps
     the listener registered once instead of being torn down and rebound sixty
     times a second. */
  const live = useRef({});
  live.current = { blooms: state.blooms, selectedId: state.selectedId, modal, drawer, cue };

  useEffect(() => {
    const onKey = (e) => {
      const { blooms, selectedId, modal: m, drawer: d, cue: sfx } = live.current;
      const t = e.target;
      // Never steal keys from a text field.
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;

      const meta = e.ctrlKey || e.metaKey;
      if (meta && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        dispatch({ type: e.shiftKey ? 'redo' : 'undo' });
        sfx('undo');
        return;
      }
      if (e.key === 'Escape') {
        // Welcome is the one modal Escape should not dismiss — it is where the
        // "start creating" gesture lives, and skipping it silently leaves a
        // first-time player looking at a mat with no instructions.
        if (m && m !== 'welcome') setModal(null);
        else if (d) setDrawer(false);
        else if (selectedId) dispatch({ type: 'deselect' });
        return;
      }
      if (!selectedId) return;
      const id = selectedId;
      switch (e.key) {
        case 'Delete':
        case 'Backspace':
          e.preventDefault();
          dispatch({ type: 'remove', id });
          sfx('delete');
          break;
        case 'q':
        case 'Q':
          dispatch({ type: 'rotate', id, delta: -15 });
          break;
        case 'e':
        case 'E':
          dispatch({ type: 'rotate', id, delta: 15 });
          break;
        case '+':
        case '=':
          dispatch({ type: 'resize', id, delta: 1.5 });
          break;
        case '-':
        case '_':
          dispatch({ type: 'resize', id, delta: -1.5 });
          break;
        case 'ArrowUp':
          e.preventDefault();
          nudge(id, 0, -1.5);
          break;
        case 'ArrowDown':
          e.preventDefault();
          nudge(id, 0, 1.5);
          break;
        case 'ArrowLeft':
          e.preventDefault();
          nudge(id, -1.5, 0);
          break;
        case 'ArrowRight':
          e.preventDefault();
          nudge(id, 1.5, 0);
          break;
        default:
          break;
      }

      function nudge(bid, dx, dy) {
        const b = blooms.find((x) => x.id === bid);
        if (!b) return;
        dispatch({ type: 'move', id: bid, x: b.x + dx, y: b.y + dy });
        dispatch({ type: 'moveCommit' });
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  /* --- the Full Bloom preview image ------------------------------------ */
  useEffect(() => {
    if ((modal !== 'bloom' && modal !== 'enter') || !state.blooms.length) return undefined;
    let url = null;
    let alive = true;
    (async () => {
      try {
        const blob = await renderPookalam({
          blooms: state.blooms,
          bloomChildren,
          flowerById,
          flowerDefs,
          format: modal === 'enter' ? 'post' : format,
          title: title.trim() || 'My Onam Pookalam',
          creator: creator.trim(),
          code: serialOf(state.blooms),
          score,
        });
        if (!alive || !blob) return;
        url = URL.createObjectURL(blob);
        setPreview({ url, blob });
      } catch {
        if (alive) setPreview(null);
      }
    })();
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
      setPreview(null);
    };
  }, [modal, format, state.blooms, title, creator, score]);

  /* --- actions --------------------------------------------------------- */

  const loadTemplate = useCallback(
    (tpl) => {
      const ids = flowerIds.length ? flowerIds : FLOWERS.map((f) => f.id);
      dispatch({ type: 'loadBlooms', blooms: tpl.build(ids) });
      setView({ zoom: 1, pan: { x: 0, y: 0 } });
      setTool('place');
      cue(tpl.blooms ? 'pattern' : 'select');
      showToast(tpl.blooms ? `${tpl.label} laid — ${tpl.blooms} flowers` : 'Blank mat. Over to you.');
    },
    [flowerIds, cue, showToast]
  );

  const doSurprise = useCallback(() => {
    const ids = flowerIds.length ? flowerIds : FLOWERS.map((f) => f.id);
    // Seeded from the clock so each press differs, but the generator itself
    // stays pure and replayable given the same seed.
    dispatch({ type: 'loadBlooms', blooms: surprise(ids, Date.now() % 100000) });
    setView({ zoom: 1, pan: { x: 0, y: 0 } });
    cue('pattern');
  }, [flowerIds, cue]);

  const doSketchFill = useCallback(
    (mode) => {
      if (!state.sketch.length) {
        showToast('Draw something first — turn on Sketch mode and trace on the mat.');
        return;
      }
      const ids = flowerIds.length ? flowerIds : FLOWERS.map((f) => f.id);
      const placements =
        mode === 'inside'
          ? fillInside(state.sketch, ids, remaining)
          : fillPolyline(state.sketch, ids, remaining);
      if (!placements.length) {
        showToast(
          remaining <= 0
            ? 'No flowers left — clear some to fill the sketch.'
            : 'Nothing to fill there. Try a bigger shape.'
        );
        return;
      }
      dispatch({ type: 'loadBlooms', blooms: state.blooms.concat(placements) });
      cue('pattern');
      showToast(`${placements.length} flower${placements.length === 1 ? '' : 's'} laid along your sketch`);
    },
    [state.sketch, state.blooms, flowerIds, remaining, cue, showToast]
  );

  const openDesigns = useCallback(() => {
    setDesigns(listDesigns());
    setModal('designs');
    setDrawer(false);
  }, []);

  const doSave = useCallback(async () => {
    if (!state.blooms.length) {
      showToast('Lay a few flowers first.');
      return;
    }
    setBusy('save');
    try {
      const thumbnail = await makeThumbnail({
        blooms: state.blooms,
        bloomChildren,
        flowerById,
        flowerDefs,
      });
      saveDesign({
        title: title.trim() || 'My Onam Pookalam',
        creator: creator.trim(),
        blooms: state.blooms,
        score,
        thumbnail,
      });
      showToast('Saved to this device');
    } catch {
      showToast('Could not save on this device');
    } finally {
      setBusy('');
    }
  }, [state.blooms, title, creator, score, showToast]);

  /**
   * Turn the mat into a file and get it off the page.
   *
   * `mode` names the button that asked, so the right one shows a spinner.
   * `download` forces the file to disk instead of offering the native share
   * sheet — the WhatsApp route needs the picture actually saved, because no
   * share-intent URL can carry a file and the person has to attach it.
   */
  const doExport = useCallback(
    async (mode, { download = false } = {}) => {
      if (!state.blooms.length) {
        showToast('Lay a few flowers first.');
        return;
      }
      setBusy(mode);
      try {
        const blob =
          preview?.blob && modal === 'bloom'
            ? preview.blob
            : await renderPookalam({
                blooms: state.blooms,
                bloomChildren,
                flowerById,
                flowerDefs,
                format,
                title: title.trim() || 'My Onam Pookalam',
                creator: creator.trim(),
                code: serialOf(state.blooms),
                score,
              });
        if (!blob) throw new Error('no image');
        if (download) {
          downloadBlob(blob, `pookalam-${format}.png`);
          showToast('Image saved — attach it in WhatsApp');
        } else {
          const res = await shareOrDownload(blob, `pookalam-${format}.png`, 'My Onam pookalam');
          if (res.ok && res.method === 'download') showToast('Image saved to your device');
          else if (!res.ok) showToast('Could not save the image — try a screenshot instead');
        }
      } catch {
        showToast('Could not build the image — try a screenshot instead');
      } finally {
        setBusy('');
      }
    },
    [state.blooms, preview, modal, format, title, creator, score, showToast]
  );

  const doCaption = useCallback(() => {
    const text = captionFor({
      title: title.trim() || 'My Onam Pookalam',
      creator: creator.trim(),
      score,
    });
    navigator.clipboard?.writeText(text).then(
      () => showToast('Caption copied'),
      () => showToast('Could not copy — select the text instead')
    );
  }, [title, creator, score, showToast]);

  const doReset = useCallback(() => {
    dispatch({ type: 'reset' });
    setView({ zoom: 1, pan: { x: 0, y: 0 } });
    setTool('place');
    setModal(null);
    setSecondsLeft(null);
    cue('undo');
  }, [cue]);

  const startChallenge = useCallback(() => {
    dispatch({ type: 'reset' });
    setView({ zoom: 1, pan: { x: 0, y: 0 } });
    setSecondsLeft(CHALLENGE_SECONDS);
    setTab('flowers');
    setModal(null);
    setDrawer(false);
    showToast('Six minutes. Lay as much as you can.');
  }, [showToast]);

  const dismissWelcome = useCallback(() => {
    setModal(null);
    try {
      localStorage.setItem(WELCOMED_KEY, '1');
    } catch {
      /* storage blocked — the modal simply shows again next visit */
    }
  }, []);

  const setZoom = useCallback((z) => {
    setView((v) => {
      const zoom = Math.min(4, Math.max(1, +z.toFixed(3)));
      const limit = Math.max(0, 100 - 100 / zoom);
      const d = Math.hypot(v.pan.x, v.pan.y);
      const pan = d <= limit || d === 0 ? v.pan : { x: (v.pan.x * limit) / d, y: (v.pan.y * limit) / d };
      return { zoom, pan };
    });
  }, []);

  const countdown =
    onam?.daysAway > 0
      ? `Onam is ${onam.daysAway} day${onam.daysAway === 1 ? '' : 's'} away`
      : onam?.daysAway === 0
        ? 'Onam is today'
        : null;

  const coupon = claimed && onam?.couponCode ? onam.couponCode : null;

  /* --- contest --------------------------------------------------------- */

  /* The gallery is public and the entries list is per-person, so both are
     reloaded together whenever either could have changed. */
  const refreshContest = useCallback(() => {
    loadGallery().then(setGallery).catch(() => setGallery([]));
    loadMyEntries(token).then(setMyEntries).catch(() => setMyEntries([]));
  }, [token]);

  useEffect(() => {
    refreshContest();
  }, [refreshContest]);

  /* Prefill from the account when there is one, so a logged-in customer is not
     asked to retype what the shop already has. */
  useEffect(() => {
    if (user?.name) setEntryName((n) => n || user.name);
    if (user?.phone) setEntryPhone((p) => p || user.phone);
  }, [user]);

  const myWin = useMemo(() => myEntries.find((e) => e.winner && e.prize) || null, [myEntries]);

  /** Build the picture once and hand it to the contest. */
  const doEnterContest = useCallback(async () => {
    setEntryError('');
    if (!state.blooms.length) {
      setEntryError('Lay some flowers first — there is nothing to enter yet.');
      return;
    }
    if (!entryConsent) {
      setEntryError('Please tick the box so we know we may post your pookalam.');
      return;
    }
    setBusy('enter');
    try {
      /* Always the 1:1 crop for entries: the admin reviews them in a grid and
         a mix of squares and tall stories makes that grid unreadable. */
      const blob = await renderPookalam({
        blooms: state.blooms,
        bloomChildren,
        flowerById,
        flowerDefs,
        format: 'post',
        title: title.trim() || 'My Onam Pookalam',
        creator: entryName.trim() || creator.trim(),
        code: serialOf(state.blooms),
        score,
      });
      await submitEntry({
        blob,
        title: title.trim(),
        name: entryName.trim(),
        phone: entryPhone.trim(),
        score,
        blooms: state.blooms.length,
        token,
      });
      setModal(null);
      setEntryConsent(false);
      refreshContest();
      showToast('Entry received. We will post it once it has been checked.');
    } catch (err) {
      setEntryError(err?.message || 'Could not send your entry. Please try again.');
    } finally {
      setBusy('');
    }
  }, [
    state.blooms, entryConsent, entryName, entryPhone, title, creator, score, token,
    refreshContest, showToast,
  ]);

  /**
   * WhatsApp cannot be handed a picture through a link — no share-intent URL
   * carries a file. So the honest flow is two steps, in this order: save the
   * image, then open WhatsApp with the words already written. The person
   * attaches the picture themselves, which is what they would have done anyway.
   */
  const doWhatsApp = useCallback(async () => {
    const caption = captionFor({
      title: title.trim() || 'My Onam Pookalam',
      creator: creator.trim(),
      score,
    });
    await doExport('whatsapp', { download: true });
    window.open(
      `https://api.whatsapp.com/send?text=${encodeURIComponent(caption)}`,
      '_blank',
      'noopener'
    );
  }, [title, creator, score, doExport]);

  /* Clicking the dark surround dismisses. Guarded on the target so a click that
     started inside the card and drifted onto the scrim does not close it. */
  const scrimClose = useCallback((e) => {
    if (e.target === e.currentTarget) setModal(null);
  }, []);

  const copyCoupon = useCallback(() => {
    if (!coupon) return;
    navigator.clipboard?.writeText(coupon).then(
      () => showToast(`${coupon} copied`),
      () => {}
    );
  }, [coupon, showToast]);

  /* ------------------------------------------------------------------ */

  return (
    <div className="onam">
      <SeoMeta
        title="Lay a Pookalam — the Onam flower game | Western Gods Organics"
        description="Two hundred flowers and an empty mat. Lay an Onam pookalam petal by petal, mirror it around the circle, sketch your own design, then save it — and unlock this season's offer from our family mill."
        path="/onam"
      />

      <div className="onam-shell">
        {/* --- topbar --------------------------------------------------- */}
        <header className="onam-topbar">
          <div className="onam-brand">
            <span className="onam-brand-mark">
              <Bloom flowerId="chendumalli" size={42} />
            </span>
            <span className="onam-brand-txt">
              <span className="onam-brand-name">Pookalam</span>
              <span className="onam-brand-tag">
                {BUDGET} flowers · one carpet
              </span>
            </span>
          </div>

          <nav className="onam-topnav" aria-label="Game actions">
            <button type="button" className="onam-iconbtn" onClick={openDesigns}>
              <IconDesigns />
              <span>Designs</span>
            </button>
            <button type="button" className="onam-iconbtn" onClick={() => setModal('howto')}>
              <IconHelp />
              <span>How to</span>
            </button>
            <button
              type="button"
              className="onam-iconbtn"
              onClick={() => setSoundOn((s) => !s)}
              aria-pressed={soundOn}
              title={soundOn ? 'Turn sound off' : 'Turn sound on'}
            >
              {soundOn ? <IconSoundOn /> : <IconSoundOff />}
              <span>Sound</span>
            </button>
            <button
              type="button"
              className="onam-iconbtn"
              onClick={() => (used ? setModal('reset') : undefined)}
              disabled={!used}
            >
              <IconReset />
              <span>Reset</span>
            </button>
          </nav>

          <button
            type="button"
            className="onam-iconbtn onam-burger"
            onClick={() => setDrawer(true)}
            aria-label="Open game menu"
          >
            <IconMenu />
            <span>Menu</span>
          </button>
        </header>

        {/* --- hero ----------------------------------------------------- */}
        <section className="onam-hero">
          <p className="onam-eyebrow">Onam · Kerala</p>
          {/* The span is what the fleurons hang off — they need a box the width
              of the words, not of the line. */}
          <h1>
            <span>Create your pookalam</span>
          </h1>
          <svg className="onam-rule" viewBox="0 0 260 14" aria-hidden="true" focusable="false">
            <path
              d="M4 7h96M160 7h96"
              stroke="currentColor"
              strokeWidth="1"
              strokeLinecap="round"
              opacity="0.7"
            />
            <path d="M130 1.5 135.5 7 130 12.5 124.5 7z" fill="currentColor" />
            <circle cx="112" cy="7" r="2" fill="currentColor" opacity="0.8" />
            <circle cx="148" cy="7" r="2" fill="currentColor" opacity="0.8" />
          </svg>
          <p className="onam-lede">
            Two hundred flowers. Lay them petal by petal on the doorstep mat —
            mirror one tap into a whole pattern, sketch a shape and fill it with
            blooms, then keep the picture.
          </p>
          {onam?.orderingClosed === false && onam?.orderBy && (
            <p className="onam-note">
              Order by <b>{shortDate(onam.orderBy)}</b> for it to arrive in time.
            </p>
          )}
        </section>

        {/* --- counters ------------------------------------------------- */}
        <div className="onam-counter">
          <div className="onam-stats">
            <div className="onam-stat">
              <span className="n">
                {remaining}
                <small> / {BUDGET}</small>
              </span>
              <span className="l">Flowers left</span>
            </div>
            <div className="onam-stat">
              <span className="n">{used}</span>
              <span className="l">Laid</span>
            </div>
            <div className="onam-stat">
              <span className="n">{score}</span>
              <span className="l">Score</span>
            </div>
          </div>

          {secondsLeft !== null && (
            <span className={`onam-clock${secondsLeft <= 30 ? ' is-urgent' : ''}`}>
              <IconTimer style={{ width: 15, height: 15 }} />
              <span className="t">{mmss(secondsLeft)}</span>
              <button
                type="button"
                className="onam-btn is-ghost"
                style={{ padding: '5px 10px', fontSize: 9 }}
                onClick={() => setSecondsLeft(null)}
              >
                Stop
              </button>
            </span>
          )}
        </div>

        <div
          className="onam-meter"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Flowers used"
        >
          <span style={{ width: `${pct}%` }} />
        </div>

        {/* --- stage ---------------------------------------------------- */}
        <div className="onam-stage">
          <div
            className={`onam-canvasWrap${view.zoom > 1 ? ' is-zoomed' : ''}${
              state.sketchOn ? ' is-sketching' : ''
            }${tool === 'erase' ? ' is-erasing' : ''}`}
          >
            <Board
              state={state}
              dispatch={dispatch}
              activeFlower={state.sketchOn || tool === 'erase' ? null : activeFlower}
              activeSize={activeSize}
              tool={tool}
              zoom={view.zoom}
              pan={view.pan}
              onView={setView}
              newIds={newIds}
              onCue={cue}
              onRefuse={({ blocked, cost, left }) =>
                showToast(
                  blocked
                    ? 'Those spots are already taken — try a gap, or use the eraser.'
                    : left === 0
                      ? `All ${BUDGET} flowers are down — erase some to keep going.`
                      : `That pattern needs ${cost} flowers and you have ${left}. Lower the mirror or erase a few.`
                )
              }
              ariaLabel={`Pookalam mat. ${used} of ${BUDGET} flowers laid. Pick a flower, then tap to place it.`}
            />

            {(state.sketchOn || tool === 'erase') && (
              <button
                type="button"
                className={`onam-mode${tool === 'erase' ? ' is-erase' : ''}`}
                onClick={() => {
                  if (tool === 'erase') setTool('place');
                  else dispatch({ type: 'toggleSketch' });
                }}
                title="Back to laying flowers"
              >
                {tool === 'erase' ? <IconEraser /> : <IconSketch />}
                {tool === 'erase' ? 'Erasing' : 'Sketching'} · not laying
                <i>
                  <IconClose />
                </i>
              </button>
            )}

            {!used && !state.sketchOn && (
              <div className="onam-empty">
                <h2>Your pookalam starts here</h2>
                <p>Pick a flower below, then tap the mat.</p>
                <div className="onam-row is-center">
                  <button
                    type="button"
                    className="onam-btn is-primary"
                    onClick={() => {
                      setTab('flowers');
                      document.getElementById('onam-dock')?.scrollIntoView({
                        behavior: 'smooth',
                        block: 'center',
                      });
                    }}
                  >
                    Start creating
                  </button>
                  <button type="button" className="onam-btn" onClick={doSurprise}>
                    <IconDice />
                    Surprise me
                  </button>
                </div>
              </div>
            )}

            <div className="onam-zoom" role="group" aria-label="Zoom">
              <button
                type="button"
                onClick={() => setZoom(view.zoom / 1.25)}
                disabled={view.zoom <= 1}
                aria-label="Zoom out"
              >
                <IconZoomOut />
              </button>
              <span className="pct">{Math.round(view.zoom * 100)}%</span>
              <button
                type="button"
                onClick={() => setView({ zoom: 1, pan: { x: 0, y: 0 } })}
                disabled={view.zoom === 1}
                aria-label="Reset zoom to fit"
              >
                <IconZoomFit />
              </button>
              <button
                type="button"
                onClick={() => setZoom(view.zoom * 1.25)}
                disabled={view.zoom >= 4}
                aria-label="Zoom in"
              >
                <IconZoomIn />
              </button>
            </div>

            <span className="onam-panhint">Drag to pan</span>
          </div>

          {selected && (
            <div className="onam-selbar" role="toolbar" aria-label="Selected flower">
              <button
                type="button"
                onClick={() => dispatch({ type: 'rotate', id: selected.id, delta: -15 })}
                aria-label="Rotate left"
              >
                <IconRotateLeft />
              </button>
              <button
                type="button"
                onClick={() => dispatch({ type: 'rotate', id: selected.id, delta: 15 })}
                aria-label="Rotate right"
              >
                <IconRotateRight />
              </button>
              <span className="sep" />
              <button
                type="button"
                onClick={() => dispatch({ type: 'resize', id: selected.id, delta: -1.5 })}
                aria-label="Make smaller"
              >
                <IconMinus />
              </button>
              <button
                type="button"
                onClick={() => dispatch({ type: 'resize', id: selected.id, delta: 1.5 })}
                aria-label="Make bigger"
              >
                <IconPlus />
              </button>
              <span className="sep" />
              <button
                type="button"
                onClick={() => {
                  if (remaining <= 0) {
                    showToast('No flowers left to duplicate with.');
                    return;
                  }
                  dispatch({ type: 'duplicate', id: selected.id });
                  cue('place');
                }}
                aria-label="Duplicate flower"
              >
                <IconCopy />
              </button>
              <button
                type="button"
                className="is-danger"
                onClick={() => {
                  dispatch({ type: 'remove', id: selected.id });
                  cue('delete');
                }}
                aria-label="Delete flower"
              >
                <IconTrash />
              </button>
            </div>
          )}
        </div>

        {/* --- dock ----------------------------------------------------- */}
        <div className="onam-dock" id="onam-dock">
          <div className="onam-tabs" role="tablist" aria-label="Pookalam tools">
            {TABS.map(({ id, label, Icon }) => (
              <button
                key={id}
                type="button"
                role="tab"
                id={`onam-tab-${id}`}
                aria-selected={tab === id}
                aria-controls={`onam-panel-${id}`}
                className={`onam-tab${tab === id ? ' is-active' : ''}`}
                onClick={() => setTab(id)}
              >
                <Icon />
                <span>{label}</span>
              </button>
            ))}
          </div>

          {/* Flowers */}
          {tab === 'flowers' && (
            <div
              className="onam-panel"
              role="tabpanel"
              id="onam-panel-flowers"
              aria-labelledby="onam-tab-flowers"
            >
              <h4>Choose a flower, then tap the mat</h4>
              <div className="onam-flowers" role="group" aria-label="Flowers">
                {visibleFlowers.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    className={`onam-fcard${activeFlower === f.id ? ' is-active' : ''}`}
                    onClick={() => {
                      setActiveFlower(f.id);
                      setTool('place');
                      if (state.selectedId) {
                        // A flower is selected on the mat: recolour it rather
                        // than making the tap do nothing visible.
                        dispatch({ type: 'swapOne', id: state.selectedId, flowerId: f.id });
                      }
                    }}
                    aria-pressed={activeFlower === f.id}
                    title={`${f.label} — ${f.gloss}`}
                  >
                    <Bloom flowerId={f.id} size={46} />
                    <span className="nm">{f.label}</span>
                    <span className="gl">{f.gloss}</span>
                  </button>
                ))}
              </div>

              <p className="onam-sub" style={{ margin: '10px 0 8px' }}>
                Size
              </p>
              <div className="onam-row">
                {SIZES.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className={`onam-btn${activeSize === s.value ? ' is-on' : ''}`}
                    onClick={() => setActiveSize(s.value)}
                    aria-pressed={activeSize === s.value}
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              <p className="onam-hint">
                Laying <b>{flowerById(activeFlower)?.label}</b>. Tap a flower on the
                mat to select it, then drag to move it. Everything you lay stays
                put until you clear it.
              </p>
            </div>
          )}

          {/* Colours */}
          {tab === 'colours' && (
            <div
              className="onam-panel"
              role="tabpanel"
              id="onam-panel-colours"
              aria-labelledby="onam-tab-colours"
            >
              <h4>Colour family · narrows the flowers you can place</h4>
              <div className="onam-swatches" role="group" aria-label="Colour families">
                {FAMILIES.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    className={`onam-swatch${state.family === f.id ? ' is-active' : ''}`}
                    onClick={() => dispatch({ type: 'setFamily', id: f.id })}
                    aria-pressed={state.family === f.id}
                  >
                    <i style={{ background: f.swatch }} />
                    {f.label}
                  </button>
                ))}
              </div>

              <p className="onam-sub">Recolour what is already down</p>
              <div className="onam-row">
                <button
                  type="button"
                  className="onam-btn"
                  onClick={() => dispatch({ type: 'swapAll', flowerId: activeFlower })}
                  disabled={!used}
                >
                  Swap all to {flowerById(activeFlower)?.label}
                </button>
                <button
                  type="button"
                  className="onam-btn"
                  onClick={() => dispatch({ type: 'harmoniseRings', flowerIds: flowerIds })}
                  disabled={!used}
                >
                  Harmonise by ring
                </button>
              </div>

              <p className="onam-hint">
                Picking a family narrows the palette to those blooms.{' '}
                <b>Harmonise by ring</b> gives every ring of your carpet a single
                flower, which is how a real pookalam gets its bands of colour.
              </p>
            </div>
          )}

          {/* Tools */}
          {tab === 'tools' && (
            <div
              className="onam-panel"
              role="tabpanel"
              id="onam-panel-tools"
              aria-labelledby="onam-tab-tools"
            >
              <h4>Mat tools</h4>
              <div className="onam-row">
                <button
                  type="button"
                  className={`onam-btn${state.snap ? ' is-on' : ''}`}
                  onClick={() => dispatch({ type: 'toggleSnap' })}
                  aria-pressed={state.snap}
                >
                  <IconGrid />
                  Guides &amp; snap: {state.snap ? 'On' : 'Off'}
                </button>
                <button
                  type="button"
                  className={`onam-btn${tool === 'erase' ? ' is-on' : ''}`}
                  onClick={() => setTool((t) => (t === 'erase' ? 'place' : 'erase'))}
                  aria-pressed={tool === 'erase'}
                >
                  <IconEraser />
                  Eraser
                </button>
                <button
                  type="button"
                  className="onam-btn"
                  onClick={() => {
                    /* The lamp is one bloom plus two rings of eight, and the
                       engine lays it all or not at all. Say so rather than
                       letting the button look broken. */
                    if (remaining < CENTREPIECE_COST) {
                      showToast(
                        `A centrepiece needs up to ${CENTREPIECE_COST} flowers and you have ${remaining}.`
                      );
                      return;
                    }
                    dispatch({ type: 'centrepiece', flowerId: activeFlower });
                    cue('pattern');
                  }}
                  disabled={remaining <= 0}
                >
                  <IconLamp />
                  Add centrepiece
                </button>
              </div>

              <p className="onam-sub">Start from a design</p>
              <div className="onam-templates">
                {TEMPLATES.map((tpl) => (
                  <button
                    key={tpl.id}
                    type="button"
                    className="onam-tcard"
                    onClick={() => loadTemplate(tpl)}
                  >
                    <span className="tl">{tpl.label}</span>
                    <span className="tn">
                      {tpl.blooms ? `${tpl.blooms} flowers` : 'Blank mat'}
                    </span>
                  </button>
                ))}
              </div>

              <p className="onam-sub">For a challenge</p>
              <div className="onam-row">
                <button type="button" className="onam-btn" onClick={doSurprise}>
                  <IconDice />
                  Surprise me
                </button>
                <button
                  type="button"
                  className={`onam-btn${secondsLeft !== null ? ' is-on' : ''}`}
                  onClick={() => (secondsLeft === null ? startChallenge() : setSecondsLeft(null))}
                >
                  <IconTimer />
                  {secondsLeft === null ? 'Start 6-minute challenge' : 'Stop challenge'}
                </button>
              </div>

              <p className="onam-hint">
                A template clears the mat and lays a full {BUDGET}-flower design you
                can then pull apart. <b>Guides &amp; snap</b> lines flowers up on
                rings and spokes, which is what keeps a hand-laid carpet true.
              </p>
            </div>
          )}

          {/* Symmetry */}
          {tab === 'symmetry' && (
            <div
              className="onam-panel"
              role="tabpanel"
              id="onam-panel-symmetry"
              aria-labelledby="onam-tab-symmetry"
            >
              <h4>Radial symmetry · one tap lays a whole pattern</h4>
              <div className="onam-folds" role="group" aria-label="Symmetry">
                {FOLDS.map((f) => (
                  <button
                    key={f.n}
                    type="button"
                    className={`onam-btn${state.symmetry === f.n ? ' is-on' : ''}`}
                    onClick={() => dispatch({ type: 'setSymmetry', n: f.n })}
                    aria-pressed={state.symmetry === f.n}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              <p className="onam-sub">And a mirror</p>
              <div className="onam-row">
                <button
                  type="button"
                  className={`onam-btn${state.mirror ? ' is-on' : ''}`}
                  onClick={() => dispatch({ type: 'toggleMirror' })}
                  aria-pressed={state.mirror}
                >
                  <IconMirror />
                  Mirror reflection
                </button>
                <button
                  type="button"
                  className="onam-btn"
                  onClick={() => {
                    const cost = selected
                      ? symmetryPositions({
                          x: selected.x,
                          y: selected.y,
                          symmetry: state.symmetry,
                          mirror: state.mirror,
                        }).length - 1
                      : 0;
                    if (cost > remaining) {
                      showToast(
                        `Mirroring that needs ${cost} more flowers and you have ${remaining}.`
                      );
                      return;
                    }
                    dispatch({ type: 'symmetriseSelection' });
                    cue('pattern');
                  }}
                  disabled={!selected || state.symmetry === 1}
                >
                  Symmetrise selection
                </button>
              </div>

              <p className="onam-hint">
                Every mirrored flower costs one of your {BUDGET}. If a pattern needs
                more than you have left it will not land at all, rather than
                landing half-finished — hover the mat with a mouse and you can see
                exactly where the copies will go before you spend anything.
              </p>
            </div>
          )}

          {/* Sketch */}
          {tab === 'sketch' && (
            <div
              className="onam-panel"
              role="tabpanel"
              id="onam-panel-sketch"
              aria-labelledby="onam-tab-sketch"
            >
              <h4>Draw your idea, then fill it with flowers</h4>
              <div className="onam-row">
                <button
                  type="button"
                  className={`onam-btn${state.sketchOn ? ' is-on' : ''}`}
                  onClick={() => dispatch({ type: 'toggleSketch' })}
                  aria-pressed={state.sketchOn}
                >
                  <IconSketch />
                  Sketch mode
                </button>
                <button
                  type="button"
                  className={`onam-btn${state.sketchVisible ? ' is-on' : ''}`}
                  onClick={() => dispatch({ type: 'toggleSketchVisible' })}
                  aria-pressed={state.sketchVisible}
                >
                  Show sketch
                </button>
                <button
                  type="button"
                  className="onam-btn"
                  onClick={() => dispatch({ type: 'sketchUndo' })}
                  disabled={!state.sketch.length}
                >
                  <IconUndo />
                  Undo stroke
                </button>
                <button
                  type="button"
                  className="onam-btn is-danger"
                  onClick={() => dispatch({ type: 'sketchClear' })}
                  disabled={!state.sketch.length}
                >
                  Clear sketch
                </button>
              </div>

              <p className="onam-sub">Then turn it into flowers</p>
              <div className="onam-row">
                <button
                  type="button"
                  className="onam-btn is-primary"
                  onClick={() => doSketchFill('trace')}
                  disabled={!state.sketch.length || remaining <= 0}
                >
                  Turn sketch into pookalam
                </button>
                <button
                  type="button"
                  className="onam-btn"
                  onClick={() => doSketchFill('inside')}
                  disabled={!state.sketch.length || remaining <= 0}
                >
                  Fill inside shape
                </button>
              </div>

              <p className="onam-hint">
                Draw a heart, a star, an elephant, a boat, your initials. The
                outline stays as a faint guide, and the flowers land along it —{' '}
                <b>Fill inside shape</b> packs the whole area instead of tracing
                the line.
              </p>
            </div>
          )}

          {/* Finish */}
          {tab === 'finish' && (
            <div
              className="onam-panel"
              role="tabpanel"
              id="onam-panel-finish"
              aria-labelledby="onam-tab-finish"
            >
              <h4>Name your creation</h4>
              <label className="onam-field">
                <span>Pookalam name</span>
                <input
                  type="text"
                  value={title}
                  maxLength={48}
                  placeholder="My Onam Pookalam"
                  onChange={(e) => setTitle(e.target.value)}
                />
              </label>
              <label className="onam-field">
                <span>Your name</span>
                <input
                  type="text"
                  value={creator}
                  maxLength={32}
                  placeholder="Your name"
                  onChange={(e) => setCreator(e.target.value)}
                />
              </label>

              <p className="onam-sub">History &amp; mat</p>
              <div className="onam-row">
                <button
                  type="button"
                  className="onam-btn"
                  onClick={() => {
                    dispatch({ type: 'undo' });
                    cue('undo');
                  }}
                  disabled={!state.past.length}
                >
                  <IconUndo />
                  Undo
                </button>
                <button
                  type="button"
                  className="onam-btn"
                  onClick={() => dispatch({ type: 'redo' })}
                  disabled={!state.future.length}
                >
                  <IconRedo />
                  Redo
                </button>
                <button
                  type="button"
                  className="onam-btn is-danger"
                  onClick={() => setModal('reset')}
                  disabled={!used}
                >
                  <IconReset />
                  Start over
                </button>
              </div>

              <p className="onam-sub">Save &amp; share</p>
              <div className="onam-row">
                {Object.entries(FORMATS).map(([key, f]) => (
                  <button
                    key={key}
                    type="button"
                    className={`onam-btn${format === key ? ' is-on' : ''}`}
                    onClick={() => setFormat(key)}
                    aria-pressed={format === key}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <div className="onam-share">
                <button
                  type="button"
                  className="onam-sharebtn"
                  onClick={() => doExport('share')}
                  disabled={!used || !!busy}
                >
                  <IconShare />
                  {busy === 'share' ? 'Working…' : canShareFiles ? 'Share picture' : 'Download'}
                </button>
                <button
                  type="button"
                  className="onam-sharebtn is-whatsapp"
                  onClick={doWhatsApp}
                  disabled={!used || !!busy}
                >
                  <IconWhatsApp />
                  {busy === 'whatsapp' ? 'Saving…' : 'WhatsApp'}
                </button>
                <button
                  type="button"
                  className="onam-sharebtn"
                  onClick={doCaption}
                  disabled={!used}
                >
                  <IconCopy />
                  Copy caption
                </button>
                <button
                  type="button"
                  className="onam-sharebtn"
                  onClick={doSave}
                  disabled={!used || !!busy}
                >
                  <IconSave />
                  {busy === 'save' ? 'Saving…' : 'Keep on device'}
                </button>
              </div>

              <p className="onam-sub">Enter the contest</p>
              <div className="onam-row">
                <button
                  type="button"
                  className="onam-btn is-gold"
                  onClick={() => {
                    setEntryError('');
                    setModal('enter');
                  }}
                  disabled={!used || !!busy}
                >
                  <IconTrophy />
                  Enter this pookalam
                </button>
              </div>
              {myEntries.length > 0 && myEntries.map((e) => <MyEntry key={e.id} entry={e} />)}

              {coupon && (
                <>
                  <p className="onam-sub">Your Onam offer</p>
                  <div className="onam-row">
                    <button type="button" className="onam-code" onClick={copyCoupon}>
                      {coupon}
                    </button>
                    <Link className="onam-btn is-gold" to="/shop">
                      Shop the season
                    </Link>
                  </div>
                </>
              )}

              <p className="onam-hint">
                <b>Keep on device</b> stores the design in this browser only —
                nothing is uploaded. Entering the contest does upload the
                picture, so we can post it and judge it.{' '}
                {canShareFiles
                  ? 'Share picture opens your phone’s share sheet with the image attached.'
                  : 'Your browser cannot attach a picture to a share sheet, so Share downloads it instead.'}
              </p>
            </div>
          )}
        </div>

        {/* --- footer CTA ----------------------------------------------- */}
        <div className="onam-foot">
          <div className="onam-footcard">
            <p className="onam-eyebrow">From our mill</p>
            <h2>Oils pressed the week they are sent</h2>
            <p>
              While you lay flowers: the sesame, coconut and groundnut oils are
              cold-pressed in small batches at our family mill and go out the
              same week. {countdown ? `${countdown}.` : ''}
            </p>
            <div className="onam-row is-center">
              <Link className="onam-btn is-primary" to="/shop">
                Shop the season
              </Link>
              <Link className="onam-btn" to="/festivals">
                Festival calendar
              </Link>
            </div>
            <p className="onam-fineprint">
              The game itself runs entirely in your browser. Nothing is uploaded
              unless you enter the contest.
            </p>
          </div>
        </div>

        {/* --- contest gallery ---------------------------------------- */}
        {/* Only ever approved entries — the server does that filtering, so an
            unreviewed submission cannot reach the storefront even by mistake. */}
        {gallery.length > 0 && (
          <div className="onam-gallery-wrap">
            <p className="onam-eyebrow">Contest</p>
            <h2
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'clamp(20px, 2.8vw, 26px)',
                fontWeight: 600,
                letterSpacing: '-0.02em',
                color: 'var(--on-green)',
                margin: '0 0 4px',
              }}
            >
              Pookalams people have laid
            </h2>
            <p className="onam-hint" style={{ margin: '0 auto', maxWidth: '52ch' }}>
              {gallery.some((e) => e.winner)
                ? 'The winner is picked by us and gets an offer or a gift from the mill.'
                : 'Enter yours from the Finish tab. We pick a winner and send them an offer or a gift.'}
            </p>
            <div className="onam-gallery">
              {gallery.map((e) => (
                <figure className={`onam-gcard${e.winner ? ' is-winner' : ''}`} key={e.id}>
                  {e.winner && <span className="crown">Winner</span>}
                  <img src={e.image} alt={e.title || 'A pookalam'} loading="lazy" />
                  <figcaption>
                    <span className="gt">{e.title || 'Untitled'}</span>
                    <span className="gm">
                      {e.name} · {e.blooms} flowers
                    </span>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* --- mobile drawer --------------------------------------------- */}
      {drawer && (
        <div
          className="onam-drawer"
          role="dialog"
          aria-modal="true"
          aria-label="Game menu"
          onClick={(e) => {
            if (e.target === e.currentTarget) setDrawer(false);
          }}
        >
          <div className="onam-drawer-sheet">
            <div className="onam-drawer-head">
              <span>Menu</span>
              <button
                type="button"
                className="onam-x"
                style={{ position: 'static' }}
                onClick={() => setDrawer(false)}
                aria-label="Close menu"
              >
                <IconClose />
              </button>
            </div>
            <button type="button" className="onam-btn" onClick={openDesigns}>
              <IconDesigns />
              My designs
            </button>
            <button
              type="button"
              className="onam-btn"
              onClick={() => {
                setModal('howto');
                setDrawer(false);
              }}
            >
              <IconHelp />
              How to play
            </button>
            <button
              type="button"
              className="onam-btn"
              onClick={() => {
                setTab('tools');
                setDrawer(false);
              }}
            >
              <IconTools />
              Start from a design
            </button>
            <button type="button" className="onam-btn" onClick={startChallenge}>
              <IconTimer />
              Timed challenge
            </button>
            <button
              type="button"
              className="onam-btn"
              onClick={() => {
                setTab('finish');
                setDrawer(false);
              }}
            >
              <IconFinish />
              Save &amp; export
            </button>
            <button
              type="button"
              className={`onam-btn${soundOn ? ' is-on' : ''}`}
              onClick={() => setSoundOn((s) => !s)}
            >
              {soundOn ? <IconSoundOn /> : <IconSoundOff />}
              Sound {soundOn ? 'on' : 'off'}
            </button>
            <button
              type="button"
              className="onam-btn is-danger"
              onClick={() => {
                setModal('reset');
                setDrawer(false);
              }}
              disabled={!used}
            >
              <IconReset />
              Reset pookalam
            </button>
          </div>
        </div>
      )}

      {/* --- modals ---------------------------------------------------- */}
      {modal === 'welcome' && (
        <div className="onam-scrim" role="dialog" aria-modal="true" aria-label="Welcome">
          <div className="onam-modal">
            <p className="onam-eyebrow">Celebrate Onam in colour</p>
            <h2>Lay a pookalam</h2>
            <p>
              Two hundred flowers, an empty doorstep mat, and no rules. Arrange
              blooms your way, sketch an idea, then turn it into a carpet that
              looks like nobody else&apos;s.
            </p>
            <div style={{ margin: '18px 0 10px' }}>
              <Bloom flowerId="chendumalli" size={64} />
            </div>
            <div className="onam-row is-center">
              <button type="button" className="onam-btn is-primary is-big" onClick={dismissWelcome}>
                Start creating
              </button>
            </div>
            <p className="onam-hint" style={{ textAlign: 'center' }}>
              No rules. Just colour, rhythm, and celebration.
            </p>
          </div>
        </div>
      )}

      {modal === 'howto' && (
        <div className="onam-scrim" role="dialog" aria-modal="true" aria-label="How to play" onClick={scrimClose}>
          <div className="onam-modal">
            <button
              type="button"
              className="onam-x"
              onClick={() => setModal(null)}
              aria-label="Close"
            >
              <IconClose />
            </button>
            <h2>How to play</h2>
            <ol className="onam-steps">
              <li>
                You start with <b>{BUDGET} flowers</b>.
              </li>
              <li>
                Pick one from the <b>Flowers</b> tab.
              </li>
              <li>Tap the mat to lay it down.</li>
              <li>Tap a laid flower to select it; drag to move it.</li>
              <li>
                Use <b>Symmetry</b> and one tap becomes a whole pattern.
              </li>
              <li>
                Switch on <b>Sketch</b> if you have a shape in mind, then fill it.
              </li>
              <li>
                Use all {BUDGET} for <b>Full Bloom</b> — and the season&apos;s offer.
              </li>
              <li>Save the picture, or keep the design on this device.</li>
            </ol>
            <h3>Keyboard</h3>
            <div className="onam-keys">
              <span>
                <kbd>Ctrl/⌘+Z</kbd> undo
              </span>
              <span>
                <kbd>⇧+Ctrl/⌘+Z</kbd> redo
              </span>
              <span>
                <kbd>Del</kbd> delete
              </span>
              <span>
                <kbd>Q</kbd>
                <kbd>E</kbd> rotate
              </span>
              <span>
                <kbd>+</kbd>
                <kbd>−</kbd> resize
              </span>
              <span>
                <kbd>↑↓←→</kbd> nudge
              </span>
              <span>
                <kbd>Esc</kbd> deselect
              </span>
            </div>
            <div className="onam-row is-center" style={{ marginTop: 20 }}>
              <button type="button" className="onam-btn is-primary" onClick={() => setModal(null)}>
                <IconCheck />
                Got it
              </button>
            </div>
          </div>
        </div>
      )}

      {modal === 'reset' && (
        <div className="onam-scrim" role="dialog" aria-modal="true" aria-label="Start over" onClick={scrimClose}>
          <div className="onam-modal" style={{ maxWidth: 400 }}>
            <h2>Start over?</h2>
            <p>Your current pookalam will be cleared. This cannot be undone.</p>
            <div className="onam-row is-center" style={{ marginTop: 20 }}>
              <button type="button" className="onam-btn" onClick={() => setModal(null)}>
                Cancel
              </button>
              <button type="button" className="onam-btn is-primary" onClick={doReset}>
                Start over
              </button>
            </div>
          </div>
        </div>
      )}

      {modal === 'designs' && (
        <div className="onam-scrim" role="dialog" aria-modal="true" aria-label="My designs" onClick={scrimClose}>
          <div className="onam-modal is-wide">
            <button
              type="button"
              className="onam-x"
              onClick={() => setModal(null)}
              aria-label="Close"
            >
              <IconClose />
            </button>
            <h2>My designs</h2>
            <p>Saved on this device only. Load one to keep working on it.</p>
            {designs.length ? (
              <div className="onam-designs">
                {designs.map((d) => (
                  <div className="onam-design" key={d.id}>
                    {d.thumbnail ? (
                      <img src={d.thumbnail} alt={d.title || 'Saved pookalam'} />
                    ) : null}
                    <span className="dn">{d.title || 'Untitled'}</span>
                    <span className="dm">
                      {d.blooms?.length ?? 0} flowers · {d.score ?? 0} pts
                    </span>
                    <div className="drow">
                      <button
                        type="button"
                        onClick={() => {
                          dispatch({ type: 'loadBlooms', blooms: d.blooms || [] });
                          setTitle(d.title || 'My Onam Pookalam');
                          setCreator(d.creator || '');
                          setView({ zoom: 1, pan: { x: 0, y: 0 } });
                          setModal(null);
                          showToast('Design loaded');
                        }}
                      >
                        Load
                      </button>
                      <button
                        type="button"
                        className="is-danger"
                        onClick={() => {
                          deleteDesign(d.id);
                          setDesigns(listDesigns());
                        }}
                        aria-label={`Delete ${d.title || 'design'}`}
                      >
                        <IconTrash style={{ width: 13, height: 13 }} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="onam-empty-note">
                Nothing saved yet. Lay a pookalam, then use{' '}
                <b>Keep on this device</b> in the Finish tab.
              </p>
            )}
          </div>
        </div>
      )}

      {modal === 'enter' && (
        <div
          className="onam-scrim"
          role="dialog"
          aria-modal="true"
          aria-label="Enter the contest"
          onClick={scrimClose}
        >
          <div className="onam-modal">
            <button
              type="button"
              className="onam-x"
              onClick={() => setModal(null)}
              aria-label="Close"
            >
              <IconClose />
            </button>
            <p className="onam-eyebrow">Onam contest</p>
            <h2>Enter your pookalam</h2>
            <p>
              We check every entry before posting it. Pick a winner&apos;s worth of
              flowers and you could win an offer or a gift from the mill.
            </p>

            {/* Drawing the 1080px picture takes a second or two. Saying so beats
                a silent gap where the image is about to appear. */}
            {preview?.url ? (
              <img className="onam-preview" src={preview.url} alt="Your pookalam" />
            ) : (
              <p className="onam-empty-note">Drawing your picture…</p>
            )}

            <div style={{ textAlign: 'left', marginTop: 16 }}>
              <label className="onam-field">
                <span>Pookalam name</span>
                <input
                  type="text"
                  value={title}
                  maxLength={60}
                  placeholder="My Onam Pookalam"
                  onChange={(e) => setTitle(e.target.value)}
                />
              </label>
              <label className="onam-field">
                <span>Your name</span>
                <input
                  type="text"
                  value={entryName}
                  maxLength={40}
                  placeholder="The name to post it under"
                  onChange={(e) => setEntryName(e.target.value)}
                />
              </label>
              <label className="onam-field">
                <span>Mobile number</span>
                <input
                  type="tel"
                  inputMode="numeric"
                  value={entryPhone}
                  maxLength={14}
                  placeholder="10-digit mobile"
                  onChange={(e) => setEntryPhone(e.target.value)}
                />
              </label>
              <label className="onam-consent">
                <input
                  type="checkbox"
                  checked={entryConsent}
                  onChange={(e) => setEntryConsent(e.target.checked)}
                />
                <span>
                  You may post my pookalam and my first name on this site, and
                  contact me on this number if I win.
                </span>
              </label>
            </div>

            {entryError && <p className="onam-formerr">{entryError}</p>}

            <div className="onam-row is-center" style={{ marginTop: 18 }}>
              <button
                type="button"
                className="onam-btn is-primary is-big"
                onClick={doEnterContest}
                disabled={busy === 'enter'}
              >
                <IconTrophy />
                {busy === 'enter' ? 'Sending…' : 'Send my entry'}
              </button>
              <button type="button" className="onam-btn is-ghost" onClick={() => setModal(null)}>
                Not now
              </button>
            </div>
            <p className="onam-hint" style={{ textAlign: 'center' }}>
              {token
                ? 'Because you are signed in, a prize coupon would be locked to your account.'
                : 'Entering as a guest is fine. Sign in first and any prize coupon can be locked to your account.'}
            </p>
          </div>
        </div>
      )}

      {modal === 'bloom' && (
        <div className="onam-scrim" role="dialog" aria-modal="true" aria-label="Full bloom" onClick={scrimClose}>
          <div className="onam-modal is-wide">
            <button
              type="button"
              className="onam-x"
              onClick={() => setModal(null)}
              aria-label="Close"
            >
              <IconClose />
            </button>
            <p className="onam-eyebrow">Full bloom</p>
            <h2>Onam ashamsakal 🌼</h2>
            <p>You used all {BUDGET} flowers.</p>

            {preview?.url ? (
              <img className="onam-preview" src={preview.url} alt="Your finished pookalam" />
            ) : (
              <p className="onam-empty-note">Drawing your image…</p>
            )}

            <div className="onam-scorebar">
              <span className="v">{score}</span>
              <span className="track">
                <i style={{ width: `${score}%` }} />
              </span>
            </div>
            <p className="onam-fineprint" style={{ marginTop: 0 }}>
              Pookalam score · just for fun · {serialOf(state.blooms)}
            </p>

            {onam?.couponCode ? (
              <>
                <h3>Your Onam offer</h3>
                <button type="button" className="onam-code" onClick={copyCoupon}>
                  {onam.couponCode}
                </button>
                <p className="onam-fineprint">Tap to copy — use it at checkout</p>
              </>
            ) : (
              <p className="onam-hint" style={{ textAlign: 'center' }}>
                Beautifully laid. There is no Onam offer running just now — but the
                oils are pressed the same week they are sent, festival or not.
              </p>
            )}

            <h3>Take it with you</h3>
            <div className="onam-row is-center">
              {Object.entries(FORMATS).map(([key, f]) => (
                <button
                  key={key}
                  type="button"
                  className={`onam-btn${format === key ? ' is-on' : ''}`}
                  onClick={() => setFormat(key)}
                  aria-pressed={format === key}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <div className="onam-row is-center" style={{ marginTop: 10 }}>
              <button
                type="button"
                className="onam-btn is-primary"
                onClick={() => doExport('share')}
                disabled={!!busy}
              >
                <IconDownload />
                {busy === 'share' ? 'Working…' : 'Download or share'}
              </button>
              <button type="button" className="onam-btn" onClick={doCaption}>
                <IconCopy />
                Copy caption
              </button>
            </div>
            <div className="onam-row is-center" style={{ marginTop: 10 }}>
              <button
                type="button"
                className="onam-btn is-gold"
                onClick={() => {
                  setEntryError('');
                  setModal('enter');
                }}
              >
                <IconTrophy />
                Enter the contest
              </button>
              <button
                type="button"
                className="onam-sharebtn is-whatsapp"
                style={{ flexDirection: 'row', gap: 8, padding: '11px 17px', borderRadius: 999 }}
                onClick={doWhatsApp}
                disabled={!!busy}
              >
                <IconWhatsApp />
                {busy === 'whatsapp' ? 'Saving…' : 'WhatsApp'}
              </button>
            </div>
            <div className="onam-row is-center" style={{ marginTop: 10 }}>
              <Link className="onam-btn" to="/shop">
                Shop the season
              </Link>
              <button type="button" className="onam-btn is-ghost" onClick={doReset}>
                Create another
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
