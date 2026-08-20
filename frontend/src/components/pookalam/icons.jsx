/**
 * Line icons for the pookalam game.
 *
 * All one weight, all on a 24-grid, all inheriting `currentColor` so a button's
 * hover colour carries the icon with it. Drawn here rather than pulled from the
 * shop's Icons.jsx because that set is a storefront vocabulary (cart, truck,
 * leaf) and this page needs an editor's (rotate, duplicate, mirror, eraser) —
 * mixing two icon grids in one toolbar is the thing that makes a toolbar look
 * assembled rather than designed.
 */

/* One wrapper so stroke weight, caps and joins can never drift between icons. */
function I({ children, ...rest }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

/* --- Dock tabs ----------------------------------------------------------- */
export const IconFlower = (p) => (
  <I {...p}>
    <circle cx="12" cy="12" r="2.4" />
    <path d="M12 9.6V4.2M12 14.4V19.8M9.6 12H4.2M14.4 12h5.4M10.3 10.3 6.5 6.5M13.7 13.7l3.8 3.8M13.7 10.3l3.8-3.8M10.3 13.7l-3.8 3.8" />
  </I>
);

export const IconPalette = (p) => (
  <I {...p}>
    <path d="M12 3.2a8.8 8.8 0 0 0 0 17.6c1.3 0 1.9-.8 1.9-1.7 0-1.6-1.6-1.7-1.6-3 0-1 .8-1.7 1.9-1.7h1.6a4.9 4.9 0 0 0 4.9-4.9C20.7 6 16.8 3.2 12 3.2Z" />
    <circle cx="8.4" cy="9.2" r="1.05" fill="currentColor" stroke="none" />
    <circle cx="12" cy="7.2" r="1.05" fill="currentColor" stroke="none" />
    <circle cx="15.6" cy="9.2" r="1.05" fill="currentColor" stroke="none" />
  </I>
);

export const IconTools = (p) => (
  <I {...p}>
    <path d="m12 3 2.2 4.9 5.3.4-4 3.5 1.2 5.2L12 14.3l-4.7 2.7 1.2-5.2-4-3.5 5.3-.4z" />
  </I>
);

export const IconMirror = (p) => (
  <I {...p}>
    <path d="M12 3v18" strokeDasharray="2.6 2.8" />
    <path d="M9 6.6 4.2 12 9 17.4zM15 6.6 19.8 12 15 17.4z" />
  </I>
);

export const IconSketch = (p) => (
  <I {...p}>
    <path d="M4 20.2 5 16l10-10 3 3-10 10z" />
    <path d="M14.2 6.8 17.2 9.8" />
    <path d="M15.6 4.6 17 3.2a1.4 1.4 0 0 1 2 0l1.8 1.8a1.4 1.4 0 0 1 0 2l-1.4 1.4z" />
  </I>
);

export const IconFinish = (p) => (
  <I {...p}>
    <path d="M12 15.4V3.6m0 0L8.2 7.4M12 3.6l3.8 3.8" />
    <path d="M4.4 13.8v4.8a1.6 1.6 0 0 0 1.6 1.6h12a1.6 1.6 0 0 0 1.6-1.6v-4.8" />
  </I>
);

/* --- Topbar -------------------------------------------------------------- */
export const IconDesigns = (p) => (
  <I {...p}>
    <rect x="3.4" y="3.4" width="7.2" height="7.2" rx="1.6" />
    <rect x="13.4" y="3.4" width="7.2" height="7.2" rx="1.6" />
    <rect x="3.4" y="13.4" width="7.2" height="7.2" rx="1.6" />
    <rect x="13.4" y="13.4" width="7.2" height="7.2" rx="1.6" />
  </I>
);

export const IconHelp = (p) => (
  <I {...p}>
    <circle cx="12" cy="12" r="8.8" />
    <path d="M9.6 9.4a2.5 2.5 0 1 1 3.6 2.3c-.8.5-1.2 1-1.2 1.9" />
    <circle cx="12" cy="16.6" r="0.95" fill="currentColor" stroke="none" />
  </I>
);

export const IconSoundOn = (p) => (
  <I {...p}>
    <path d="M4.6 9.4h3l4-3.2v11.6l-4-3.2h-3z" />
    <path d="M15.4 9.2a3.8 3.8 0 0 1 0 5.6M18 6.6a7.4 7.4 0 0 1 0 10.8" />
  </I>
);

export const IconSoundOff = (p) => (
  <I {...p}>
    <path d="M4.6 9.4h3l4-3.2v11.6l-4-3.2h-3z" />
    <path d="m15.6 9.8 4.4 4.4M20 9.8l-4.4 4.4" />
  </I>
);

export const IconReset = (p) => (
  <I {...p}>
    <path d="M3.8 12a8.2 8.2 0 1 0 2.5-5.9" />
    <path d="M3.6 4.4v4.2h4.2" />
  </I>
);

export const IconMenu = (p) => (
  <I {...p}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </I>
);

export const IconClose = (p) => (
  <I {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </I>
);

/* --- Zoom ---------------------------------------------------------------- */
export const IconZoomIn = (p) => (
  <I {...p}>
    <circle cx="10.8" cy="10.8" r="6.6" />
    <path d="M15.6 15.6 20.4 20.4M10.8 8.2v5.2M8.2 10.8h5.2" />
  </I>
);

export const IconZoomOut = (p) => (
  <I {...p}>
    <circle cx="10.8" cy="10.8" r="6.6" />
    <path d="M15.6 15.6 20.4 20.4M8.2 10.8h5.2" />
  </I>
);

export const IconZoomFit = (p) => (
  <I {...p}>
    <path d="M3.6 8.4V4.8a1.2 1.2 0 0 1 1.2-1.2h3.6M20.4 8.4V4.8a1.2 1.2 0 0 0-1.2-1.2h-3.6M3.6 15.6v3.6a1.2 1.2 0 0 0 1.2 1.2h3.6M20.4 15.6v3.6a1.2 1.2 0 0 1-1.2 1.2h-3.6" />
  </I>
);

/* --- Selected-flower toolbar -------------------------------------------- */
export const IconRotateLeft = (p) => (
  <I {...p}>
    <path d="M4.2 12a7.8 7.8 0 1 1 2.4 5.6" />
    <path d="M4 7.8V12h4.2" />
  </I>
);

export const IconRotateRight = (p) => (
  <I {...p}>
    <path d="M19.8 12a7.8 7.8 0 1 0-2.4 5.6" />
    <path d="M20 7.8V12h-4.2" />
  </I>
);

export const IconMinus = (p) => (
  <I {...p}>
    <path d="M5.4 12h13.2" />
  </I>
);

export const IconPlus = (p) => (
  <I {...p}>
    <path d="M12 5.4v13.2M5.4 12h13.2" />
  </I>
);

export const IconCopy = (p) => (
  <I {...p}>
    <rect x="8.6" y="8.6" width="11.8" height="11.8" rx="2" />
    <path d="M15.4 5.6H5.6a2 2 0 0 0-2 2v9.8" />
  </I>
);

export const IconTrash = (p) => (
  <I {...p}>
    <path d="M4.6 6.8h14.8M9.4 6.8V4.6h5.2v2.2" />
    <path d="M6.6 6.8l.9 12a1.4 1.4 0 0 0 1.4 1.3h6.2a1.4 1.4 0 0 0 1.4-1.3l.9-12" />
    <path d="M10.4 10.6v6M13.6 10.6v6" />
  </I>
);

/* --- Panels -------------------------------------------------------------- */
export const IconUndo = (p) => (
  <I {...p}>
    <path d="M4 10.4h9.6a5.2 5.2 0 0 1 0 10.4H8" />
    <path d="M7.6 6 4 10.4 7.6 14.8" />
  </I>
);

export const IconRedo = (p) => (
  <I {...p}>
    <path d="M20 10.4h-9.6a5.2 5.2 0 0 0 0 10.4H16" />
    <path d="M16.4 6 20 10.4 16.4 14.8" />
  </I>
);

export const IconShare = (p) => (
  <I {...p}>
    <path d="M12 15.4V3.6m0 0L8.2 7.4M12 3.6l3.8 3.8" />
    <path d="M4.4 13.8v4.8a1.6 1.6 0 0 0 1.6 1.6h12a1.6 1.6 0 0 0 1.6-1.6v-4.8" />
  </I>
);

export const IconDownload = (p) => (
  <I {...p}>
    <path d="M12 3.6v11.8m0 0 3.8-3.8M12 15.4l-3.8-3.8" />
    <path d="M4.4 13.8v4.8a1.6 1.6 0 0 0 1.6 1.6h12a1.6 1.6 0 0 0 1.6-1.6v-4.8" />
  </I>
);

export const IconDice = (p) => (
  <I {...p}>
    <rect x="3.8" y="3.8" width="16.4" height="16.4" rx="3.4" />
    <circle cx="8.6" cy="8.6" r="1.15" fill="currentColor" stroke="none" />
    <circle cx="15.4" cy="8.6" r="1.15" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1.15" fill="currentColor" stroke="none" />
    <circle cx="8.6" cy="15.4" r="1.15" fill="currentColor" stroke="none" />
    <circle cx="15.4" cy="15.4" r="1.15" fill="currentColor" stroke="none" />
  </I>
);

export const IconTimer = (p) => (
  <I {...p}>
    <circle cx="12" cy="13.4" r="7.4" />
    <path d="M12 9.6v3.8l2.6 1.6M9.4 2.8h5.2" />
  </I>
);

export const IconEraser = (p) => (
  <I {...p}>
    <path d="m9.4 20.4-4.8-4.8a1.6 1.6 0 0 1 0-2.3l7.8-7.8a1.6 1.6 0 0 1 2.3 0l4.8 4.8a1.6 1.6 0 0 1 0 2.3l-7.8 7.8z" />
    <path d="M8.4 9.6l6 6M8.6 20.4h10.8" />
  </I>
);

export const IconGrid = (p) => (
  <I {...p}>
    <circle cx="12" cy="12" r="8.6" />
    <circle cx="12" cy="12" r="4.2" />
    <path d="M12 3.4v17.2M3.4 12h17.2" />
  </I>
);

export const IconLamp = (p) => (
  <I {...p}>
    <path d="M12 3.4c1.6 2 2.4 3.4 2.4 4.6a2.4 2.4 0 0 1-4.8 0c0-1.2.8-2.6 2.4-4.6Z" />
    <path d="M5.6 13.4h12.8a6.4 6.4 0 0 1-6.4 5.2 6.4 6.4 0 0 1-6.4-5.2Z" />
    <path d="M9.6 20.6h4.8" />
  </I>
);

export const IconCheck = (p) => (
  <I {...p}>
    <path d="m5 12.8 4.4 4.4L19 7.6" />
  </I>
);

export const IconSave = (p) => (
  <I {...p}>
    <path d="M5.6 3.8h9.2l4.4 4.4v12a1.6 1.6 0 0 1-1.6 1.6H5.6A1.6 1.6 0 0 1 4 20.2V5.4a1.6 1.6 0 0 1 1.6-1.6Z" />
    <path d="M8 3.8v5.4h6.4V3.8M8 15.6h8" />
  </I>
);
