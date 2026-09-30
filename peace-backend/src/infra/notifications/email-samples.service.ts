import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from './email.service';
import { SmtpEmailProvider } from './providers/smtp-email.provider';
import {
  backInStockEmail,
  campaignEmail,
  cartReminderEmail,
  contactFormEmail,
  orderEmail,
  priceDropEmail,
  verificationCodeEmail,
  type OrderEmailData,
  type ProductLine,
} from './email-content';
import type { EmailContent } from './email-template';

// Sends one of every email to an address, built with the real builders and the store's own products.
@Injectable()
export class EmailSamplesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    private readonly smtp: SmtpEmailProvider,
  ) {}

  async send(storeId: string, to: string, name: string | null) {
    if (!this.smtp.configured) throw new BadRequestException('Set up Email above and save it first');
    const products = await this.products(storeId);
    const [a, b = a] = products;
    const latest = await this.prisma.order.findFirst({ where: { storeId }, orderBy: { createdAt: 'desc' }, select: { id: true, orderNumber: true } });
    const order = this.sampleOrder(products, name, latest);
    const withStatus = (status: string, patch: Partial<OrderEmailData> = {}): OrderEmailData => ({ ...order, status, ...patch });
    const n = order.orderNumber;

    const samples: [string, EmailContent][] = [
      [`Order ${n} confirmed`, orderEmail(this.email, withStatus('CONFIRMED'), `Order ${n} confirmed`, 'Thanks for your order! We’ve received it and it’s confirmed.')],
      [`Payment received for ${n}`, orderEmail(this.email, withStatus('CONFIRMED', { paymentMethod: 'RAZORPAY', paymentStatus: 'PAID' }), `Payment received for ${n}`, 'Your payment was successful and your order is confirmed.')],
      [`Order ${n} update`, orderEmail(this.email, withStatus('PACKED'), `Order ${n} update`, 'Your order has been packed and is ready to ship.')],
      [`Order ${n} shipped`, orderEmail(this.email, withStatus('SHIPPED', { awb: '153854853300026', courierName: 'Delhivery' }), `Order ${n} shipped`, 'Your order is on its way with Delhivery. Track it with AWB 153854853300026.')],
      [`Order ${n} update`, orderEmail(this.email, withStatus('DELIVERED', { paymentStatus: 'PAID' }), `Order ${n} update`, 'Your order has been delivered — we hope you love it.')],
      [`Order ${n} cancelled`, orderEmail(this.email, withStatus('CANCELLED', { paymentMethod: 'RAZORPAY', paymentStatus: 'REFUNDED' }), `Order ${n} cancelled`, `Your order is cancelled and a refund of ${this.inr(order.total)} has been initiated to your original payment method.`)],
      [`Return requested for ${n}`, orderEmail(this.email, withStatus('DELIVERED', { paymentStatus: 'PAID' }), `Return requested for ${n}`, 'We’ve received your return request and will review it shortly.')],
      [`Return approved for ${n}`, orderEmail(this.email, withStatus('DELIVERED', { paymentStatus: 'PAID' }), `Return approved for ${n}`, 'Your return is approved. Our courier will collect the item (pickup AWB 42830610053384) — please keep it packed and ready.')],
      [`Item collected for ${n}`, orderEmail(this.email, withStatus('DELIVERED', { paymentStatus: 'PAID' }), `Item collected for ${n}`, 'We’ve collected your returned item. Your refund will be initiated shortly.')],
      [`Refund for ${n}`, orderEmail(this.email, withStatus('RETURNED', { paymentMethod: 'RAZORPAY', paymentStatus: 'REFUNDED' }), `Refund for ${n}`, `Your refund of ${this.inr(order.total)} has been initiated to your original payment method.`)],
      [`Exchange for ${n}`, orderEmail(this.email, withStatus('DELIVERED', { paymentStatus: 'PAID' }), `Exchange for ${n}`, 'Your replacement is on its way. Size L sent via Delhivery, tracking number 153854853300031.')],
      ['You left something in your bag', cartReminderEmail(this.email, name, [a, { ...b, quantity: 2 }])],
      [`Price drop on ${a.title}`, priceDropEmail(this.email, name, { ...a, price: Math.round(a.price * 0.8) }, a.price)],
      [`${a.title} is back in stock`, backInStockEmail(this.email, a)],
      [
        'Festive offer: 20% off everything',
        campaignEmail(
          'Festive offer: 20% off everything',
          'Our festive collection is here, and everything is 20% off this week.\n\nUse code FESTIVE20 at checkout. Offer ends Sunday.',
          this.email.link('/offers?utm_source=email&utm_medium=email&utm_campaign=sample'),
          name,
          { reason: 'You get these emails because you subscribed to our newsletter.', preferencesUrl: this.email.unsubscribeUrl(storeId, to), preferencesLabel: 'Unsubscribe' },
        ),
      ],
      ['Contact form: Question about sizes', contactFormEmail('Priya', 'priya@example.com', 'Question about sizes', 'Hi, does the shirt run true to size? I usually wear M.\n\nThanks!')],
      ['Verification code: Delete all transaction data', verificationCodeEmail('Delete all transaction data', '482913', 10)],
    ];

    for (const [subject, content] of samples) {
      await this.email.sendOrThrow(storeId, to, `[Sample] ${subject}`, content);
    }
    return { sent: samples.length, to };
  }

  private inr(n: number) {
    return `₹${n.toLocaleString('en-IN')}`;
  }

  private async products(storeId: string): Promise<ProductLine[]> {
    const rows = await this.prisma.product.findMany({
      where: { storeId, status: 'ACTIVE', variants: { some: {} } },
      orderBy: { createdAt: 'desc' },
      take: 2,
      select: {
        title: true,
        slug: true,
        media: { where: { type: 'IMAGE' }, orderBy: { position: 'asc' }, take: 1, select: { url: true } },
        variants: { orderBy: { position: 'asc' }, take: 1, select: { price: true, mrp: true, attributes: true } },
      },
    });
    if (!rows.length) throw new BadRequestException('Add at least one active product first — samples use your real products');
    return rows.map((p) => ({
      title: p.title,
      slug: p.slug,
      image: p.media[0]?.url ?? null,
      attributes: p.variants[0].attributes,
      price: Number(p.variants[0].price),
      mrp: p.variants[0].mrp ? Number(p.variants[0].mrp) : null,
    }));
  }

  // Uses the latest real order's id so the email's "View your order" button opens a real page.
  private sampleOrder(products: ProductLine[], customerName: string | null, latest: { id: string; orderNumber: string } | null): OrderEmailData {
    const items = products.map((p, i) => ({ name: p.title, image: p.image, attributes: p.attributes, quantity: i + 1, price: p.price, mrp: p.mrp ?? null }));
    const subtotal = items.reduce((s, it) => s + it.price * it.quantity, 0);
    return {
      id: latest?.id ?? 'sample',
      orderNumber: latest?.orderNumber ?? 'PE-SAMPLE0001',
      status: 'CONFIRMED',
      paymentMethod: 'COD',
      paymentStatus: 'UNPAID',
      subtotal,
      discount: 0,
      couponCode: null,
      shippingFee: 0,
      total: subtotal,
      awb: null,
      courierName: null,
      estimatedDelivery: new Date(Date.now() + 5 * 86_400_000),
      shippingAddress: { recipientName: customerName ?? 'Customer', line1: '17G3, Kandasamypuram', landmark: 'Opposite to KK Stores', city: 'Nazareth', state: 'Tamil Nadu', postalCode: '628617' },
      customerName,
      items,
    };
  }
}
