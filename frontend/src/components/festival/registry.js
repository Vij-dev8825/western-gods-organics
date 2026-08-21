/**
 * Which festival is on, and what it should look and feel like.
 *
 * The calendar in the backend stores a name, a date and a coupon — nothing
 * about colour or motif, because the admin types festivals in by hand and
 * nobody should have to pick a hex value to add Pongal. So theming is matched
 * off the NAME here, on the frontend. Three consequences worth knowing:
 *
 *  - Adding a festival to the calendar needs no code. If its name matches a
 *    pattern below it arrives fully dressed; if it does not, it still gets the
 *    fallback kolam in the shop's own colours rather than a blank space.
 *  - The patterns have to be generous, because the admin may type "Diwali",
 *    "Deepavali" or "Deepawali" and all three are the same evening. Regional
 *    spellings are folded in for the same reason.
 *  - ORDER MATTERS. The first match wins, so specific patterns sit above loose
 *    ones. `karthigai` is above `deepavali` because Karthigai Deepam is also a
 *    festival of lamps and the loose /deepam/ would otherwise swallow it;
 *    `sankranti` is above the harvest group for the same reason.
 *
 * NOT EVERY OBSERVANCE IS A CELEBRATION. Muharram and Ashura are days of
 * mourning, Good Friday is a solemn day, and a "tap to celebrate, here's 20%
 * off" band on any of them would be crass. Those names are listed in SOLEMN
 * below and the home band renders nothing at all for them — the shop's calendar
 * can still carry the date without the storefront throwing a party over it.
 */
import {
  Crescent,
  Diyas,
  GoluSteps,
  Gulal,
  KarthigaiHill,
  Kolam,
  Modakam,
  PongalPot,
  PookalamRings,
  Rakhi,
  StarTree,
} from './motifs';

/* The shop's own green, for anything unthemed. Kept as literal hex rather than
   read from CSS because motifs paint SVG fills with these values. */
const HOUSE = {
  ink: '#1f3d2b',
  paper: '#fbf8ee',
  paper2: '#efece0',
  accent: '#6fae4f',
  accentDeep: '#2f6b33',
  glow: '#b9e89a',
};

/* Shared palettes, so festivals that belong to the same season look related
   rather than each inventing its own six colours. */
const LAMPLIGHT = {
  ink: '#1d1424',
  paper: '#fdf1e7',
  paper2: '#f7e2d0',
  accent: '#ff9f1c',
  accentDeep: '#a33b12',
  glow: '#ffc971',
};

const HARVEST = {
  ink: '#20321c',
  paper: '#fdf7e6',
  paper2: '#f2e7c9',
  accent: '#f4a62a',
  accentDeep: '#7a5216',
  glow: '#ffd88a',
};

const VERMILION = {
  ink: '#2a1a12',
  paper: '#fdf3e7',
  paper2: '#f6e7cf',
  accent: '#e0562d',
  accentDeep: '#9a2d12',
  glow: '#f7c85a',
};

const NIGHT = {
  ink: '#101a2c',
  paper: '#eef2f8',
  paper2: '#dfe6f0',
  accent: '#e8c46a',
  accentDeep: '#2c4a6b',
  glow: '#f4e3ae',
};

/**
 * Days of mourning or solemn observance. Matched before anything else, and the
 * band renders nothing for them.
 */
export const SOLEMN =
  /muharram|ashura|moharram|good\s*friday|shraddha|pitru|paksha|mahalaya\s*amavasya/i;

