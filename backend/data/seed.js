/**
 * Idempotent seeding — runs on every boot, only fills what's missing:
 *  - product catalog (from products.json bundled in the repo)
 *  - categories derived from the catalog
 *  - the admin account (ADMIN_PHONE env, defaults to 9999999999)
 *  - home-page video banners (files copied from seed-assets/ into uploads/)
 */
const fs = require('fs');
const path = require('path');
const { v4: uuid } = require('uuid');
const db = require('./db');

const SEED_PRODUCTS = require('./products.json');
const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(__dirname, '..', 'uploads');
const SEED_ASSETS_DIR = path.join(__dirname, '..', 'seed-assets');

const SEED_BANNERS = [
  {
    file: 'field-to-bottle.mp4',
    title: 'From our fields to your bottle',
    subtitle: 'Traceable, single-origin oils pressed the traditional way',
  },
  {
    file: 'coconut-production.mp4',
    title: 'Pure cold-pressed coconut oil',
    subtitle: 'Hand-selected copra, wood-pressed under 25°C',
  },
];

const SEED_CATEGORIES = [
  { id: 'oils', label: 'Cold-Pressed Oils', image: 'coconut-oil.jpeg' },
  { id: 'soaps', label: 'Organic Soaps', image: 'neem-soap.svg' },
  { id: 'powders', label: 'Herbal Powders', image: 'moringa-powder.svg' },
];

const SEED_BLOG_POSTS = [
  {
    id: 'what-wood-pressed-actually-means',
    title: 'What "Wood-Pressed" Actually Means',
    category: 'Cold-Pressed Oils',
    image: 'castor-oil.jpeg',
    excerpt: "Every bottle says \"cold-pressed.\" Here's what that actually requires — and how to tell when it's true.",
    content: `Walk down any oil aisle and nearly every bottle claims to be "cold-pressed" or "wood-pressed." The words get used loosely enough that they've started to mean very little. So here's what the process actually involves, and why it matters for what ends up in your kitchen.

Traditional wood-pressing — kolhu or kachi ghani, depending on the region — crushes oilseeds between a rotating wooden pestle and a stone or wooden mortar, turned slowly enough that friction never pushes the temperature past roughly 40°C. Industrial refining, by contrast, often heats seeds well past 200°C to extract oil faster and in higher volumes, then strips out impurities (and flavour, and colour, and a good portion of the natural nutrients) with solvents and chemical clarifiers.

The practical difference shows up in ways you can actually notice. Wood-pressed coconut oil solidifies below about 24°C — refined versions often stay liquid regardless of temperature, because whatever made them solidify got processed out. Wood-pressed groundnut oil smells distinctly of roasted peanuts; refined groundnut oil is usually close to odourless. Wood-pressed sesame oil carries real colour and a nutty aroma from the seed itself, not from anything added afterward.

None of this makes cold-pressed oil "better" for every single use — refined oils have a longer shelf life and a more neutral taste, which some cooking genuinely calls for. But if a label claims cold-pressed and shows none of these traits, that's worth questioning.

At our own mill, the process stays close to how it's always been done: sun-dried seeds, a slow wooden press kept under 25°C, natural settling, and a single cloth-filter pass — no chemical solvents at any stage.`,
    published: true,
    createdAt: '2026-06-02T05:00:00.000Z',
  },
  {
    id: 'sesame-oil-winter-abhyanga-ritual',
    title: 'Sesame Oil and the Winter Abhyanga Ritual',
    category: 'Wellness',
    image: 'sesame-oil.jpeg',
    excerpt: 'Why til oil shows up in nearly every winter self-care ritual across South India — and how to actually do it.',
    content: `Walk into most South Indian households in December and you'll find a bottle of sesame oil warming gently before anyone's even out of bed. Abhyanga — self-massage with warm oil — is one of the oldest winter rituals in Ayurvedic daily practice, and sesame (til) oil is the one most commonly used for it.

The reasoning is partly practical. Sesame oil penetrates skin more readily than many other oils and has a naturally warming quality that Ayurveda associates with countering the dryness and cold of winter. It's also stable enough to be warmed without breaking down, unlike some lighter oils.

The ritual itself is simple enough that it doesn't need special equipment. Warm a small amount of oil — enough to cover both palms comfortably — until it's warm to the touch, not hot. Starting at the scalp and working outward, massage in long strokes along the limbs and circular strokes at the joints, spending a few extra minutes on the soles of the feet and the crown of the head. Traditional practice leaves the oil on for at least twenty to thirty minutes before a warm (not hot) shower, though overnight is common for the scalp specifically.

What you use matters here more than in most recipes, since it's going directly onto skin rather than into a dish that dilutes it. Wood-pressed til oil keeps its natural sesamol content — the compound partly responsible for sesame oil's stability and its faint characteristic aroma — intact in a way that refined, deodorised versions don't.

It's not a complicated practice, and it doesn't require perfect technique to be worth doing. Ten unhurried minutes with warm oil is most of it.`,
    published: true,
    createdAt: '2026-06-16T05:00:00.000Z',
  },
  {
    id: 'four-checks-before-buying-groundnut-oil',
    title: 'Four Things to Check Before Buying Cold-Pressed Groundnut Oil',
    category: 'Buying Guide',
    image: 'groundnut-oil.jpeg',
    excerpt: 'Wood-pressed groundnut oil is easy to fake convincingly on a label. Here’s what actually distinguishes the real thing.',
    content: `Groundnut (peanut) oil is one of the most common cooking oils in Indian kitchens, and also one of the easiest to mislabel — a refined oil with a groundnut-oil sticker looks identical to the real thing on a shelf. A few things are worth checking before you buy.

Smell it before you commit to the bottle. Real wood-pressed groundnut oil has a distinct roasted-peanut aroma, strong enough to notice from an open bottle. Refined groundnut oil is usually close to odourless — the smell is one of the first things stripped out during refining, along with a good deal of the flavour.

Check the colour. Wood-pressed groundnut oil tends toward a deeper golden colour than the pale, almost colourless look of refined versions. Colour alone isn't proof of anything — some refiners add colouring back in — but a colourless oil calling itself cold-pressed is worth a second look.

Notice how it behaves when heated, not just the smoke-point number on the label. Genuine cold-pressed groundnut oil has a reasonably high smoke point for a cold-pressed oil, part of why it suits Indian cooking and frying. If an oil marketed as cold-pressed smokes at a noticeably low temperature, something about the extraction claim is likely off.

Read past the words "cold-pressed" to the actual process name. Terms like kachi ghani or marachekku/kolhu specifically describe the traditional wood-press method, and a genuine product usually names it rather than relying on the more generic, less regulated phrase "cold-pressed" alone.

None of these checks require lab equipment — they're the same things a shopper who grew up around a real ghani would notice without thinking about it.`,
    published: true,
    createdAt: '2026-07-01T05:00:00.000Z',
  },
];

