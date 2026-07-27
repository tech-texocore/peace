// ─────────────────────────────────────────────────────────────────────────────
//  Peace — demo seed (single, standard entry point).
//
//  Seeds a MINIMAL but feature-complete dataset so every part of the app has
//  something to show: catalog (nested categories, single + multi-variant
//  products, low/out stock), collections (manual + auto), all discount types,
//  customer groups + customers with addresses, orders across every status,
//  reviews (approved + pending) + Q&A, a return request, and the storefront
//  home config. Client focus for now: white shirts.
//
//  Run:  npm run seed          (or)  npx prisma db seed
//  Admins (Firebase) are seeded separately: npm run seed:admins
//  Idempotent: clears this store's demo data first, then re-seeds.
// ─────────────────────────────────────────────────────────────────────────────
const fs = require('fs');
const path = require('path');
if (!process.env.DATABASE_URL) {
  try {
    const m = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8').match(/^DATABASE_URL=(.+)$/m);
    if (m) process.env.DATABASE_URL = m[1].trim().replace(/^["']|["']$/g, '');
  } catch {}
}
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

const STORE_SLUG = process.env.STORE_SLUG || 'peace';
const slugify = (s) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const daysAgo = (d) => new Date(Date.now() - d * 86_400_000);
const orderNo = (i) => `PE-${Date.now().toString(36).toUpperCase()}${String(100 + i)}`;

// Curated, verified white-shirt photos (Unsplash CDN, free to use).
const U = (id) => `https://images.unsplash.com/photo-${id}?w=900&q=80&auto=format&fit=crop`;
const IMG = {
  formalModel: '1603252109612-24fa03d145c8',   // white dress shirt on model
  hangerHalf: '1621773881532-fe65715b5137',     // white short-sleeve shirt on hanger
  threeHangers: '1603252110481-7ba873bf42ab',   // three shirts on hangers — white / blue / pink
  threeFolded: '1602810318383-e386cc2a3ccf',    // three folded shirts — navy / white / maroon
  onRack: '1603252109303-2751441dd157',         // white shirt on a rack
  heldWhiteBg: '1602810316498-ab67cf68c8e1',    // white shirt held up, white bg
  outdoors: '1529284607059-de6f2f0e661f',        // man in white shirt outdoors
  slimUrban: '1621072156002-e2fccdc0b176',       // man in slim white shirt, city
  detailPhone: '1567443022715-0d7ad3a48a9b',    // white shirt mid-body detail
  garden: '1649503597723-6ae116bd35b0',         // man in white shirt, greenery
};
const media = (...keys) => ({ create: keys.map((k, i) => ({ url: U(IMG[k]), type: 'IMAGE', position: i })) });

const SIZES = ['S', 'M', 'L', 'XL'];
const STOCKS = [24, 12, 4, 0, 30, 8, 18, 3, 22, 0, 15, 6]; // includes low (3,4,6) and out (0)

async function main() {
  const store = await prisma.store.findUnique({ where: { slug: STORE_SLUG } });
  if (!store) throw new Error(`Store "${STORE_SLUG}" not found — run the bootstrap first`);
  const storeId = store.id;

  // ── 1. Clear this store's demo data (OrderItem→Product is Restrict, so orders go first) ──
  await prisma.returnRequest.deleteMany({ where: { storeId } });
  await prisma.order.deleteMany({ where: { storeId } });
  await prisma.discount.deleteMany({ where: { storeId } });
  await prisma.product.deleteMany({ where: { storeId } });
  await prisma.collection.deleteMany({ where: { storeId } });
  await prisma.brand.deleteMany({ where: { storeId } });
  await prisma.category.deleteMany({ where: { storeId } });
  await prisma.seller.deleteMany({ where: { storeId } });
  await prisma.customerGroup.deleteMany({ where: { storeId } });

  // ── 2. Catalog ──
  const seller = await prisma.seller.create({ data: { storeId, name: 'Peace Apparel', isFirstParty: true, gstin: '33ABCDE1234F1Z5', pickupCity: 'Coimbatore', pickupState: 'Tamil Nadu', returnWindowDays: 7, codAvailable: true } });
  const ivory = await prisma.brand.create({ data: { storeId, name: 'Ivory & Co.', slug: 'ivory-co', description: 'Premium formal white shirts, tailored to last.', logoUrl: U(IMG.heldWhiteBg) } });
  const basics = await prisma.brand.create({ data: { storeId, name: 'Everyday Basics', slug: 'everyday-basics', description: 'Comfortable everyday white shirts.' } });

  const cat = (name, parent, image, axes = ['size', 'colour'], attrs = ['fabric', 'occasion', 'pattern']) =>
    prisma.category.create({ data: { storeId, name, slug: slugify(name), parentId: parent?.id ?? null, path: parent ? `${parent.path}/${slugify(name)}` : slugify(name), imageUrl: U(IMG[image]), variantAxisKeys: axes, attributeKeys: attrs } });
  const men = await cat('Men', null, 'slimUrban');
  const shirtsCat = await cat('Shirts', men, 'threeHangers');
  const formal = await cat('Formal Shirts', shirtsCat, 'formalModel');
  const casual = await cat('Casual Shirts', shirtsCat, 'outdoors');

  const best = await prisma.collection.create({ data: { storeId, title: 'Best Sellers', slug: 'best-sellers', type: 'MANUAL', sortOrder: 'BEST_SELLING', imageUrl: U(IMG.onRack) } });
  const newIn = await prisma.collection.create({ data: { storeId, title: 'New Arrivals', slug: 'new-arrivals', type: 'MANUAL', sortOrder: 'NEWEST', imageUrl: U(IMG.slimUrban) } });
  await prisma.collection.create({ data: { storeId, title: 'Formal Edit', slug: 'formal-edit', type: 'AUTO', sortOrder: 'MANUAL', imageUrl: U(IMG.threeFolded), rules: { match: 'ANY', conditions: [{ field: 'occasion', operator: 'eq', value: 'Formal' }] } } });

  let n = 0, sIdx = 0;
  async function product({ category, brand, title, price, mrp, colours, fabric, occasion, pattern, fit, sleeve, tags, best: isBest, images }) {
    const p = await prisma.product.create({
      data: {
        storeId, sellerId: seller.id, categoryId: category.id, brandId: brand.id, title, slug: slugify(title), status: 'ACTIVE', uom: 'PIECE',
        description: `${title} — a crisp, breathable ${fabric.toLowerCase()} shirt tailored for a sharp ${occasion.toLowerCase()} look. Wardrobe essential, made to last.`,
        variantAxes: ['size', 'colour'],
        specifications: [
          { key: 'fabric', label: 'Fabric', value: fabric },
          { key: 'occasion', label: 'Occasion', value: occasion },
          { key: 'pattern', label: 'Pattern', value: pattern },
          { key: 'fit', label: 'Fit', value: fit },
          { key: 'sleeve', label: 'Sleeve', value: sleeve },
          { key: 'care', label: 'Care', value: 'Machine wash cold, tumble dry low' },
        ],
        tags, hsnCode: '6205', gstRate: 5, returnable: true, returnWindowDays: 7,
        media: media(...images),
      },
    });
    for (const size of SIZES) {
      for (const colour of colours) {
        const sku = `PA${String(++n).padStart(3, '0')}-${size}-${colour.slice(0, 3).toUpperCase()}`;
        await prisma.productVariant.create({ data: { productId: p.id, sku, attributes: { size, colour }, price, mrp, stock: STOCKS[sIdx++ % STOCKS.length], weightGrams: 250 } });
      }
    }
    if (isBest) await prisma.collectionProduct.create({ data: { collectionId: best.id, productId: p.id, position: 0 } });
    return p;
  }

  const PRODUCTS = [
    { category: formal, brand: ivory, title: 'Classic White Formal Shirt', price: 1299, mrp: 1799, colours: ['White'], fabric: 'Cotton', occasion: 'Formal', pattern: 'Solid', fit: 'Regular', sleeve: 'Full sleeve', tags: ['formal', 'office', 'white'], best: true, images: ['formalModel', 'onRack', 'heldWhiteBg'] },
    { category: formal, brand: ivory, title: 'Premium Cotton Shirt', price: 1699, mrp: 2299, colours: ['White', 'Blue', 'Pink'], fabric: 'Cotton', occasion: 'Formal', pattern: 'Solid', fit: 'Regular', sleeve: 'Full sleeve', tags: ['premium', 'white'], best: true, images: ['threeHangers', 'formalModel'] },
    { category: casual, brand: basics, title: 'Oxford Button-Down Shirt', price: 1099, mrp: 1499, colours: ['White'], fabric: 'Cotton', occasion: 'Casual', pattern: 'Solid', fit: 'Regular', sleeve: 'Full sleeve', tags: ['oxford', 'casual', 'white'], best: true, images: ['outdoors', 'detailPhone'] },
    { category: casual, brand: basics, title: 'Linen Summer Shirt', price: 1399, mrp: 1899, colours: ['White'], fabric: 'Linen', occasion: 'Casual', pattern: 'Solid', fit: 'Relaxed', sleeve: 'Full sleeve', tags: ['linen', 'summer', 'white'], best: false, images: ['garden', 'outdoors'] },
    { category: casual, brand: basics, title: 'White Half-Sleeve Shirt', price: 899, mrp: 1299, colours: ['White'], fabric: 'Cotton', occasion: 'Casual', pattern: 'Solid', fit: 'Regular', sleeve: 'Half sleeve', tags: ['half-sleeve', 'summer', 'white'], best: false, images: ['hangerHalf'] },
  ];
  const products = [];
  for (const spec of PRODUCTS) products.push(await product(spec));
  for (let i = 0; i < 3; i++) await prisma.collectionProduct.create({ data: { collectionId: newIn.id, productId: products[products.length - 1 - i].id, position: i } });

  // All four discount types + a coupon code.
  await prisma.discount.create({ data: { storeId, name: '15% off Formal Shirts', method: 'AUTOMATIC', type: 'PERCENTAGE', value: 15, scope: 'CATEGORIES', targetCategoryIds: [formal.id], priority: 10 } });
  await prisma.discount.create({ data: { storeId, name: '₹200 off over ₹1499', method: 'AUTOMATIC', type: 'FIXED_AMOUNT', value: 200, scope: 'ALL', minSubtotal: 1499 } });
  await prisma.discount.create({ data: { storeId, name: 'Buy 2 Get 1 Free — Casual', method: 'AUTOMATIC', type: 'BUY_X_GET_Y', scope: 'CATEGORIES', targetCategoryIds: [casual.id], buyQuantity: 2, getQuantity: 1, getDiscountPercent: 100 } });
  await prisma.discount.create({ data: { storeId, name: 'Free shipping over ₹999', method: 'AUTOMATIC', type: 'FREE_SHIPPING', scope: 'ALL', minSubtotal: 999 } });
  await prisma.discount.create({ data: { storeId, name: 'First order 10%', method: 'CODE', code: 'PEACE10', type: 'PERCENTAGE', value: 10, minSubtotal: 999, stackable: true, featuredInNewsletter: true } });

  // ── 3. Customer groups + customers (with addresses for the location filter) ──
  const vip = await prisma.customerGroup.create({ data: { storeId, name: 'VIP', slug: 'vip', description: 'Loyal customers — early access & special pricing.' } });
  await prisma.customerGroup.create({ data: { storeId, name: 'Wholesale', slug: 'wholesale', description: 'Bulk buyers on negotiated rates.' } });

  const CUSTOMERS = [
    { uid: 'demo-order-uid-1', email: 'demo.shopper@peace.test', name: 'Demo Shopper', phone: '9876500000', city: 'Coimbatore', state: 'Tamil Nadu', pin: '641001', group: null },
    { uid: 'demo-cust-priya', email: 'priya.demo@peace.test', name: 'Priya M.', phone: '9876511111', city: 'Chennai', state: 'Tamil Nadu', pin: '600001', group: vip.id },
    { uid: 'demo-review-uid-1', email: 'meena.demo@peace.test', name: 'Meena R.', phone: '9876522222', city: 'Bengaluru', state: 'Karnataka', pin: '560001', group: null, avatar: U(IMG.formalModel) },
    { uid: 'demo-review-uid-2', email: 'karthik.demo@peace.test', name: 'Karthik S.', phone: '9876533333', city: 'Madurai', state: 'Tamil Nadu', pin: '625001', group: null },
    { uid: 'demo-review-uid-3', email: 'divya.demo@peace.test', name: 'Divya P.', phone: null, city: null, state: null, pin: null, group: null },
  ];
  const users = {};
  for (const c of CUSTOMERS) {
    const u = await prisma.user.upsert({
      where: { firebaseUid: c.uid },
      update: { name: c.name, phone: c.phone, avatarUrl: c.avatar ?? null, customerGroupId: c.group },
      create: { firebaseUid: c.uid, email: c.email, name: c.name, phone: c.phone, avatarUrl: c.avatar ?? null, role: 'CUSTOMER', customerGroupId: c.group },
    });
    users[c.uid] = u;
    if (c.city) {
      const existing = await prisma.address.findFirst({ where: { userId: u.id } });
      if (!existing) await prisma.address.create({ data: { userId: u.id, recipientName: c.name, recipientPhone: c.phone ?? '9000000000', line1: '12 Gandhi Street', line2: 'Near Bus Stand', city: c.city, district: c.city, state: c.state, postalCode: c.pin, country: 'India', type: 'HOME', isDefault: true } });
    }
  }
  const addrSnap = async (userId, fallbackName) => {
    const a = await prisma.address.findFirst({ where: { userId }, orderBy: { isDefault: 'desc' } });
    return a
      ? { recipientName: a.recipientName, recipientPhone: a.recipientPhone, line1: a.line1, line2: a.line2, landmark: a.landmark, city: a.city, district: a.district, state: a.state, postalCode: a.postalCode, country: a.country }
      : { recipientName: fallbackName, recipientPhone: '9000000000', line1: '1 Demo Street', line2: null, landmark: null, city: 'Coimbatore', district: 'Coimbatore', state: 'Tamil Nadu', postalCode: '641001', country: 'India' };
  };

  // ── 4. Orders across every status ──
  const variants = await prisma.productVariant.findMany({
    where: { stock: { gt: 0 }, product: { storeId, status: 'ACTIVE' } }, take: 8,
    include: { product: { select: { id: true, title: true, sellerId: true, media: { where: { type: 'IMAGE' }, take: 1 } } } },
  });
  const CHAINS = {
    PENDING: ['PENDING'],
    CONFIRMED: ['PENDING', 'CONFIRMED'],
    SHIPPED: ['PENDING', 'CONFIRMED', 'PACKED', 'SHIPPED'],
    DELIVERED: ['PENDING', 'CONFIRMED', 'PACKED', 'SHIPPED', 'DELIVERED'],
    CANCELLED: ['PENDING', 'CANCELLED'],
  };
  const ORDERS = [
    { uid: 'demo-order-uid-1', status: 'DELIVERED', pay: 'PAID', vi: [0, 1], ago: 12 },
    { uid: 'demo-order-uid-1', status: 'SHIPPED', pay: 'UNPAID', vi: [2], ago: 4 },
    { uid: 'demo-cust-priya', status: 'CONFIRMED', pay: 'UNPAID', vi: [3, 4], ago: 2 },
    { uid: 'demo-order-uid-1', status: 'PENDING', pay: 'UNPAID', vi: [5], ago: 0 },
    { uid: 'demo-cust-priya', status: 'CANCELLED', pay: 'UNPAID', vi: [6], ago: 6 },
  ];
  let deliveredOrder = null;
  for (let oi = 0; oi < ORDERS.length; oi++) {
    const o = ORDERS[oi];
    const user = users[o.uid];
    const snap = await addrSnap(user.id, user.name);
    const picked = o.vi.map((i) => variants[i]).filter(Boolean);
    if (!picked.length) continue;
    const items = picked.map((v) => ({ productId: v.product.id, variantId: v.id, sellerId: v.product.sellerId, name: v.product.title, image: v.product.media[0]?.url ?? null, sku: v.sku, price: v.price, mrp: v.mrp, quantity: 1 }));
    const subtotal = items.reduce((sum, it) => sum + Number(it.price) * it.quantity, 0);
    const shippingFee = subtotal >= 999 ? 0 : 49;
    const order = await prisma.order.create({
      data: {
        orderNumber: orderNo(oi), storeId, userId: user.id, status: o.status,
        subtotal, discount: 0, taxAmount: Math.round((subtotal * 5 / 105) * 100) / 100, shippingFee, total: subtotal + shippingFee,
        shippingAddress: snap, deliveryMethod: 'standard', estimatedDelivery: daysAgo(o.ago - 5),
        paymentMethod: 'COD', paymentStatus: o.pay, createdAt: daysAgo(o.ago),
        cancelledAt: o.status === 'CANCELLED' ? daysAgo(o.ago - 1) : null,
        items: { create: items },
        events: { create: CHAINS[o.status].map((st, idx) => ({ status: st, note: idx === 0 ? 'Order placed' : null, createdAt: daysAgo(o.ago - idx) })) },
      },
    });
    if (o.status === 'DELIVERED' && !deliveredOrder) deliveredOrder = order;
  }

  // ── 5. Reviews (approved + pending for moderation) + Q&A ──
  const TEMPLATES = [
    { rating: 5, title: 'Crisp and premium', comment: 'The fabric is superb and the white is exactly as shown. Worth every rupee.', status: 'APPROVED', media: 1 },
    { rating: 4, title: 'Good fit', comment: 'Neat stitching and a clean finish. Runs slightly loose, size down if between sizes.', status: 'APPROVED' },
    { rating: 5, title: 'Loved it', comment: 'Soft, comfortable and delivery was quick too.', status: 'APPROVED' },
    { rating: 3, title: 'Decent for the price', comment: 'Fabric is a touch thinner than expected but fine for daily wear.', status: 'PENDING' },
    { rating: 4, title: 'Sharp look', comment: 'Wore it to office and got compliments. Happy with the buy.', status: 'APPROVED' },
  ];
  const reviewerUids = ['demo-review-uid-1', 'demo-review-uid-2', 'demo-review-uid-3', 'demo-cust-priya'];
  let reviewCount = 0;
  for (let pi = 0; pi < products.length; pi++) {
    const count = pi < 2 ? 3 : 1; // first two products get a fuller breakdown
    for (let i = 0; i < count; i++) {
      const user = users[reviewerUids[(pi + i) % reviewerUids.length]];
      const t = TEMPLATES[(pi + i) % TEMPLATES.length];
      try {
        await prisma.review.create({ data: { storeId, productId: products[pi].id, userId: user.id, rating: t.rating, title: t.title, comment: t.comment, media: t.media ? [U(IMG.onRack)] : [], isVerifiedPurchase: true, status: t.status, helpfulCount: (pi + i) % 6 } });
        reviewCount++;
      } catch { /* unique(productId,userId) */ }
    }
  }
  const QA = [
    { q: 'Is this fabric machine washable?', a: 'Yes — gentle cold machine wash is fine. Avoid harsh detergents.' },
    { q: 'Does the white stay bright after washes?', a: 'It does if you wash inside-out and dry in shade.' },
  ];
  for (let qi = 0; qi < QA.length; qi++) {
    const asker = users[reviewerUids[qi % reviewerUids.length]];
    const answerer = users[reviewerUids[(qi + 1) % reviewerUids.length]];
    const question = await prisma.productQuestion.create({ data: { storeId, productId: products[0].id, userId: asker.id, body: QA[qi].q, status: 'APPROVED' } });
    await prisma.productAnswer.create({ data: { questionId: question.id, userId: answerer.id, body: QA[qi].a, isSeller: qi === 0, status: 'APPROVED' } });
  }

  // ── 6. Return request (on the delivered order) ──
  if (deliveredOrder) {
    await prisma.returnRequest.create({ data: { storeId, orderId: deliveredOrder.id, userId: deliveredOrder.userId, type: 'RETURN', reason: 'Size too small — need a larger size.', status: 'REQUESTED' } });
  }

  // ── 6b. Subscriptions (newsletter signups + a back-in-stock request) ──
  const SUBSCRIBERS = ['priya.demo@peace.test', 'newsub1@example.com', 'newsub2@example.com'];
  for (const email of SUBSCRIBERS) {
    const u = await prisma.user.findFirst({ where: { email, role: 'CUSTOMER' }, select: { id: true } });
    await prisma.newsletterSubscriber.upsert({ where: { storeId_email: { storeId, email } }, update: {}, create: { storeId, email, source: 'newsletter', userId: u?.id ?? null } });
  }
  const oosVariant = await prisma.productVariant.findFirst({ where: { stock: 0, product: { storeId } }, select: { id: true } });
  if (oosVariant) {
    await prisma.backInStockSubscription.upsert({ where: { variantId_email: { variantId: oosVariant.id, email: 'wants.restock@example.com' } }, update: {}, create: { storeId, variantId: oosVariant.id, email: 'wants.restock@example.com' } });
  }

  // ── 7. Storefront home config (demo content lives here, not in app code) ──
  const NAV = [
    { label: 'Shop', href: '/products' },
    { label: 'Formal', href: '/products?category=formal-shirts' },
    { label: 'Casual', href: '/products?category=casual-shirts' },
    { label: 'Offers', href: '/offers' },
    { label: 'About', href: '/about' },
  ];
  const CATS = [
    { name: 'Formal Shirts', count: '2 styles', href: '/products?category=formal-shirts', featured: true },
    { name: 'Casual Shirts', count: '3 styles', href: '/products?category=casual-shirts' },
  ];
  const PROMOS = [
    { title: 'The White Shirt Edit', subtitle: 'Crisp, breathable, everyday-ready', cta: 'Shop white shirts', href: '/products', image: U(IMG.threeHangers) },
    { title: 'Up to 30% Off Formal Shirts', subtitle: 'Sharp tailoring for the office', cta: 'Shop formal', href: '/products?category=formal-shirts', image: U(IMG.threeFolded) },
  ];
  const COUPONS = [{ code: 'PEACE10', label: '10% off your first order', note: 'Min. spend ₹999' }];
  const TESTI = [
    { name: 'Meena R.', location: 'Bengaluru', quote: 'The fabric is superb and the white is exactly as shown.' },
    { name: 'Priya M.', location: 'Chennai', quote: 'Sharp look, neat stitching — wore it to office and got compliments.' },
  ];
  const FOOTER = {
    groups: [
      { title: 'Shop', links: [
        { label: 'Shop all', href: '/products' },
        { label: 'Formal Shirts', href: '/products?category=formal-shirts' },
        { label: 'Casual Shirts', href: '/products?category=casual-shirts' },
        { label: 'Offers', href: '/offers' },
      ] },
      { title: 'Support', links: [
        { label: 'Shipping', href: '/shipping' },
        { label: 'Returns', href: '/returns' },
        { label: 'Track Order', href: '/track' },
        { label: 'Contact', href: '/contact' },
      ] },
      { title: 'Company', links: [
        { label: 'About', href: '/about' },
        { label: 'Journal', href: '/journal' },
        { label: 'Privacy', href: '/privacy' },
        { label: 'Terms', href: '/terms' },
      ] },
    ],
    note: 'Made with care.',
  };
  const cfg = await prisma.siteConfig.findUnique({ where: { storeId } });
  if (cfg) {
    const apply = (json) => {
      if (!json) return json;
      if (json.brand) json.brand.tagline = 'Crisp white shirts, thoughtfully made and calmly delivered.';
      if (json.newsletter) json.newsletter.title = 'Join the Peace list';
      json.marquee = ['Free shipping over ₹999', 'Easy 7-day returns', 'New white shirts every week', 'Cash on delivery available'];
      if (json.hero) {
        json.hero.eyebrow = 'The White Shirt Edit';
        json.hero.titleLead = 'The perfect';
        json.hero.titleEmphasis = 'white';
        json.hero.titleTail = 'shirt.';
        json.hero.subtitle = 'Crisp, breathable and tailored to last. Browse freely — sign in only when you are ready to check out.';
        json.hero.ratingText = 'Loved by our customers';
        json.hero.featuredProductSlug = 'classic-white-formal-shirt';
      }
      json.nav = NAV; json.categories = CATS; json.promos = PROMOS; json.coupons = COUPONS; json.testimonials = TESTI; json.footer = FOOTER;
      return json;
    };
    await prisma.siteConfig.update({ where: { storeId }, data: { draft: apply(cfg.draft), published: apply(cfg.published) } });
  }

  const [pc, vc, oc, rc] = await Promise.all([
    prisma.product.count({ where: { storeId } }),
    prisma.productVariant.count({ where: { product: { storeId } } }),
    prisma.order.count({ where: { storeId } }),
    prisma.review.count({ where: { storeId } }),
  ]);
  console.log(`Seeded: ${pc} products (${vc} variants) · 4 categories · 3 collections · 5 discounts · 2 customer groups · ${Object.keys(users).length} customers · ${oc} orders · ${rc} reviews · 1 return.`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