export const FESTIVALS = [
  /* ---------------- Kerala ---------------- */
  {
    id: 'onam',
    match: /onam|thiruvonam|atham/i,
    label: 'Onam',
    eyebrow: 'Onam · Kerala',
    greeting: 'Onam ashamsakal',
    lede: 'A flower carpet is laid on the doorstep through Onam, a ring a day. Lay one here.',
    action: 'Tap the mat to lay a ring',
    doneLine: 'Your pookalam is complete.',
    steps: 5,
    Motif: PookalamRings,
    /* Onam is the only one with a full game behind it. */
    route: '/onam',
    routeLabel: 'Play the full pookalam',
    palette: {
      ink: '#18382c',
      paper: '#fff8e8',
      paper2: '#fffdf6',
      accent: '#e4a52b',
      accentDeep: '#a76a0a',
      glow: '#f7d24a',
    },
  },

  /* ---------------- Lamps ---------------- */
  {
    /* Above deepavali: this is also a lamp festival and /deepam/ would eat it. */
    id: 'karthigai',
    match: /karthigai|karthika|kartik\s*purnima|thirukarthigai|dev\s*deepawali/i,
    label: 'Karthigai Deepam',
    eyebrow: 'Karthigai Deepam',
    greeting: 'Karthigai valthukkal',
    lede: 'Lamps up the whole hill, and the Maha Deepam on the summit. The oil in them is sesame.',
    action: 'Tap to light the hill',
    doneLine: 'The Maha Deepam is burning.',
    steps: 7,
    Motif: KarthigaiHill,
    palette: {
      ink: '#241a10',
      paper: '#fdf4e3',
      paper2: '#f6e6c8',
      accent: '#f0a92c',
      accentDeep: '#9a5510',
      glow: '#ffcf6b',
    },
  },
  {
    id: 'deepavali',
    match: /deepavali|diwali|deepawali|deepam|naraka\s*chaturthi/i,
    label: 'Deepavali',
    eyebrow: 'Deepavali · Festival of lights',
    greeting: 'Deepavali valthukkal',
    lede: 'The oil bath before dawn, then the lamps. Light all seven and the porch is ready.',
    action: 'Tap a lamp to light it',
    doneLine: 'The whole row is burning.',
    steps: 7,
    Motif: Diyas,
    palette: LAMPLIGHT,
  },
  {
    id: 'gurpurab',
    match: /gurpurab|gurupurab|guru\s*nanak|prakash\s*parv/i,
    label: 'Gurpurab',
    eyebrow: 'Guru Nanak Jayanti',
    greeting: 'Gurpurab di lakh lakh vadhai',
    lede: 'Lamps along the wall and langar for everyone who comes. Light the row.',
    action: 'Tap a lamp to light it',
    doneLine: 'Every lamp is lit.',
    steps: 7,
    Motif: Diyas,
    palette: {
      ink: '#16273a',
      paper: '#f4f7fb',
      paper2: '#e6edf5',
      accent: '#f0a92c',
      accentDeep: '#1f4e79',
      glow: '#ffd98a',
    },
  },

  /* ---------------- Harvest ---------------- */
  {
    id: 'pongal',
    match: /pongal|makar|sankranti|sankranthi|uttarayan|magh\s*bihu|lohri|maghi/i,
    label: 'Pongal',
    eyebrow: 'Pongal · Harvest',
    greeting: 'Pongalo Pongal',
    lede: 'Rice, milk and jaggery on a wood fire. When it boils over the rim, the year is good.',
    action: 'Tap to fan the fire',
    doneLine: 'It boiled over. Pongalo Pongal!',
    steps: 6,
    Motif: PongalPot,
    palette: HARVEST,
  },
  {
    id: 'bihu',
    match: /bihu|baisakhi|vaisakhi|nuakhai|wangala/i,
    label: 'Bihu',
    eyebrow: 'Harvest',
    greeting: 'Bihu-r xubhessa',
    lede: 'The harvest is in and the fires are lit. Feed it until the pot goes over.',
    action: 'Tap to fan the fire',
    doneLine: 'A good harvest.',
    steps: 6,
    Motif: PongalPot,
    palette: HARVEST,
  },

  /* ---------------- Colour ---------------- */
  {
    id: 'holi',
    match: /holi|dhulandi|rangwali|dol\s*jatra|hola\s*mohalla|shigmo/i,
    label: 'Holi',
    eyebrow: 'Holi · Festival of colour',
    greeting: 'Happy Holi',
    lede: 'A clean white wall does not survive Holi. Cover it.',
    action: 'Tap anywhere to throw colour',
    doneLine: 'Not a white patch left.',
    steps: 8,
    Motif: Gulal,
    palette: {
      ink: '#2a1c33',
      paper: '#fdf3f7',
      paper2: '#f6eef0',
      accent: '#e5326b',
      accentDeep: '#8a2350',
      glow: '#f7a8c4',
    },
  },

  /* ---------------- Ganesha ---------------- */
  {
    id: 'vinayagar',
    match: /vinayagar|vinayaka|ganesh|ganpati|ganapati|chaturthi|chavithi|pillaiyar/i,
    label: 'Vinayagar Chaturthi',
    eyebrow: 'Vinayagar Chaturthi',
    greeting: 'Vinayagar Chaturthi valthukkal',
    lede: 'Clay pillaiyar on the step, arukampul beside him, and modakam on the leaf. Make the offering.',
    action: 'Tap to offer modakam',
    doneLine: 'The offering is made.',
    steps: 5,
    Motif: Modakam,
    palette: VERMILION,
  },

  /* ---------------- Nine nights ---------------- */
  {
    id: 'navratri',
    match: /navratri|navaratri|golu|kolu|bommai|durga\s*puja|dussehra|dasara|vijayadashami|saraswati\s*puja/i,
    label: 'Navratri',
    eyebrow: 'Navratri · Nine nights',
    greeting: 'Navratri valthukkal',
    lede: 'The dolls come down from the loft and go up the steps, one tier at a time.',
    action: 'Tap to set a tier',
    doneLine: 'The golu is set.',
    steps: 5,
    Motif: GoluSteps,
    palette: {
      ink: '#2c1430',
      paper: '#fdf1f4',
      paper2: '#f5e3e8',
      accent: '#d8437a',
      accentDeep: '#7c1f42',
      glow: '#f7c85a',
    },
  },

  /* ---------------- The one about oil ---------------- */
  {
    /* Ayudha Puja falls on the ninth night, so it shares the golu's steps and
       its season. It gets its own entry rather than being folded into Navratri
       because it is the one day in the year whose whole ritual is oiling the
       thing you work with — for a mill that presses oil, that is not a
       coincidence worth glossing over. */
    id: 'ayudha',
    match: /ayudha|ayutha|aayudha|astra\s*puja|vishwakarma/i,
    label: 'Ayudha Puja',
    eyebrow: 'Ayudha Puja · The tools rest',
    greeting: 'Ayudha Puja nalvazhthukkal',
    lede: 'Everything that works for you is washed, oiled and garlanded — the lathe, the lorry, the grinding stone.',
    action: 'Tap to garland one',
    doneLine: 'All of them anointed.',
    steps: 5,
    Motif: GoluSteps,
    palette: {
      ink: '#2a2410',
      paper: '#fdf8e6',
      paper2: '#f3ecd4',
      accent: '#c8862f',
      accentDeep: '#6d4415',
      glow: '#f2cf6b',
    },
  },

  /* ---------------- Thread ---------------- */
  {
    id: 'rakhi',
    match: /raksha\s*bandhan|rakhi|rakshabandhan|avani\s*avittam|upakarma/i,
    label: 'Raksha Bandhan',
    eyebrow: 'Raksha Bandhan',
    greeting: 'Happy Raksha Bandhan',
    lede: 'One thread round the wrist, and a promise that goes with it. Tie it.',
    action: 'Tap to wind the thread',
    doneLine: 'The rakhi is tied.',
    steps: 5,
    Motif: Rakhi,
    palette: VERMILION,
  },

  /* ---------------- Crescent ---------------- */
  {
    id: 'eid',
    match: /eid|id-ul|ramzan|ramadan|bakrid|bakr\s*id|milad/i,
    label: 'Eid',
    eyebrow: 'Eid',
    greeting: 'Eid Mubarak',
    lede: 'Eid starts when the new moon is sighted. Clear the cloud and look.',
    action: 'Tap to clear the cloud',
    doneLine: 'The crescent is out. Eid Mubarak.',
    steps: 5,
    Motif: Crescent,
    palette: NIGHT,
  },

  /* ---------------- Star ---------------- */
  {
    id: 'christmas',
    /* Deliberately does NOT claim "New Year" — that belongs to the kolam entry
       below, which covers Puthandu, Ugadi, Gudi Padwa and the Gregorian first
       of January alike. */
    match: /christmas|nativity|natal|advent|boxing\s*day/i,
    label: 'Christmas',
    eyebrow: 'Christmas',
    greeting: 'Merry Christmas',
    lede: 'The tree goes up and the star goes on top. Decorate it.',
    action: 'Tap to decorate',
    doneLine: 'The star is on.',
    steps: 5,
    Motif: StarTree,
    palette: {
      ink: '#14251c',
      paper: '#f4f8f3',
      paper2: '#e6efe6',
      accent: '#c62b34',
      accentDeep: '#1f5c34',
      glow: '#f2d06b',
    },
  },

  /* ---------------- The year turns ---------------- */
  {
    id: 'newyear',
    match: /vishu|puthandu|ugadi|yugadi|gudi\s*padwa|poila|bohag|navreh|cheti\s*chand|tamil\s*new\s*year|new\s*year/i,
    label: 'New Year',
    eyebrow: 'The year turns',
    greeting: 'Puthandu valthukkal',
    lede: 'The first thing you see should be a good thing. Draw the kolam for the doorstep.',
    action: 'Tap to draw a line',
    doneLine: 'The kolam is finished.',
    steps: 5,
    Motif: Kolam,
    palette: {
      ink: '#1f3d2b',
      paper: '#fbf7e8',
      paper2: '#f0ecd6',
      accent: '#f2c230',
      accentDeep: '#3a6b34',
      glow: '#ffe38a',
    },
  },

  /* ---------------- The mill's own months ---------------- */
  {
    id: 'aadi',
    match: /aadi|adi\s*perukku|thai|chithirai|masi|panguni/i,
    label: 'Aadi',
    eyebrow: 'Aadi · The oil month',
    greeting: 'Aadi valthukkal',
    lede: 'Aadi is the month of the oil bath, and the mill runs longest. Draw the kolam.',
    action: 'Tap to draw a line',
    doneLine: 'The kolam is finished.',
    steps: 5,
    Motif: Kolam,
    palette: HOUSE,
  },

  /* ---------------- Everything else with a name we know ---------------- */
  {
    id: 'shivratri',
    match: /shivratri|shivaratri|mahashivratri|kanda\s*sashti|skanda|thaipusam|panguni\s*uthiram/i,
    label: 'Temple day',
    eyebrow: 'Temple day',
    greeting: 'Valthukkal',
    lede: 'A day for the temple and the lamp at home. Draw the kolam for the doorstep.',
    action: 'Tap to draw a line',
    doneLine: 'The kolam is finished.',
    steps: 5,
    Motif: Kolam,
    palette: VERMILION,
  },
  {
    id: 'krishna',
    match: /janmashtami|krishna\s*jayanthi|gokulashtami|dahi\s*handi|ram\s*navami|hanuman\s*jayanti/i,
    label: 'Janmashtami',
    eyebrow: 'Janmashtami',
    greeting: 'Janmashtami valthukkal',
    lede: 'Tiny footprints drawn from the door to the shrine. Draw the kolam.',
    action: 'Tap to draw a line',
    doneLine: 'The kolam is finished.',
    steps: 5,
    Motif: Kolam,
    palette: NIGHT,
  },
  {
    id: 'chhath',
    match: /chhath|chhathi|teej|karva\s*chauth|govardhan|bhai\s*dooj|bhai\s*phota/i,
    label: 'Chhath',
    eyebrow: 'Chhath',
    greeting: 'Happy Chhath',
    lede: 'Offerings at the water as the sun goes down. Draw the kolam.',
    action: 'Tap to draw a line',
    doneLine: 'The kolam is finished.',
    steps: 5,
    Motif: Kolam,
    palette: HARVEST,
  },
];

/**
 * The theme for a festival, or null when the storefront should stay quiet.
 *
 * Any name the patterns miss still gets a kolam, a greeting built from its own
 * name and the shop's colours — so an unrecognised entry in the calendar reads
 * as an occasion rather than as a bug.
 */
export function themeFor(festival) {
  if (!festival?.name) return null;
  /* Mourning and solemn observance: no band, no offer, no confetti. */
  if (SOLEMN.test(festival.name)) return null;

  const found = FESTIVALS.find((f) => f.match.test(festival.name));
  if (found) return found;

  return {
    id: 'generic',
    label: festival.name,
    eyebrow: festival.name,
    greeting: `Happy ${festival.name}`,
    lede: 'Draw the kolam for the doorstep, the way the day is welcomed.',
    action: 'Tap to draw a line',
    doneLine: 'The kolam is finished.',
    steps: 5,
    Motif: Kolam,
    palette: HOUSE,
  };
}

/** How long before the day the celebration should appear on the home page.
 *  Three weeks: long enough to matter to the mill's lead times, short enough
 *  that the home page is not permanently in festival dress. */
export const SHOW_WITHIN_DAYS = 21;
