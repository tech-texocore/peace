# Peace — Complete Ecommerce Build Checklist (Flipkart/Amazon/Shopify standard)

Master tracking checklist for a fully-dynamic, marketplace-grade clothing ecommerce.
Legend: `[x]` done · `[ ]` pending · 🧵 textile-specific · ⚡ marketplace-grade must-have.

**How to read this doc:** everything **built and working** is in **Part A — ✅ Completed** (top).
Everything **not yet built** is collected in **Part B — ⬜ Pending** (bottom), grouped and
phased so nothing is buried inside the done work.

Status snapshot: **Foundation · Admin core · RBAC · Site-config · Theme · Audit** ✓ · **Phase 2 Catalog** ✓ · **Search + PLP/PDP** ✓ · **Reviews/Q&A** ✓ · **Promotions engine** ✓ · **Cart** ✓ · **Phase 3 Checkout → Orders → Payments** ✓ (COD live + Razorpay sandbox-ready, order lifecycle, GST invoice, customer + admin order management) · **Wishlist** ✓ · **Core ops** ✓ (order emails, Returns/RMA, analytics dashboard, inventory + back-in-stock, customers, server cart, contact) · **Referential-integrity delete guards** ✓ · **Customer password reset + change** ✓ · **Admin auto-educate/plain-language + mobile nav + sortable tables** ✓.
Demo data: `npm run seed` (or `npx prisma db seed`) — one standard, minimal-but-feature-complete seed in `scripts/seed.js`; demo content is out of app code, a fresh store starts from a neutral default config. Client focus now: **white shirts**.
**Next (needs client keys):** Razorpay live · BharatShip shipping · SMS/WhatsApp real send. **Free-now next:** SEO structured data · GST reports.

---

# Part A — ✅ Completed

## 0. Foundation & Platform
- [x] Monorepo: `peace-web` (Next.js) + `peace-backend` (NestJS) + Postgres/Prisma
- [x] Design-token system + boutique UI, responsive, light/dark
- [x] Config-driven storefront (published SiteConfig, ISR + fallback); **neutral default config** for new stores — no demo content baked into app code
- [x] Firebase auth wired (free plan) — verified live (Email/Password + Admin SDK claims); env/config layer, global guards/filters/interceptors
- [x] **Media storage (S3 + local dev)** — pluggable, folder-organized keys, upload/replace/delete with cleanup (no orphans); `/media` upload API + `/uploads` static serving ⚡
- [x] **Notifications framework** — unified `NotificationsService` with **4 separate channel provider-adapters** (SMS · WhatsApp · Email · Push), each: interface + console(dev) + client(real) provider + config-driven factory. **Future = drop keys + implement `send()` — no business-logic change**
- [x] **Provider-adapter architecture** — swappable interfaces + `.env` config for payments/courier/sms/whatsapp/email; console/dev + client stubs in place
- [x] **Single standard demo seed** (`scripts/seed.js`, wired to `npx prisma db seed`) — minimal but lights up every screen; idempotent, FK-safe delete order; catalog + collections + all discount types + customer groups + customers + orders (every status) + reviews (approved+pending) + Q&A + return + storefront config

## 1. Roles, Admin & Platform
- [x] Super Admin + Admin roles; `storeId` multi-tenant scoping
- [x] Configurable RBAC (AccessRole + permission catalog + PermissionsGuard)
  - [x] **Role-scoped visibility** — admin nav auto-filters by permissions; **platform-only** modules (Roles, Admins, Audit) = SUPER_ADMIN only; **storefront is role-aware** (admin/staff see "Go to Admin Panel", header account icon routes admins to `/admin`)