async function seed() {
  // Products
  if ((await db.count('products')) === 0) {
    for (const p of SEED_PRODUCTS) await db.put('products', p);
    console.log(`[seed] ${SEED_PRODUCTS.length} products`);
  }

  // Categories
  if ((await db.count('categories')) === 0) {
    let sort = 0;
    for (const c of SEED_CATEGORIES) {
      await db.put('categories', { ...c, sort: sort++ });
    }
    console.log(`[seed] ${SEED_CATEGORIES.length} categories`);
  }

  // Blog posts
  if ((await db.count('blog-posts')) === 0) {
    for (const p of SEED_BLOG_POSTS) await db.put('blog-posts', p);
    console.log(`[seed] ${SEED_BLOG_POSTS.length} blog posts`);
  }

  // Admin user
  const users = await db.list('users');
  if (!users.some((u) => u.role === 'admin')) {
    const adminPhone = process.env.ADMIN_PHONE || '9999999999';
    const existing = users.find((u) => u.phone === adminPhone);
    if (existing) {
      existing.role = 'admin';
      await db.put('users', existing);
    } else {
      await db.put('users', {
        id: uuid(),
        phone: adminPhone,
        name: 'Western Gods Admin',
        email: process.env.ADMIN_EMAIL || '',
        role: 'admin',
        addresses: [],
        createdAt: new Date().toISOString(),
      });
    }
    console.log(`[seed] admin user on phone ${adminPhone} (log in with OTP as usual)`);
  }

  // Seed video files: copied into UPLOADS_DIR on every boot (not gated on the
  // banner *records* existing) because the filesystem is ephemeral on Render's
  // free plan — a redeploy wipes uploads/ even though the DB rows persist in
  // Neon. Without this, existing banner records would 404 forever.
  if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  for (const b of SEED_BANNERS) {
    const src = path.join(SEED_ASSETS_DIR, b.file);
    const dest = path.join(UPLOADS_DIR, b.file);
    if (!fs.existsSync(dest) && fs.existsSync(src)) fs.copyFileSync(src, dest);
  }

  // Banner records: only inserted once (admin may delete/reorder them afterwards).
  if ((await db.count('banners')) === 0) {
    let sort = 0;
    for (const b of SEED_BANNERS) {
      if (fs.existsSync(path.join(UPLOADS_DIR, b.file))) {
        await db.put('banners', {
          id: uuid(),
          title: b.title,
          subtitle: b.subtitle,
          type: 'video',
          url: `/uploads/${b.file}`,
          active: true,
          sort: sort++,
          createdAt: new Date().toISOString(),
        });
      }
    }
    console.log('[seed] home-page video banners');
  }
}

module.exports = { seed, UPLOADS_DIR };
