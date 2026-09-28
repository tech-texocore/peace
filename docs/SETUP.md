# Peace — Setup Guide

1. [Configuration](#1-configuration)
2. [Local development](#2-local-development)
3. [Going live on the VPS](#3-going-live-on-the-vps)
4. [Database changes](#4-database-changes)
5. [Commands & troubleshooting](#5-commands--troubleshooting)

---

## 1. Configuration

Backend and web share one config file per environment, at the project root:

| File | Used by | Loaded when |
|---|---|---|
| `.env.development` | local machine | `npm run dev`, seeds, Prisma (default) |
| `.env.production` | VPS | `NODE_ENV=production` — PM2, `next build`, `update.sh` |
| `.env.example` | template (tracked in git) | never loaded |

Both real files are gitignored and already filled:
- **Development** — local database, Firebase, generated secrets.
- **Production** — generated secrets (JWT, setup, encryption key, database password), Firebase, server paths. Only the real domain in place of `example.com` is left.

**Integration keys are not in env files.** Razorpay, BharatShip, email, SMS and WhatsApp keys are set in **admin → Integrations**. They are stored encrypted with `ENCRYPTION_KEY`, take effect on save (no restart) and each has a **Test connection** button. Never change `ENCRYPTION_KEY` after keys are saved — they could no longer be read.

The storefront contact form sends to the **Support email** in admin → Site Settings.

**Media (images / videos)** — uploads go to the server disk today (`MEDIA_DRIVER=local`, folder `MEDIA_DIR`). The database stores only a key such as `media:products/2026/09/<uuid>.jpg`; the API turns it into a full link from config on every response. So changing domain (dev → live) or moving to S3 never touches the data. External image links are stored and returned as-is.

*Switching to S3 later* (AWS S3, Cloudflare R2 or self-hosted MinIO):
1. Copy the files with the same layout — e.g. `rclone copy /var/www/peace/uploads r2:<bucket>` or `aws s3 sync /var/www/peace/uploads s3://<bucket>`.
2. In `.env.production` set `MEDIA_DRIVER=s3`, `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`; for R2/MinIO also `S3_ENDPOINT` and `MEDIA_PUBLIC_URL` (the bucket's public URL). For a CDN, put its URL in `MEDIA_PUBLIC_URL`.
3. `pm2 reload peace-api`. Old and new images now load from the bucket. A half-filled S3 config stops the API at startup with a clear message.

**Email (free)** — admin → Integrations → Email, then **Send test email**:

| Service | SMTP host | Port | Username / password | Free limit |
|---|---|---|---|---|
| Gmail | `smtp.gmail.com` | 587 | Gmail address + [App Password](https://myaccount.google.com/apppasswords) (needs 2-Step Verification) | ~500/day |
| Brevo | `smtp-relay.brevo.com` | 587 | SMTP login + SMTP key (Brevo → SMTP & API); verify the sender address | 300/day |

Until email is set up, emails print in the API log. Order emails, contact-form messages and Danger Zone codes all use it.

**Danger Zone** (admin → Danger Zone, Super Admin only) — *Delete all transaction data* (orders, returns, customers and their logins, reviews, subscribers, audit log; masters reset to the standard lists) and *Delete all data and restart fresh* (also catalog, product images, discounts, campaigns, Admin/Staff accounts; keeps Super Admins, settings, theme, roles, sellers, customer groups, integration keys). Each needs typing `DELETE` plus a code emailed to the Super Admin. On the live server they stay blocked until email is set up.

Only `peace-web/next.config.ts` decides which values reach the browser — API URL, store name/slug and the Firebase web keys. Everything else stays server-side.

New secret when needed: `openssl rand -hex 32`.

---

## 2. Local development

**Needs:** Node 24 (`nvm use`), PostgreSQL 17 with a `peace` database, `.env.development` at the project root.

### First time

```bash
npm run setup          # installs root, backend and web
npm run db:migrate     # creates the schema
npm run dev            # starts API + web + courier mock
```

With it running, bootstrap once (creates the store, roles, site config and the first Super Admin):

```bash
curl -X POST http://localhost:4000/api/bootstrap/super-admin \
  -H "x-setup-secret: <SETUP_SECRET from .env.development>" \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"YourPass@123","name":"Super Admin"}'
```

Then demo data and the standard admin logins (local dev keys — Razorpay test keys, BharatShip → mock `http://localhost:4100` — are entered in admin → Integrations):

```bash
npm run db:seed
```

### Daily

```bash
npm run dev
```

| Process | URL |
|---|---|
| Storefront / admin | http://localhost:3000 · http://localhost:3000/admin |
| API | http://localhost:4000/api |
| Courier mock (BharatShip) | http://localhost:4100 |

| Role | Email | Password (dev only) |
|---|---|---|
| Super Admin | `superadmin@peace.com` | `SuperAdminPEACE@2026` |
| Admin | `admin@peace.com` | `AdminPEACE@2026` |

---

## 3. Going live on the VPS

Everything runs on one server — no AWS, no paid services.

| Part | Runs as |
|---|---|
| `peace-web` | PM2 → `localhost:3000` |
| `peace-backend` | PM2 → `localhost:4000` |
| PostgreSQL 17 | local only |
| Media | `/var/www/peace/uploads`, served by Nginx |
| SSL | Let's Encrypt |
| CDN (optional) | Cloudflare free plan |

**Server:** Hostinger KVM 2 (2 vCPU · 8 GB · 100 GB NVMe), Ubuntu 24.04, India/Asia data centre.

**Ready-made files in `deploy/`:** `nginx.conf` · `ecosystem.config.js` (PM2) · `update.sh` (pull, migrate, build, restart) · `backup.sh` (daily DB + uploads → Google Drive) · `cloudflare-real-ip.sh` (only with Cloudflare).

### Step 1 — Finish `.env.production` (on your machine)
Replace `example.com` with the real domain:

```bash
sed -i '' 's/example\.com/<your-domain>/g' .env.production
```

### Step 2 — DNS
A records → VPS IP: `@`, `www`, `api`. On Cloudflare, keep them **DNS only** until step 9. (`www` redirects to the main domain.)

### Step 3 — Secure the server (as root)

```bash
apt update && apt upgrade -y
adduser peace && usermod -aG sudo peace
rsync --archive --chown=peace:peace ~/.ssh /home/peace
sed -i 's/^#\?PasswordAuthentication .*/PasswordAuthentication no/; s/^#\?PermitRootLogin .*/PermitRootLogin no/' /etc/ssh/sshd_config
systemctl restart ssh
ufw allow OpenSSH && ufw allow 80,443/tcp && ufw enable
apt install -y fail2ban unattended-upgrades
timedatectl set-timezone Asia/Kolkata
```

Log in as `peace` from here on.

### Step 4 — Install

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/master/install.sh | bash
source ~/.bashrc
nvm install 24 && npm install -g pm2

sudo apt install -y postgresql-common
sudo /usr/share/postgresql-common/pgdg/apt.postgresql.org.sh -y
sudo apt install -y postgresql-17 nginx certbot python3-certbot-nginx git rclone
```

### Step 5 — Code + config

```bash
sudo mkdir -p /var/www/peace/uploads && sudo chown -R peace:peace /var/www/peace
git clone <repo-url> /var/www/peace/app    # private repo: add the server's SSH key as a read-only deploy key first
```

From your machine, copy the production config up:

```bash
scp .env.production peace@<vps-ip>:/var/www/peace/app/.env.production
```

### Step 6 — Database
The password is the one inside `DATABASE_URL` in `.env.production`:

```bash
sudo -u postgres psql -c "CREATE USER peace WITH PASSWORD '<password from DATABASE_URL>';"
sudo -u postgres psql -c "CREATE DATABASE peace OWNER peace;"
```

### Step 7 — Build + start

```bash
cd /var/www/peace/app
./deploy/update.sh         # installs, migrates, builds and starts both apps
pm2 save && pm2 startup    # run the command it prints
pm2 install pm2-logrotate
```

### Step 8 — Nginx

```bash
sed -i 's/example\.com/<your-domain>/g' deploy/nginx.conf
sudo ln -s /var/www/peace/app/deploy/nginx.conf /etc/nginx/sites-enabled/peace
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

### Step 9 — SSL

```bash
sudo certbot --nginx -d <your-domain> -d www.<your-domain> -d api.<your-domain> --redirect
```

Renews automatically. With Cloudflare: switch the records to **Proxied**, set SSL mode to **Full (strict)**, then run:

```bash
./deploy/cloudflare-real-ip.sh
```

Without it every visitor looks like a Cloudflare IP, so the per-visitor rate limit and the audit log see the wrong address.

### Step 10 — First run
1. Bootstrap the store as in section 2, against `https://api.<your-domain>` with the `SETUP_SECRET` from `.env.production`. Don't seed demo data.
2. Admin → **Integrations**: enter the Razorpay live keys and BharatShip login, press **Test connection** for each. For the Razorpay webhook, press **Generate**, add a webhook in the Razorpay dashboard with the URL shown on the page and that secret, then save.
3. Admin → **Integrations → Email**: set up Gmail or Brevo (table in section 1) and send a test email.
4. Admin → **Site Settings**: set the Support email (contact form messages go there).
5. Firebase console → Authentication → Settings → Authorized domains → add the domain.

### Step 11 — Daily backups
Hostinger's weekly snapshot is not enough for orders.

```bash
echo "localhost:5432:peace:peace:<db-password>" > ~/.pgpass && chmod 600 ~/.pgpass
rclone config    # add a remote named "gdrive"
crontab -e
# 30 2 * * * /var/www/peace/app/deploy/backup.sh >> /var/www/peace/backup.log 2>&1
```

**Keep a safe copy of `.env.production` too** (e.g. a password manager). Integration keys in the database are encrypted with its `ENCRYPTION_KEY` — a database backup without that file cannot restore them.

Restore: `pg_restore -U peace -h localhost -d peace --clean <file>.dump` and `rclone copy gdrive:peace-backups/uploads /var/www/peace/uploads`.

### Updates

```bash
cd /var/www/peace/app && ./deploy/update.sh
```

After editing `.env.production` on the server, run `update.sh` again — the web app bakes its values in at build time.

Keep an eye on disk (`df -h` — 100 GB holds OS, DB, uploads and backups) and logs (`pm2 logs`, `/var/log/nginx/error.log`).

---

## 4. Database changes

Every change to `peace-backend/prisma/schema.prisma`:

```bash
cd peace-backend
TS=$(date +%Y%m%d%H%M%S)_describe_change
mkdir -p prisma/migrations/$TS
npx prisma migrate diff \
  --from-config-datasource prisma.config.ts \
  --to-schema prisma/schema.prisma \
  --script > prisma/migrations/$TS/migration.sql
npx prisma migrate deploy
npx prisma generate
```

Then restart `npm run dev`.
- If `migration.sql` starts with a `Loaded Prisma config …` line, delete it.
- Never edit an applied migration — make a new one.
- On the VPS, `update.sh` applies new migrations.

---

## 5. Commands & troubleshooting

From the project root:

| Task | Command |
|---|---|
| Install everything | `npm run setup` |
| Run API + web + courier mock | `npm run dev` |
| Apply migrations | `npm run db:migrate` |
| Demo data + admin logins | `npm run db:seed` |
| Build both apps | `npm run build` |
| Browse the database | `cd peace-backend && npx prisma studio` |
| Type-check | `npx tsc --noEmit` in `peace-backend` or `peace-web` |

**New backend feature:** module in `peace-backend/src/modules/<name>/`, register in `src/app.module.ts`, protect admin routes with `@RequirePermissions('<key>')` and add the key to `src/modules/access/permissions.catalog.ts`.

| Problem | Fix |
|---|---|
| `client password must be a string` | `.env.development` missing at the project root |
| `EADDRINUSE :4000` | An old dev process is still running — stop it and rerun `npm run dev` |
| 403 on a new admin endpoint | Role permissions predate the key — re-sync / re-seed roles |
| New field missing at runtime | `npx prisma generate` + restart |
| Firebase auth errors | Check `FIREBASE_PRIVATE_KEY` quoting and that the web keys match the Firebase web app |
| Emails not arriving | Set up admin → Integrations → Email and press **Send test email** — the error message says what's wrong |
| SMS / WhatsApp not arriving | Expected — their sending hookup isn't switched on yet; they print in the API log |
| Danger Zone says "Set up Email first" | Live server needs working email for the verification code |
| `Could not read integration keys` in the log | `ENCRYPTION_KEY` changed since the keys were saved — restore it, or re-enter the keys in admin → Integrations |
| Contact form says "not set up yet" | Set the Support email in admin → Site Settings |
| Visitors get "Too Many Requests" | The API isn't seeing real IPs — with Cloudflare run `deploy/cloudflare-real-ip.sh`; the rate limit is `THROTTLE_LIMIT` per `THROTTLE_TTL` seconds per visitor |
| Test email fails on the VPS with a timeout | The host may block the SMTP port — use port 587 (or 465); ask Hostinger support if both are blocked |
| Uploads 404 on the VPS | `MEDIA_DIR` must match the `/uploads/` alias in `deploy/nginx.conf` |
| Images point to the old domain | Set `API_URL` (or `MEDIA_PUBLIC_URL`) and `pm2 reload peace-api` — links are built from config |
