# Peace — Textiles Ecommerce Platform

Marketplace-grade (Flipkart / Amazon / Shopify standard) clothing & textiles storefront for **TEXOCORE**.
Config-driven and **single-vendor today** (multi-vendor foundation baked into the data model for later).

- **`peace-web`** — Next.js 16 + React 19 storefront (`/`) + admin panel (`/admin`)
- **`peace-backend`** — NestJS 11 + Prisma 7 + Postgres API

## What's built

**Storefront** — catalog with faceted search & filters · PLP/PDP with colour swatches → per-colour image switching, size guide and product customisation · cart & **Cash-on-Delivery checkout** (Razorpay sandbox-ready) · GST invoice · order tracking · returns · reviews & Q&A · wishlist · account (profile, addresses, orders, notifications inbox, **notification preference center**).

**Admin** (`/admin`) — dashboard · catalog (products / variants / media / categories / brands / collections / masters) · inventory + back-in-stock · orders + returns · customers + groups · promotions engine (all discount types) · **campaigns** (email / SMS / WhatsApp / in-app) · **subscriptions** (newsletter + back-in-stock) · site config (nav / footer / home / theme) · RBAC + audit log.

**Engagement** — notification preference center, **abandoned-cart recovery** (hourly cron) and **price-drop alerts**, all channel- and category-aware.

**Foundation** — Firebase Auth (email-password + Google) · RBAC (roles & permissions) · **provider-adapter integrations** (payments / media / email / SMS / WhatsApp / push) that run on free dev providers now and switch to live services when the client supplies keys.

Progress detail: [`docs/BUILD_CHECKLIST.md`](docs/BUILD_CHECKLIST.md).

## Quick start

Full step-by-step setup (env, database, bootstrap, schema migrations) is in
**[`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md)**. The short version once configured:

```bash
# one-time
cd peace-backend && cp .env.example .env    # then fill DATABASE_URL, SETUP_SECRET, FIREBASE_*
npm install && npx prisma migrate deploy && npx prisma generate
cd ../peace-web && cp .env.example .env.local && npm install   # fill NEXT_PUBLIC_* keys

# bootstrap the store + first Super Admin (once) — needs the backend running.
# Full command + env details: docs/DEVELOPMENT.md §2
cd ../peace-backend && npm run seed && npm run seed:admins   # demo data + admin logins

# run (two terminals)
cd peace-backend && npm run start:dev     # API  → http://localhost:4000/api
cd peace-web     && npm run dev           # web  → http://localhost:3000  (admin at /admin)
```

> First run needs the one-time **bootstrap** (creates the store, roles & config) before `seed` — see [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md) §2 for the full ordered steps.

**Admin login** (local / dev — rotate before deployment):

| Role | Email | Password |
|------|-------|----------|
| **Super Admin** (all stores) | `superadmin@peace.com` | `SuperAdminPEACE@2026` |
| **Admin** (Peace store) | `admin@peace.com` | `AdminPEACE@2026` |

The seed is minimal but feature-complete — one white-shirt catalog (client's current focus)
that lights up every screen. Demo content lives only in `scripts/seed.js`, never in app code.

## Client-supplied integrations

Payments (Razorpay), media storage (S3), email / SMS / WhatsApp, courier (BlueDart) and
hosting all sit behind swappable adapters — COD, in-app notifications and dev-console
messaging work today without any keys. What the client must provide (accounts, API keys,
official logo & brand assets) is tracked in **[`docs/CLIENT_INTEGRATIONS.md`](docs/CLIENT_INTEGRATIONS.md)**
with a shareable PDF at [`docs/Peace-Client-Integrations.pdf`](docs/Peace-Client-Integrations.pdf).

## Docs

- [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md) — **developer setup & project guide** (env, run, seed, schema migrations — step by step)
- [`docs/BUILD_CHECKLIST.md`](docs/BUILD_CHECKLIST.md) — full feature checklist (done + mandatory pending)
- [`docs/CLIENT_INTEGRATIONS.md`](docs/CLIENT_INTEGRATIONS.md) — client-supplied keys, accounts & brand assets (+ shareable PDF)
- [`docs/FIREBASE_SETUP.md`](docs/FIREBASE_SETUP.md) — auth setup