- [x] `/admin` login + dashboard shell + auth guard
- [x] Roles & Permissions editor (CRUD matrix) — plain-language action labels (View/Add/Edit/Delete/Publish)
- [x] Admin user management (create/edit/disable/delete, assign role+store) — temp-password hint
- [x] Site Config editor (all home sections + per-section visibility + publish)
- [x] **Site Settings** (name/tagline/currency · contact & social · SEO defaults) — platform-level, permission-gated
- [x] **Integration keys screen** (Razorpay/BharatShip/WhatsApp/SMS) — secrets masked on read, preserved on blank update; per-provider key-source hints
- [x] **Reusable `AddressFields`** (PIN-lookup) — shared by customer address book + seller pickup
- [x] **Staff role** via RBAC (seeded Staff role, limited perms)
- [x] **Audit logs + activity trail** — `AuditLog` + global interceptor auto-logs every admin mutation (actor/action/entity/status/IP); `/admin/audit` humanized (e.g. "Updated Product") + Success/Failed pills, filters + pagination
- [x] **Theme editor** (`/admin/theme`) — brand accent colours, presets, live preview, draft→publish; injected as CSS variables site-wide
- [x] **Seller data model** (`Seller` entity + full profile/policies + `sellerId` on products) — admin creates/manages sellers manually
- [x] **Admin UX/auto-educate polish** — grouped sidebar in a setup→sell→configure flow, mobile hamburger drawer + current-page title, shared `PageHeader`/`EmptyState`/`SortTh` components, sortable table headers, plain-English hints everywhere (no jargon), consistent dropdown chevrons, image dimension hints

## 2. Catalog & Merchandising 🧵 ⚡
- [x] **Masters (configurable reference data)** — `MasterList`+`MasterItem` (store-scoped), each list with a configurable field schema (`text|number|color|select`, unit, options); seeded UOM/Business Type/Size(measurements)/Colour(hex)/Fabric/Pattern/Occasion/Season; `/admin/masters` ("Option lists") two-pane + field editor
- [x] **`Seller` entity** + `sellerId` on products — marketplace-ready foundation; admin creates sellers manually (multi-vendor portal = future / out of scope, see end)
- [x] **Product** CRUD (`/admin/products`): seller, category-driven, Brand (FK), status, HSN→GST auto-fill, UOM, tags, SEO, return override, min/max qty, customisation builder, specifications
- [x] **Brands** — own module (`/admin/brands`): name/slug/logo/description/active, linked to products; delete-guarded
- [x] **Variants** — flexible axes from category (live grid), per-variant SKU/price/MRP/cost/stock/barcode/weight/dims; upsert-by-SKU on edit
- [x] **Product media** — multiple images + videos (`ProductMedia`), per-variant linkable; S3 provider env-driven; click-to-preview + set-as-main
- [x] **Categories** — self-ref tree (unlimited depth), materialized `path`, cycle/delete guards, reorder, category→master axis/spec mapping; tree UI + slide-over editor
- [x] **Collections** — Manual + Automated (rule-based match ALL/ANY over title/tag/category/brand/fabric/pattern/occasion/season/price), explicit join with ordering, `sortOrder`, SEO; rule builder
- [x] 🧵 **Size chart** — measurements via Size master, shown on PDP
- [x] 🧵 **Fabric by the metre** — UOM=METRE shows "₹X / metre" + length selector; cart price = price × metres
- [x] **Product personalisation** (Amazon "Customise" style) — dynamic `customizationFields` builder, rendered on PDP, captured in cart
- [x] 🧵 Colour **swatches** (Colour master hex) on PLP/PDP; **colour-linked images** — admin tags each image to a colour (product form), storefront swaps image when colour picked (PLP card + PDP gallery filter, product-level fallback)
- [x] Pricing: MRP + sale + discount %, GST inclusive/extra, currency
- [x] **Return rule per product** (`returnable`/`returnWindowDays` override seller default)
- [x] Tags, specifications table (category-driven), HSN→GST auto-fill
- [x] Related / "complete the look" cross-sell — `relatedProductIds` + same-category fallback
- [x] Admin catalog CRUD + media library
- [x] SEO fields per product (meta title/description → "Search & sharing")
- [x] **Referential-integrity delete guards (proper standard)** — no silent orphans: master option/list delete checks variant+spec usage (block + "hide instead"); product with orders → block, archive instead; category with products/children → block; discount used-in-orders → block, turn off; customer group default → protected; brand/seller in-use → block. Friendly errors, no raw 500s; soft-ref id arrays resolve via `in`-queries (crash-safe)

