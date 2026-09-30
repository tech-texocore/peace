import type { EmailContent, EmailItem } from './email-template';

// Every customer and admin email is written here, so real sends and the admin samples stay identical.

export interface EmailLinks {
  link(path: string): string;
  image(value: string | null | undefined): string | null;
}

export const inr = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

export const firstName = (name: string | null | undefined) => name?.trim().split(/\s+/)[0] || null;

const hello = (name: string | null | undefined) => `Hi ${firstName(name) ?? 'there'},`;

// "M · White", followed by the quantity when more than one.
export function variantDetail(attributes: unknown, quantity = 1) {
  const values =
    attributes && typeof attributes === 'object'
      ? Object.values(attributes as Record<string, unknown>).filter((v): v is string => typeof v === 'string' && v !== '')
      : [];
  return [...values, quantity > 1 ? `Qty ${quantity}` : null].filter(Boolean).join(' · ') || null;
}

const priced = (price: number, mrp: number | null | undefined, quantity = 1) => ({
  price: inr(price * quantity),
  oldPrice: mrp && mrp > price ? inr(mrp * quantity) : null,
});

const ACCOUNT_REASON = 'You get these emails because of your account notification settings.';

export interface ProductLine {
  title: string;
  slug: string;
  image: string | null;
  attributes?: unknown;
  quantity?: number;
  price: number;
  mrp?: number | null;
}

export function cartReminderEmail(l: EmailLinks, customerName: string | null, lines: ProductLine[]): EmailContent {
  const first = lines[0];
  const total = lines.reduce((sum, it) => sum + it.price * (it.quantity ?? 1), 0);
  return {
    preheader:
      lines.length === 1 ? `“${first.title}” is still waiting for you.` : `${lines.length} items are still waiting in your bag.`,
    heading: 'You left something in your bag',
    greeting: hello(customerName),
    paragraphs: ['Your picks are saved and waiting for you. Complete your order before they sell out.'],
    items: lines.map((it) => productItem(l, it)),
    summary: [{ label: 'Bag total', value: inr(total), strong: true }],
    cta: { label: 'Complete your order', url: l.link('/cart') },
    note: 'Prices and stock can change, so your items are not reserved until you place the order.',
    reason: ACCOUNT_REASON,
    preferencesUrl: l.link('/account/preferences'),
  };
}

export function priceDropEmail(l: EmailLinks, customerName: string | null, product: ProductLine, oldPrice: number): EmailContent {
  const pct = Math.round(((oldPrice - product.price) / oldPrice) * 100);
  const url = l.link(`/products/${product.slug}`);
  return {
    preheader: `${product.title} is now ${inr(product.price)} — ${pct}% off.`,
    heading: `${pct}% off something you liked`,
    greeting: hello(customerName),
    paragraphs: [`Good news — ${product.title} just got cheaper. Prices like this don't last long.`],
    items: [{ ...productItem(l, product), price: `From ${inr(product.price)}`, oldPrice: inr(oldPrice) }],
    cta: { label: 'Shop now', url },
    reason: ACCOUNT_REASON,
    preferencesUrl: l.link('/account/preferences'),
  };
}

export function backInStockEmail(l: EmailLinks, product: ProductLine): EmailContent {
  return {
    preheader: `${product.title} is available again — grab it before it sells out.`,
    heading: "It's back in stock",
    greeting: 'Hi there,',
    paragraphs: [
      `You asked us to let you know — ${product.title} is available again. Popular sizes go quickly, so don't wait too long.`,
    ],
    items: [productItem(l, product)],
    cta: { label: 'Shop now', url: l.link(`/products/${product.slug}`) },
    reason: 'You asked to be told when this item was back in stock.',
  };
}

export interface OrderEmailData {
  id: string;
  orderNumber: string;
  status: string;
  paymentMethod: string;
  paymentStatus: string;
  subtotal: number;
  discount: number;
  couponCode: string | null;
  shippingFee: number;
  total: number;
  awb: string | null;
  courierName: string | null;
  estimatedDelivery: Date | null;
  shippingAddress: Record<string, string | undefined>;
  customerName: string | null;
  items: { name: string; image: string | null; attributes: unknown; quantity: number; price: number; mrp: number | null }[];
}

