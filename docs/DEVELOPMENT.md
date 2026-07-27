# Peace — Developer Setup & Project Guide

Everything you need to configure, run, seed and evolve the project locally — step by step.

- **`peace-backend`** — NestJS 11 + Prisma 7 + Postgres API → serves at `http://localhost:4000/api`
- **`peace-web`** — Next.js 16 + React 19 storefront + admin → serves at `http://localhost:3000`

Frontend talks to the backend over HTTP (`NEXT_PUBLIC_API_BASE_URL`). Auth is Firebase; data is Postgres via Prisma.

---

## 1. Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | Latest LTS (via **nvm**) | `nvm install --lts && nvm use --lts` |
| PostgreSQL | 15+ (17 recommended) | A running local server + an empty database named `peace` |
| Firebase project | — | Free Spark plan; Email/Password + Google sign-in enabled. Web config + Admin SDK service-account JSON |

> The client-supplied keys (Razorpay, S3, email/SMS/WhatsApp, courier) are **not** needed for local dev — see [CLIENT_INTEGRATIONS.md](CLIENT_INTEGRATIONS.md). Payments run as COD and messages log to the console until keys are added.

---

## 2. First-time setup (do once)

### Step 1 — Install dependencies

```bash
cd peace-backend && npm install
cd ../peace-web   && npm install
```

### Step 2 — Environment files

**Backend** — copy the example and fill it in:

```bash
cd peace-backend
cp .env.example .env
```

Minimum keys to run locally:

| Key | Example / meaning |
|-----|-------------------|
| `DATABASE_URL` | `postgresql://USER:PASSWORD@localhost:5432/peace?schema=public` |
| `SETUP_SECRET` | any string — used once to bootstrap the first admin |
| `FIREBASE_PROJECT_ID` | from the service-account JSON |
| `FIREBASE_CLIENT_EMAIL` | from the service-account JSON |
| `FIREBASE_PRIVATE_KEY` | from the JSON, wrapped in quotes, keep the literal `\n` |
| `CORS_ORIGINS` | `http://localhost:3000` |

Everything else (media, payments, SMS, etc.) can stay on the defaults — they use free dev providers.

**Frontend** — `peace-web/.env.local`:

| Key | Meaning |
|-----|---------|
| `NEXT_PUBLIC_API_BASE_URL` | `http://localhost:4000/api` |
| `NEXT_PUBLIC_FIREBASE_API_KEY` … `_APP_ID` | from the Firebase **web** app config |

### Step 3 — Create the database schema

```bash
cd peace-backend
npx prisma migrate deploy   # apply all existing migrations to the DB
npx prisma generate         # generate the typed Prisma client
```

### Step 4 — Bootstrap the store + first Super Admin (one-time)

With the backend running (`npm run start:dev`), call the bootstrap endpoint once — it creates the `peace` store, the default roles and site config, and the first Super Admin:

```bash
curl -X POST http://localhost:4000/api/bootstrap/super-admin \
  -H "x-setup-secret: <your SETUP_SECRET>" \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"YourPass@123","name":"Super Admin"}'
```

### Step 5 — Seed demo data + standard admin logins

```bash
cd peace-backend
npm run seed          # catalog, orders, reviews, discounts, home config … (demo data)
npm run seed:admins   # creates the two ready-made admin logins below (needs Firebase)
```

You're set up. Jump to **Section 3** for the daily run commands.

---

## 3. Run in development (daily)

Open **two terminals** (dev servers keep running; restart if they stop):

```bash
# Terminal 1 — backend  → http://localhost:4000/api
cd peace-backend && npm run start:dev     # watch mode, auto-reloads on save

# Terminal 2 — web      → http://localhost:3000  (admin at /admin)
cd peace-web && npm run dev
```

**Admin login** (from `npm run seed:admins`):

| Role | Email | Password |
|------|-------|----------|
| Super Admin (all stores) | `superadmin@peace.com` | `SuperAdminPEACE@2026` |
| Admin (Peace store) | `admin@peace.com` | `AdminPEACE@2026` |