## 3. Search & Discovery ⚡
- [x] **Search engine** — pluggable `SearchProvider` adapter; default **Postgres** provider FREE (tsvector weighted + `pg_trgm` typo tolerance), no external service; wired into `/storefront/:slug/products?search=`
- [x] **Autocomplete / suggestions** (products + categories + brands, debounced overlay); typo-tolerant; **synonyms config-driven** per store (`store.settings.searchSynonyms`)
- [x] **PLP** (`/products`) — grid, category pills, sort (newest / price ↑↓ / biggest discount), "N items", real catalog
- [x] **PDP** (`/products/[slug]`) — image+video gallery, variant selector (stock-aware, swatches), price/MRP/discount, specs, size-chart modal, customisation, seller/return/delivery info
- [x] **Storefront home wired to real DB** — category grid, best-sellers + new-arrivals rails, hero featured product, promo banners, offers strip (real codes)
- [x] **Product cards** — quick Add to cart / Select options / In cart (N), discount %, MRP, swatches, option count, star rating
- [x] **Out-of-stock handling** — sold-out products still appear in the shop grid (sorted **last**, "Sold out" badge + **"Notify me"** CTA → PDP back-in-stock form, so the notify funnel works); the **in-stock facet filter** hides them on demand. Cart flags out-of-stock / low-stock lines, caps quantity, and blocks checkout; order creation rejects overselling (atomic)
- [x] **Full-width compact UI** — uniform horizontal padding, tighter section rhythm
- [x] **Faceted filters** — size/colour/fabric/price/in-stock/on-sale, live counts, URL-driven, desktop sidebar + mobile drawer
- [x] **Sort** — price ↑↓, newest, biggest discount
- [x] Category / collection landing pages — hero from category/collection master
- [x] **Recently viewed** — 100% client-side (localStorage, **no DB write / no backend load**), rail on PDP that records the view + shows previously-viewed (recency order), reuses the existing `/cards` endpoint. Trending + basic recommendations already served by **Best Sellers · New Arrivals · "You may also like"** rails. *ML personalisation (embeddings/real-time inference) intentionally out of scope — heavy + not free; revisit only at scale.*

## 4. Product Detail Page (PDP) ⚡ 🧵
- [x] Image + video gallery + thumbnails, click-to-open **full-screen lightbox** (keyboard nav, thumb strip)
- [x] **Variant selector** (axis chips, swatches) — stock-aware, live price
- [x] Price block: MRP, sale, discount %, GST-inclusive note
- [x] 🧵 **Size chart modal** — measurements from Size master, filtered to product sizes; fabric & care via specs
- [x] **Add to cart** (cart-aware button); customisation fields rendered
- [x] **Offers/coupons on PDP** — live coupon strip from active CODE discounts
- [x] **Ratings & reviews** — verified-buyer-only (server-enforced), photos, rating breakdown + filters, verified badge, helpful votes, sort/filter; **Q&A**; admin moderation; auto-approve config-driven. Ratings on PDP header + cards
- [x] **Related products** rail (mapped or same-category)
- [x] **Share** (Web Share API + copy-link); out-of-stock → notify me / back-in-stock

## 5. Cart & Checkout ⚡ — Phase 3
- [x] **Cart** — guest cart (localStorage, browse-freely), add/update/remove, header badge, add-to-cart on PLP + PDP
- [x] **Coupon apply + live price breakup** (subtotal, discounts, free-shipping, total) via pricing engine `/quote`; rejection reasons
- [x] Cart persistence per logged-in customer + **guest→user merge on login** + cross-device; save-for-later → wishlist
- [x] **Login gate** at checkout (Firebase); guest cart preserved through sign-in
- [x] Address selection + **delivery ETA**; free pincode lookup
- [x] Delivery options + charges + **free-shipping threshold** — config-driven (`store.settings.shipping`)
- [x] Multi-step checkout (address → delivery → payment → review) — server **re-quotes authoritatively**
- [x] Order summary + **GST invoice** (CGST/SGST split, GSTIN, no PDF dep); order notes

