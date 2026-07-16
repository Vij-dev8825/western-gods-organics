# Yamuna Organic — Cold-Pressed Oils Store

Full-stack e-commerce site: React (Vite) frontend + Node/Express backend, ready for
**Render** (hosting) + **Neon** (Postgres database).

## What's included

**Storefront**
- **Language switcher (English / हिंदी / தமிழ்)** in the navbar — dictionaries in
  `frontend/src/i18n.jsx`, easy to add more languages
- Three category ranges: **Cold-Pressed Oils, Organic Soaps, Herbal Powders** (8 products seeded)
- New "Yamuna Organic" brand: gold oil-drop + leaf logo (`frontend/src/assets/logo.svg`, favicon)
- Home page with **full-screen video hero** (rotating banners managed from the admin panel),
  USP strip, categories, bestsellers, "watch how it's made" video section, testimonials
- Shop, Categories, Product detail, Cart, Wishlist, OTP Login, Profile,
  Bulk Enquiry, Contact, Policy pages
- **Amazon/Flipkart-style checkout**: numbered "1 Delivery Address" / "2 Payment
  Method" sections, with **Cash on Delivery** or **Pay Online (Razorpay —
  cards/UPI/netbanking/wallets)**. "Pay Online" auto-hides/disables itself
  until Razorpay keys are configured (see below)
- **Notifications page + bell icon** — order updates, price drops, offers
- **Floating chat widget** — customers chat with the store (login required)

**Admin panel** (`/admin` — log in with the `ADMIN_PHONE` number)
- Dashboard: customers, orders, revenue, low-stock alerts, unread chats
- Products: add/edit/delete, **per-size rates & stock**, optional price-drop
  announcement to all customers
- Categories: add/rename/delete
- **Home Banners: upload videos/images, reorder, show/hide** — drives the home hero
- Orders: change status (placed → confirmed → shipped → delivered) — customer is
  notified in-app + email (+ SMS on "shipped")
- Enquiries & Leads: bulk enquiries (with pipeline status), contact messages, customer list
- Notifications: **broadcast in-app / email / SMS** to all customers, with history
- Chat: reply to customer conversations (unread badges, live polling)

**Backend**
- Dual data layer (`backend/data/db.js`): **Neon Postgres** when `DATABASE_URL` is set,
  JSON files otherwise (zero-setup local dev). Tables are auto-created and seeded on boot.
- Email via SMTP (nodemailer, e.g. free Gmail SMTP) and SMS via Fast2SMS/MSG91/Twilio —
  all **log to the console until credentials are added**, so every flow is testable locally.
- Uploaded banner videos served from `/uploads` (configurable via `UPLOADS_DIR`).

## Run it locally

### 1. Backend
```
cd backend
cp .env.example .env      # defaults work out of the box
npm install
npm run dev               # http://localhost:5000
```

### 2. Frontend
```
cd frontend
npm install
npm run dev               # http://localhost:5173
```
Vite proxies `/api` and `/uploads` to the backend — just open http://localhost:5173.

### Admin access
Log in via the normal OTP flow using the phone number in `ADMIN_PHONE`
(default **9999999999**). In dev the OTP is shown on-screen. You'll get an
**Admin** link in the navbar → `/admin`.

## Deploy: Render + Neon

1. **Neon** — create a free project at https://neon.tech and copy the connection string
   (`postgresql://...@ep-xxx.region.aws.neon.tech/neondb?sslmode=require`).
2. **Push this repo to GitHub.**
3. **Render** — https://render.com → New → **Blueprint** → select the repo.
   `render.yaml` provisions a single web service that builds the frontend and serves
   API + site together.
4. When prompted for env vars, set:
   - `DATABASE_URL` — the Neon connection string
   - `ADMIN_PHONE` — your admin mobile number
5. Tables are created and seeded automatically on first boot (products, categories,
   admin user, the two hero videos).

Notes:
- The blueprint uses the `starter` plan with a 2 GB persistent disk at `/var/data/uploads`
  so admin-uploaded banners survive deploys. On the **free** plan remove the `disk:` block
  (and the `UPLOADS_DIR` var) — the two seeded videos still work (they ship with the repo),
  but new uploads are lost on redeploy.
- For production email/SMS set the `SMTP_*` and `FAST2SMS_API_KEY`/`MSG91_*`/`TWILIO_*` vars
  (see `.env.example`). Fast2SMS (https://www.fast2sms.com) and Gmail SMTP are both free to
  start with — no paid plan or DLT registration needed to get OTP login and email working.
- OTPs are returned in the API response only when `NODE_ENV !== 'production'`, or
  always if `SHOW_OTP_ONSCREEN=true` (useful before SMS delivery is set up).
- For online payments, set `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` (from
  https://dashboard.razorpay.com → Settings → API Keys — test-mode keys work
  immediately with no KYC; live keys need Razorpay KYC for real settlement).
  Until set, "Pay Online" is disabled at checkout and only Cash on Delivery works.

## Where things live
- `backend/data/db.js` — Postgres/JSON dual data layer
- `backend/data/seed.js` — idempotent boot seeding (catalog, admin, banners)
- `backend/routes/admin.js` — everything the admin panel calls
- `backend/utils/{mailer,sms,notify}.js` — email/SMS/broadcast plumbing
- `frontend/src/pages/admin/` — admin panel UI
- `frontend/src/components/ChatWidget.jsx` — customer chat
- `render.yaml` — Render blueprint
