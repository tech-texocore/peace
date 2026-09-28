# Peace — Textiles Ecommerce Platform

Marketplace-grade clothing & textiles store by **TEXOCORE**. Config-driven, single-vendor today (multi-vendor ready in the data model).

| App | Stack |
|---|---|
| `peace-web` | Next.js 16 + React 19 — storefront `/` + admin `/admin` |
| `peace-backend` | NestJS 11 + Prisma 7 + PostgreSQL |
| `deploy/` | VPS server files — Nginx, PM2, update, backup |

## What's built

- **Storefront** — search & filters, PLP/PDP with colour swatches and size guide, cart, checkout (Razorpay + COD), GST invoice, order tracking, returns, reviews & Q&A, wishlist, account and notification preferences.
- **Admin** — dashboard, catalog, inventory, orders, returns & refunds, BharatShip shipping, customers, promotions, campaigns, subscriptions, site config & theme, roles & audit log.
- **Engagement** — abandoned-cart recovery, price-drop and back-in-stock alerts.
- **Integrations** — Razorpay and BharatShip built; email / SMS / WhatsApp run on the console until provider keys arrive.

## Quick start

```bash
npm run setup        # install everything
npm run db:migrate   # database schema
npm run dev          # API :4000 · web :3000 (admin /admin) · courier mock :4100
```

First run also needs the one-time bootstrap and seed — [SETUP.md](docs/SETUP.md#2-local-development).

| Role | Email | Password (dev only) |
|---|---|---|
| Super Admin | `superadmin@peace.com` | `SuperAdminPEACE@2026` |
| Admin | `admin@peace.com` | `AdminPEACE@2026` |

## Configuration

One config file per environment at the project root, shared by backend and web:

| File | For |
|---|---|
| `.env.development` | local — loaded by `npm run dev` |
| `.env.production` | VPS — loaded when `NODE_ENV=production` |
| `.env.example` | template |

Payment, courier and messaging keys are set in **admin → Integrations**, not in env files.

## Docs

| Doc | For |
|---|---|
| [SETUP.md](docs/SETUP.md) | configuration, local development, going live on the VPS |
| [PROJECT_STATUS.md](docs/PROJECT_STATUS.md) | what's built, what's pending, what the client provides |
| [Peace-Client-Integrations.pdf](docs/Peace-Client-Integrations.pdf) | client handout |