## 6. Payments (Razorpay) ⚡ — Phase 3
- [x] **Razorpay adapter** (order create, verify signature, webhook) — plain fetch + HMAC, no SDK; `PAYMENT_PROVIDER`. **Only client's live keys need adding** — test-mode works free
- [x] Methods: UPI/cards/netbanking/EMI/wallets — via Razorpay checkout (active on keys)
- [x] **COD** — config-driven, auto-confirm, marked PAID on delivery
- [x] Payment status (UNPAID/PENDING/PAID) — client verify + webhook wired

## 7. Orders & Fulfillment ⚡ — Phase 3
- [x] Order model + **lifecycle** (pending→confirmed→packed→shipped→delivered→cancelled/returned) with `OrderEvent` timeline
- [x] Order-items carry `sellerId` (marketplace-ready)
- [x] **Stock decrement** on order (atomic, oversell-safe) + **restock** on cancel/return
- [x] **Admin order management** (`/admin/orders`) — full-width, status tabs + counts, **payment/date/customer filters**, location column, sortable; **rich detail drawer** (customer contact, deliver-to + delivery/ETA, per-item breakdown, tax/coupon totals, **status timeline**, update controls); order items link to product; deep-link `?order=`/`?status=`
- [x] Customer: order history, detail, **track order** timeline, invoice download, self-cancel
- [x] **Returns / exchange (RMA)** — customer raises from delivered order → admin `/admin/returns` approve/reject → auto-restock + refund flag + email
- [x] Cancellations (before dispatch) — customer + admin, with restock

## 9. Inventory & Warehouse ⚡
- [x] **Inventory admin** (`/admin/inventory`) — full-width, stock per variant, 4 stat cards, **search + stock-status + category filters**, sortable, rich columns (image/brand/price), **stock adjust + `StockMovement` ledger**, **low-stock view/alerts**, **back-in-stock** notify (PDP → auto-email on restock); product rows link to product detail

## 10. Promotions & Offers — Pricing engine
- [x] **Customer Groups** (Retail/Wholesale/VIP…) — `CustomerGroup` + `User.customerGroupId`; `/admin/customer-groups` CRUD, default-group uniqueness
- [x] **Discounts** — types: **percentage · fixed ₹ · free-shipping · Buy-X-Get-Y**; automatic or coupon-code; `/admin/discounts` full builder (plain-language)
- [x] Targeting: scope ALL / products / categories (subtree) / collections; conditions (min subtotal/qty, groups); **schedule, usage limits, priority, stackable**
- [x] **Pricing/apply engine** (`PricingService`) — stacking + free-shipping + coupon rejection reasons; public `POST /storefront/:slug/quote`
- [x] Coupons folded into engine; home offers strip shows real codes
- [x] **Flash sales** = schedule on any discount; combo deals via BOGO
- [x] Base sale % (variant `price` vs `mrp`) on PLP/PDP

## 11. Customer Accounts
- [x] Email/Password + Google auth; auto-create customer
- [x] Profile (name, gender, DOB, consents) + **phone OTP verify**
- [x] Address book (PIN-code driven, CRUD, default handling)
- [x] **Customer group** field on user + **admin assign-to-group** in customers module
- [x] **Customers module** (`/admin/customers`) — full-width, **location filter (state) + group filter**, location + joined columns, sortable, detail drawer (spend, orders, addresses, group assign)
- [x] **Wishlist** — ♥ on cards + PDP, header badge, `/wishlist` page; guest (localStorage) + server-persisted with merge; browse-freely
- [x] Orders & tracking in account — history, detail, timeline, invoice, self-cancel
- [x] Returns & refunds in account — request Return/Exchange from delivered order
- [x] **Password reset (forgot password)** on sign-in — Firebase email reset link, enumeration-safe messaging
- [x] **Change password in account** — Security card (current → new → confirm, reauth); Google-only users see a note

## 12. Reviews & UGC ✓
- [x] Write review (rating + text + photos) — verified buyers only
- [x] Rating breakdown, helpful votes, verified badge, sort/filter; ratings on PDP + cards
- [x] Admin moderation (`/admin/reviews`) — approve/reject/delete + pending queue; auto-approve config-driven
- [x] Q&A on products (ask + community answers)