export function orderEmail(l: EmailLinks, o: OrderEmailData, heading: string, line: string): EmailContent {
  const a = o.shippingAddress;
  const address = [
    a.recipientName,
    [a.line1, a.line2, a.landmark].filter(Boolean).join(', '),
    `${[a.city, a.state].filter(Boolean).join(', ')}${a.postalCode ? ` — ${a.postalCode}` : ''}`,
  ]
    .filter(Boolean)
    .join('\n');
  const shipped = o.status === 'SHIPPED' && o.awb;
  const payment =
    o.paymentStatus === 'REFUNDED'
      ? 'Refunded to your original payment method'
      : o.paymentMethod === 'COD'
        ? o.paymentStatus === 'PAID'
          ? 'Cash on Delivery · paid'
          : `Cash on Delivery · pay ${inr(o.total)} on delivery`
        : o.paymentStatus === 'PAID'
          ? 'Paid online'
          : 'Online payment pending';
  return {
    preheader: line,
    heading,
    greeting: hello(o.customerName),
    paragraphs: [line],
    items: o.items.map((it) => ({
      title: it.name,
      detail: variantDetail(it.attributes, it.quantity),
      image: l.image(it.image),
      ...priced(it.price, it.mrp, it.quantity),
    })),
    summary: [
      { label: 'Subtotal', value: inr(o.subtotal) },
      ...(o.discount > 0 ? [{ label: o.couponCode ? `Discount (${o.couponCode})` : 'Discount', value: `− ${inr(o.discount)}` }] : []),
      { label: 'Delivery', value: o.shippingFee > 0 ? inr(o.shippingFee) : 'Free' },
      { label: 'Total', value: inr(o.total), strong: true },
    ],
    details: [
      { label: 'Order number', value: o.orderNumber },
      { label: 'Payment', value: payment },
      ...(shipped ? [{ label: 'Shipment', value: `${o.courierName ?? 'Courier'} · Tracking number ${o.awb}` }] : []),
      ...(o.estimatedDelivery && ['CONFIRMED', 'PACKED', 'SHIPPED'].includes(o.status)
        ? [{ label: 'Expected delivery', value: o.estimatedDelivery.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }) }]
        : []),
      ...(address ? [{ label: 'Delivering to', value: address }] : []),
    ],
    cta: { label: shipped ? 'Track your order' : 'View your order', url: l.link(`/account/orders/${o.id}`) },
    note: 'Questions about this order? Just reply to this email.',
  };
}

export function campaignEmail(
  subject: string,
  body: string,
  shopUrl: string | null,
  recipientName: string | null,
  footer: { reason: string; preferencesUrl: string; preferencesLabel?: string },
): EmailContent {
  const paragraphs = body
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  return {
    preheader: paragraphs[0] ?? subject,
    heading: subject,
    greeting: recipientName ? hello(recipientName) : null,
    paragraphs,
    ...(shopUrl && { cta: { label: 'Shop now', url: shopUrl } }),
    ...footer,
  };
}

export function contactFormEmail(name: string, email: string, subject: string, message: string): EmailContent {
  return {
    preheader: `${name}: ${message.slice(0, 90)}`,
    heading: 'New message from your website',
    paragraphs: message
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter(Boolean),
    details: [
      { label: 'From', value: `${name} · ${email}` },
      { label: 'Subject', value: subject },
    ],
    cta: { label: `Reply to ${name}`, url: `mailto:${email}?subject=${encodeURIComponent(`Re: ${subject}`)}` },
    reason: 'Sent from the contact form on your website.',
  };
}

export function verificationCodeEmail(action: string, code: string, ttlMinutes: number): EmailContent {
  return {
    preheader: `Your code is ${code}`,
    heading: `Your code: ${code}`,
    paragraphs: [
      `You asked to ${action.toLowerCase()} in the admin panel. Enter this code to confirm.`,
      `It is valid for ${ttlMinutes} minutes. This action cannot be undone.`,
    ],
    note: "If this wasn't you, ignore this email and change your admin password.",
  };
}

function productItem(l: EmailLinks, p: ProductLine): EmailItem {
  return {
    title: p.title,
    detail: variantDetail(p.attributes, p.quantity ?? 1),
    image: l.image(p.image),
    url: l.link(`/products/${p.slug}`),
    ...priced(p.price, p.mrp, p.quantity ?? 1),
  };
}