> Local dev credentials only — rotate before any deployment. Passwords live in Firebase Auth, not the DB.

---

## 4. Changing the database schema (add / alter a table or column)

Prisma 7 in this project uses a driver adapter, so we generate migrations **from the schema diff** and apply them. Follow these steps every time you touch `prisma/schema.prisma`:

**Step 1 — Edit the schema**
Add or change the model / field in `peace-backend/prisma/schema.prisma`.

```prisma
model ProductMedia {
  // …
  colours String[] @default([])   // ← example: new column
}
```

**Step 2 — Generate the migration SQL from the diff**

```bash
cd peace-backend
TS=$(date +%Y%m%d%H%M%S)_describe_your_change      # e.g. 20260727_add_media_colours
mkdir -p prisma/migrations/$TS

npx prisma migrate diff \
  --from-config-datasource prisma.config.ts \
  --to-schema prisma/schema.prisma \
  --script > prisma/migrations/$TS/migration.sql
```

> If the file starts with a `Loaded Prisma config …` banner line, delete that line — the file must contain **only SQL**.

**Step 3 — Apply it to the database**

```bash
npx prisma migrate deploy
```

**Step 4 — Regenerate the typed client**

```bash
npx prisma generate
```

**Step 5 — Restart the backend**
Stop and restart `npm run start:dev` so the new Prisma client is loaded (watch-mode recompiles code, but a fresh client needs a restart).

> ⚠️ Do **not** hand-edit already-applied migrations. To change something, edit `schema.prisma` again and create a **new** migration with steps 2–5.

---

## 5. Common tasks

| Task | Command (in `peace-backend` unless noted) |
|------|-------------------------------------------|
| Reseed demo data | `npm run seed` (or `npx prisma db seed`) |
| Reset / recreate admin logins | `npm run seed:admins` |
| Regenerate Prisma client | `npx prisma generate` |
| Inspect the DB visually | `npx prisma studio` |
| Type-check backend | `npx tsc --noEmit` |
| Type-check web (in `peace-web`) | `npx tsc --noEmit` |
| Lint | `npm run lint` |

**Adding a backend feature** — create a module under `src/modules/<name>/` (`*.module.ts`, `*.service.ts`, `*.controller.ts`, `dto/`), then register it in `src/app.module.ts`. Protect admin routes with `@RequirePermissions('<key>')` and add the permission to `src/modules/access/permissions.catalog.ts`.

---

## 6. Ports & URLs

| What | URL |
|------|-----|
| Storefront | http://localhost:3000 |
| Admin panel | http://localhost:3000/admin |
| Customer account | http://localhost:3000/account |
| Backend API | http://localhost:4000/api |
| Prisma Studio | http://localhost:5555 |

---

## 7. Troubleshooting

| Symptom | Fix |
|---------|-----|
| `Database not connected` on boot | Check `DATABASE_URL`, ensure Postgres is running and the `peace` DB exists |
| 403 on a new admin endpoint | The role's stored permissions predate the new key — re-run the role sync / re-seed roles |
| New schema field missing at runtime | You forgot `npx prisma generate` **and** a backend restart (Section 4, steps 4–5) |
| Firebase auth errors | Verify `FIREBASE_PRIVATE_KEY` quoting (literal `\n`) and that the web `.env.local` keys match the Firebase web app |
| Emails/SMS not sending | Expected in dev — they log to the console until client keys are added (see CLIENT_INTEGRATIONS.md) |

---

## Related docs

- [BUILD_CHECKLIST.md](BUILD_CHECKLIST.md) — feature checklist (done + mandatory pending)
- [CLIENT_INTEGRATIONS.md](CLIENT_INTEGRATIONS.md) — client-supplied keys, accounts & brand assets
- [FIREBASE_SETUP.md](FIREBASE_SETUP.md) — Firebase auth setup