## 13. Notifications & Engagement — Phase 5
- [x] Notifications framework + pluggable providers (console/dev)
- [x] **Order-lifecycle emails** (placed/paid/packed/shipped/delivered/cancelled/return) + contact + back-in-stock — via NotificationsService (console now, real on SMTP keys)
- [x] **Subscriptions module** (`/admin/subscriptions`) — two tabs: **Newsletter signups** (separate `NewsletterSubscriber` table — not tied to an account, any email; auto-links to a registered customer when emails match; guest vs registered flag) and **Back-in-stock** requests (email + product → detail link + current stock + waiting/notified, per-row **"Notify"** + bulk **"Notify all in stock"** → restock email + marks notified). Storefront **newsletter is discount-driven** — an admin marks one discount "Feature in newsletter" (`featuredInNewsletter`); the home banner pulls the live value/code/min-spend (no hardcoded "10%"), config keeps only show/hide. **Subscribe form wired** (public `POST /storefront/:slug/subscribe`) → saves the email → reveals the code
- [x] **Campaigns module** (`/admin/campaigns`, permissions `campaigns.*`) — full-screen builder with **live preview**: pick **channels** (Email / SMS / WhatsApp / In-app), write a `{name}`-personalised message + subject, choose **audience** (all customers / newsletter subscribers / customer group / has-ordered, + location) with a **live recipient count**, a **deep-link** CTA and **searchable product suggestions** (server-driven — scales to large catalogs). **Send now** fans out per channel respecting each contact's opt-in (Email/SMS/WhatsApp via NotificationsService — console now, real on keys) and creates **in-app notifications** for registered customers. Draft / Sent lifecycle
- [x] **Customer notification inbox** (`/account/notifications`) — in-app notifications with read/unread, **deep-links** to product/order, mark-all-read; storefront **header bell** with unread badge for signed-in shoppers
- [x] **Notification preference center** (`/account/preferences`) — channel opt-ins (Email / SMS / WhatsApp) + per-category toggles (price drops, back-in-stock, cart reminders, offers, newsletter); order updates locked-on. Category catalog is config-driven; every send gated by `wants(user, category, channel)`
- [x] **Abandoned-cart recovery** (hourly in-process cron + admin manual trigger) & **price-drop alerts** (auto on admin price cut → notifies wishlist + cart shoppers) — in-app + email now, SMS/WhatsApp on keys; both respect the preference center
- [x] **Admin IA** — nav grouped into a clean flow: **Set up · Catalog · Sales · Marketing · Storefront · Settings & Access** (Campaigns / Discounts / Subscriptions under Marketing). Related sub-features nested as **tabs inside their parent** (not separate nav items): Returns → inside **Orders**, Customer Groups → inside **Customers**, Newsletter + Back-in-stock → inside **Subscriptions**. All admin pages full-width

