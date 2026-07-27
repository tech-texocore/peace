# Peace — Client-Supplied Integrations Checklist

These are the third-party services that must be **provided / decided by the client** (accounts, API keys, credentials, or a business decision). The app is built around each one via a swappable provider-adapter, so nothing here blocks the rest of the platform — the storefront, cart, checkout (Cash on Delivery), orders, invoices, admin, notifications (in-app + dev console), campaigns and reports all work today without any of these.

**Readiness legend**
- 🟢 **Keys only** — code is complete; drop the credentials in `.env` and it goes live.
- 🟡 **Keys + small wiring** — adapter shell exists; the actual `send()` HTTP call must be implemented against the provider the client chooses (~10–20 lines each).
- 🔴 **Full build** — no adapter yet; a feature has to be built once the client account/API is available.
- ✅ **Done** — already set up in development.

Backend keys go in `peace-backend/.env`. Frontend keys go in `peace-web/.env.local`.

---

## 1. 🟢 Payments — Razorpay
Online card / UPI / netbanking payments. **COD works today without this.**

| Client provides | Where |
|---|---|
| Razorpay account (KYC-approved for live mode) | — |
| `RAZORPAY_KEY_ID` | backend `.env` |
| `RAZORPAY_KEY_SECRET` | backend `.env` |
| `RAZORPAY_WEBHOOK_SECRET` | backend `.env` |
| Set `PAYMENTS_PROVIDER=razorpay` | backend `.env` (already default) |

- **Status:** 🟢 order-create, payment signature verify, and webhook verify are all implemented. Add keys → online payments turn on automatically; without keys the app stays COD-only.
- **Refunds** ride on the same account — a small gateway-refund call remains to wire (today cancel/return marks the order `REFUNDED` manually).

## 2. 🟢 Media storage — Amazon S3
Product images / videos. Today files save to **local disk** — fine for dev, but production needs durable storage + CDN.

| Client provides | Where |
|---|---|
| AWS account + S3 bucket (+ optional CloudFront CDN) | — |
| `AWS_S3_BUCKET`, `AWS_S3_REGION` | backend `.env` |
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | backend `.env` |
| `AWS_S3_CDN_URL` (optional, if CloudFront) | backend `.env` |
| Set `MEDIA_PROVIDER=s3` | backend `.env` |

- **Status:** 🟢 S3 upload/delete implemented (AWS SDK). Flip `MEDIA_PROVIDER` to `s3` and add creds. Any free/S3-compatible store (e.g. Cloudflare R2, MinIO) also works with the same keys.

## 3. 🟡 Email service
Order confirmations, password reset, price-drop / cart / campaign emails. Today they **log to the dev console** (so all flows are testable).

| Client provides | Where |
|---|---|
| Decision on provider (SMTP: Gmail, Brevo, Amazon SES, Zoho…) | — |
| Provider API key / SMTP credentials | backend `.env` |
| `EMAIL_FROM` (verified sender address) | backend `.env` |
| Set `EMAIL_PROVIDER=client` | backend `.env` |

- **Status:** 🟡 adapter selected by env; the real `ClientEmailProvider.send()` must be implemented against the chosen provider. Free options exist (Gmail SMTP, Brevo free tier).

## 4. 🟡 SMS service
OTP + order-status texts. Today: dev console.

| Client provides | Where |
|---|---|
| SMS provider account (MSG91, Twilio, …) + DLT sender registration (India) | — |
| Provider key (e.g. `MSG91_AUTH_KEY`, `MSG91_SENDER_ID`) | backend `.env` |
| Set `SMS_PROVIDER=client` | backend `.env` |

- **Status:** 🟡 adapter shell ready; implement `ClientSmsProvider.send()`. India needs DLT template approval — a client/legal step.

## 5. 🟡 WhatsApp service
Order updates / promos on WhatsApp. Today: dev console.

| Client provides | Where |
|---|---|
| WhatsApp Business API access (Meta Cloud API, Gupshup, …) | — |
| Approved message templates (Meta approval) | — |
| `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN` | backend `.env` |
| Set `WHATSAPP_PROVIDER=client` | backend `.env` |

- **Status:** 🟡 adapter shell ready; implement `ClientWhatsappProvider.send()`. Meta template approval is a client-side lead-time item.

## 6. 🟡 Push notifications — FCM (optional)
Browser / app push. In-app notification bell already works without this.

| Client provides | Where |
|---|---|
| Firebase Cloud Messaging server credentials | backend `.env` |
| Set `PUSH_PROVIDER=client` | backend `.env` |

- **Status:** 🟡 adapter shell ready; implement `ClientPushProvider.send()`.

## 7. 🔴 Courier / shipping — BlueDart
Serviceability by pincode, live rates, AWB / label generation, pickup scheduling, live tracking timeline. **Today fulfilment status is set manually in admin** (packed → shipped → delivered).

| Client provides | Where |
|---|---|
| BlueDart API account + license | — |
| `BLUEDART_LICENSE_KEY`, `BLUEDART_LOGIN_ID`, `BLUEDART_API_BASE` | backend `.env` |
| Set `COURIER_PROVIDER=bluedart` | backend `.env` |

- **Status:** 🔴 config placeholders exist, but the **courier adapter must be built** (serviceability, rate, label, pickup, tracking). This is the largest remaining code item, not a config-only switch. Any courier (Delhivery, Shiprocket, etc.) can slot into the same adapter if the client prefers a different one.

## 8. 🔴 Hosting / deployment
Going live.

| Client provides / decides | Notes |
|---|---|
| Frontend host (Vercel free tier works) | `peace-web` |
| Backend host + managed Postgres | `peace-backend` |
| Domain name + SSL | DNS |
| `NEXT_PUBLIC_API_BASE_URL`, `CORS_ORIGINS` set to production URLs | env |

- **Status:** 🔴 deployment config + accounts (no app code needed).

## 9. ✅ Firebase Auth — already set up
Customer/admin login (email-password + Google).

- Project `peace-texocore` is live on the free Spark plan; web keys in `peace-web/.env.local`, Admin SDK service account in `peace-backend/.env`.
- For production the client should confirm ownership of this Firebase project (or provide their own) and review the plan if usage grows. `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` (backend) + `NEXT_PUBLIC_FIREBASE_*` (web).

---

## Client-supplied business data (not integrations, but needed for go-live)
- **Official logo & brand assets — _pending from client_.** Full-colour logo in vector (SVG) + PNG (a light-background and a dark-background version), plus a square icon/favicon and the brand colour codes. *The logo currently in the app and on this document is a placeholder until the client's official artwork is supplied.*
- GSTIN, HSN codes, legal company name/address for invoices
- Return / refund / privacy / shipping policy content
- Brand colours (theme is admin-editable once colours are confirmed)
- Support email / contact phone (`CONTACT_EMAIL`)

## Summary
| # | Integration | Readiness |
|---|---|---|
| 1 | Razorpay payments | 🟢 keys only |
| 2 | S3 media storage | 🟢 keys only |
| 3 | Email | 🟡 keys + wire `send()` |
| 4 | SMS | 🟡 keys + wire `send()` + DLT |
| 5 | WhatsApp | 🟡 keys + wire `send()` + Meta templates |
| 6 | Push (FCM) | 🟡 keys + wire `send()` (optional) |
| 7 | BlueDart courier | 🔴 full adapter build |
| 8 | Hosting / domain | 🔴 accounts + deploy config |
| 9 | Firebase Auth | ✅ done (confirm ownership for prod) |
