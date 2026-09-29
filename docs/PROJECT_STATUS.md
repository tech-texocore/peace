# Peace — Project Status

Clothing & textiles ecommerce built to Flipkart / Amazon / Shopify standard. Single-vendor today, marketplace-ready data model.

| | |
|---|---|
| **Built** | Full storefront, admin panel, checkout with Razorpay + COD, BharatShip shipping, returns & refunds, marketing |
| **Waiting on client** | VPS + domain, live Razorpay keys, BharatShip login, email (free Gmail/Brevo) + SMS / WhatsApp providers, logo & policies |
| **Pending before launch** | SEO, performance & accessibility pass, legal content, go-live |

---

## 1. What's built

### Platform
- Next.js storefront + admin, NestJS API, PostgreSQL via Prisma
- Firebase login (email/password + Google), free plan
- Roles & permissions: Super Admin, Admin, Staff — configurable permission matrix, admin menu filters by role
- Audit log of every admin change
- Config-driven storefront: home sections, navigation, footer, theme colours — all editable in admin, draft → publish
- Swappable provider adapters for payments, courier, email, SMS, WhatsApp, push, search and media
- Media on the server disk, switchable to S3 / R2 / MinIO by config; the database stores keys, not links, so domain or storage changes need no data change
- Search on Postgres full-text + typo tolerance (no paid services)
- Delete guards everywhere — anything in use is blocked with a clear message instead of leaving broken links

### Catalog
- Products with variants (size, colour …), per-variant SKU / price / MRP / stock
- Categories (unlimited depth), brands, collections (manual or rule-based)
- Option lists (sizes, colours, fabrics, patterns, occasions, UOM) editable by admin
- Images and videos per product, tagged to colours so the picture switches with the swatch
- Textile specifics: size chart, fabric sold by the metre, product personalisation fields
- HSN → GST auto-fill, SEO fields, related products, per-product return rules

### Shopping
- Home page driven by real data: categories, best sellers, new arrivals, offers
- Search with suggestions and typo tolerance; filters for size, colour, fabric, price, stock, sale; sorting
- Product page: gallery with full-screen view, variant picker, size chart, offers, reviews & Q&A, share, recently viewed
- Sold-out items stay visible with "Notify me"
- Cart for guests and signed-in users (merged on login), coupons with live price breakup
- Checkout: address with PIN lookup, delivery options, free-shipping threshold, server-side price check
- Wishlist, account profile with phone OTP, address book, password reset / change

### Orders & payments
- Razorpay (UPI, cards, netbanking, wallets) with signature check and webhook; Cash on Delivery
- Order lifecycle with timeline: placed → confirmed → packed → shipped → delivered / cancelled / returned
- Oversell-safe stock deduction, restock on cancel / return
- GST invoice (CGST / SGST split)
- Customer: order history, tracking, invoice download, cancel, return / exchange request
- Returns: admin approve → reverse pickup → refund through Razorpay
- BharatShip: book shipment, live tracking, cancel, reverse pickup — from the order screen

### Admin
- Dashboard: revenue, orders, average order value, 14-day trend, top products, low stock, pending work
- Orders, returns, customers, customer groups — filters, sorting, detail drawers
- Inventory with stock adjustments, movement history, low-stock view, back-in-stock requests
- Reviews moderation
- Site settings, sellers
- Integrations screen: Razorpay, BharatShip, email, SMS, WhatsApp keys — encrypted, live on save, test connection
- Email over any SMTP (free Gmail / Brevo) — order emails, contact form, verification codes
- Store logo with size controls (Super Admin), auto-trimmed on upload
- Meta Ads (Super Admin): Pixel + Conversions API, domain verification, product catalog feed, Custom Audiences
- Campaign links carry UTM tags per channel
- Danger Zone (Super Admin): delete all transaction data / restart fresh, with typed confirmation + email code

### Marketing & engagement
- Discounts: percentage, fixed amount, free shipping, buy-X-get-Y; automatic or coupon; targeting, schedule, limits, stacking
- Campaigns across email / SMS / WhatsApp / in-app with live preview and audience count
- Newsletter signups linked to a featured discount; back-in-stock notifications
- Abandoned-cart reminders and price-drop alerts
- In-app notification bell + customer notification preferences
- Order update emails for every status change

### Content
- About, Contact (form), Shipping, Returns, Privacy, Terms, Journal, Track Order pages

---

## 2. Pending before launch

**Needs client**
- [ ] Buy VPS + domain → go live ([SETUP.md](SETUP.md) part 2)
- [ ] Live Razorpay keys + webhook
- [ ] BharatShip login + pickup warehouse
- [ ] Email account (Gmail or Brevo, free) → enter in Integrations
- [ ] SMS and WhatsApp providers → wire each provider's `send()`
- [ ] Official logo, policy text, GSTIN / legal details

**Our side**
- [ ] SEO: product structured data, sitemap.xml, robots.txt
- [ ] Performance (image optimisation, Core Web Vitals) and accessibility pass
- [ ] Error monitoring
- [ ] Security review
- [ ] Invoice format polish with HSN, cookie consent, account deletion

**Nice to have**
- [ ] Pincode serviceability + live shipping rate at checkout
- [ ] Shipping zones, automatic delivery-status sync from courier

---

## 3. What the client provides

Without any keys the store already runs: Cash on Delivery, manual shipping, in-app notifications. The client (or we) enter every key in **admin → Integrations** — encrypted, live on save, with a Test connection button.

| # | Item | Client provides | Status |
|---|---|---|---|
| 1 | Hosting | VPS (e.g. Hostinger KVM 2, Ubuntu 24.04, India/Asia data centre) + domain | ✅ ready to deploy |
| 2 | Payments | KYC-approved Razorpay account, live API keys, webhook secret | ✅ built |
| 3 | Courier | BharatShip login + pickup warehouse | ✅ built |
| 4 | Login | Keep our Firebase project `peace-texocore`, or provide their own | ✅ running |
| 5 | Email | Free Gmail (App Password) or Brevo account + sender address | ✅ built |
| 6 | SMS | Provider (e.g. MSG91) + DLT sender & template approval | 🟡 small hookup |
| 7 | WhatsApp | WhatsApp Business API (Meta) + approved templates | 🟡 small hookup |

All hosting runs on the VPS — web, API, database, product images and videos. SSL, daily backups and the Cloudflare CDN are free.

**Business details**
- Official logo — SVG + PNG (light and dark), square icon, brand colours *(current logo is a placeholder)*
- GSTIN, HSN codes, legal name and address for invoices
- Return, refund, privacy and shipping policy text
- Support email and phone

---

## 4. Later (not in scope now)
- Bulk CSV import / export
- Gift wrap, saved cards, wallet, gift cards, loyalty & referrals, bulk pricing
- Blog / lookbook, FAQ, Tamil language
- Suppliers, purchase orders, multi-warehouse
- Deeper analytics, Redis cache, job queue, CI/CD, staging server
- **Multi-vendor marketplace** — `Seller` + `sellerId` already in the data model; would add seller onboarding, seller dashboard, order splitting, Razorpay Route payouts and commission