## 14. Content & CMS
- [x] Configurable home sections + announcement + visibility toggles
- [x] **Navigation + Footer builder** (`/admin/config`) — Header Navigation (label + link, reorder, add/remove) and **Footer** (columns: title + links, add/remove, **route dropdown so links can't break**) + footer note; draft→publish→live; fully admin-editable, no code change
- [x] Static/legal pages — **About, Contact** (form), **Shipping** & **Returns** (pull live delivery/free-ship config), **Privacy, Terms, Journal, Track**; all footer links resolve (no 404s)

### Dynamic vs Static — quick reference
**Dynamic (DB / admin-editable):** products/variants/prices/swatches/ratings · categories + landing hero · collections/discounts/masters/reviews/orders · faceted filters (computed) · **header nav + footer columns** (SiteConfig via `/admin/config`) · brand/tagline/announcement/hero/value-props/section-titles/theme/featured (SiteConfig + `/admin/theme`) · shipping/synonyms/reviews-auto-approve/GSTIN (`store.settings.*`).
**Static (code):** sort options, page layouts, icons, filter labels, legal-page prose (dynamic values pull from config).

## 15. Analytics & Reports
- [x] **Admin dashboard KPIs** (`/admin`) — revenue, orders, AOV, units, low-stock; **14-day revenue trend (with total/avg)**, top products (clickable), **order-status pipeline strip**, customers + active-products counts, pending returns/reviews, recent orders (aligned, deep-linked); loading/error/empty states; quick-action buttons + compact "Manage" grid

---

# Part B — ⬜ Pending (mandatory before launch)

Only what is genuinely required to take this **single-vendor** store live is tracked as a checklist.
Items needing the client's paid keys are marked **(needs keys)** and are detailed in
[CLIENT_INTEGRATIONS.md](CLIENT_INTEGRATIONS.md). Everything non-essential is parked under
*Future / optional* at the end — pull any item back when the client asks for it.

## Payments (Razorpay)
- [ ] **Refunds** (full/partial) via gateway + status — *cancel/return already flags `REFUNDED`; gateway call = when keys live* **(needs keys)**

## Shipping / Courier (BharatShip)
- [x] **BharatShip adapter built** — admin "Ship" books a shipment (AWB), live tracking on the order, cancel, and **reverse pickup for returns**; auth-token cached. Live-verified against `app.bharatship.com` **(needs client keys to activate)**
- [ ] Serviceability by pincode + live rate at checkout (rate-calculator API) — enhancement
- [ ] Shipping zones & rates, free-shipping rules
- [ ] Live tracking timeline synced to order status

## Notifications
- [ ] **WhatsApp** real send (order updates, OTP, promos) **(needs keys + wire)**
- [ ] **SMS** real send (OTP + order alerts) **(needs keys + wire)**

## SEO & production readiness
- [ ] **SEO** — structured data (Product/Offer/Review), sitemap.xml, robots.txt
- [ ] Performance — image optimization, Core Web Vitals
- [ ] Accessibility (a11y) pass
- [ ] Error monitoring + logging (e.g. Sentry)
- [ ] Security hardening review *(RBAC / rate-limit / validation / helmet already done)*

## Legal & go-live
- [ ] GST invoice format polish + HSN on invoices
- [ ] Policy content (returns / privacy / shipping) + cookie consent
- [ ] Data privacy / account deletion
- [ ] Backups, migrations, CI/CD, staging + production
- [ ] Domain, SSL, deployment (frontend host + backend host)

---

## Future / optional — not in current scope
Parked deliberately. Pull any item back into the checklist above when the client asks.
- Catalog: bulk CSV import/export
- Cart / payments: gift wrap, saved cards, wallet / store credit / gift cards
- Loyalty & referral programs, tiered / bulk-quantity pricing
- Recently viewed, size/fit profile
- Content: blog / lookbook, FAQ, multi-language (Tamil / English)
- Advanced inventory: suppliers, purchase orders, GRN, stocktake, fabric-length & size×colour matrix, multi-warehouse
- Analytics deep-dive: inventory valuation, customer segments, GA/GTM funnels *(GST / tax reports = client's accountant)*
- Infra: Redis cache, background job queue

## Multi-vendor / marketplace — not now (single-vendor today)
The store runs **single-vendor**. The data model already carries a `Seller` entity + `sellerId` on
products (foundation baked in), so a marketplace is possible later without re-architecting. **If** the
client ever wants it, a future phase would add — at a basic level — admin-invited seller onboarding &
approval, a `SELLER` role + seller dashboard, per-seller order splitting, split payments (Razorpay
Route) and commission / payout reports. Out of current scope.

---

## Roadmap
- **Done** → Foundation · RBAC / admin / theme / audit · Catalog · PLP/PDP · Promotions · Cart · Checkout · Razorpay (sandbox) · GST invoice · Orders + stock · Reviews · Wishlist · Returns · Inventory + back-in-stock · Customers · Campaigns · Subscriptions · Notification preferences · Abandoned-cart + price-drop
- **Before launch** → Refunds (gateway) · BharatShip shipping / tracking · WhatsApp / SMS real send · SEO · perf / a11y / monitoring · legal content · deploy — *see checklist above; client keys in [CLIENT_INTEGRATIONS.md](CLIENT_INTEGRATIONS.md)*
- **Future / optional** → enhancements list above · multi-vendor marketplace
