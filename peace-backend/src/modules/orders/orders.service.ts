import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { OrderStatus, PaymentMethod, PaymentStatus, ReturnStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { PricingService } from '../discounts/pricing.service';
import { PaymentsService } from '../payments/payments.service';
import { ShippingService } from '../../infra/shipping/shipping.service';
import type { ShipmentInput, TrackingResult } from '../../infra/shipping/shipping.types';
import { afterSalesOption, POLICY_SELECT, type AfterSalesType } from './after-sales.policy';
import { qualifiesForFreeDelivery, resolveShipping } from './checkout.config';
import type { CreateOrderDto } from './dto/order.dto';
import { MetaCapiService, type MetaContext } from '../meta/meta-capi.service';
import { EmailService } from '../../infra/notifications/email.service';
import { orderEmail } from '../../infra/notifications/email-content';
import { orderEmailData } from './order-email-data';

const round = (n: number) => Math.round(n * 100) / 100;
const CANCELLABLE: OrderStatus[] = ['PENDING', 'CONFIRMED', 'PACKED'];

// BharatShip shipment_status codes that need the admin's attention.
const COURIER_DELIVERED = 5;
const COURIER_ALERTS: Record<number, string> = {
  6: 'the courier cancelled this shipment; ship it again or cancel the order',
  7: 'returning to you (RTO); cancel the order once it is back',
  8: 'delivery failed; contact the customer',
  11: 'delivery attempt failed (NDR); contact the customer',
  15: 'shipment lost; raise it with BharatShip',
  19: 'returned to you; cancel the order to restock',
};

// What an admin may move an order to from each status. Unpaid online orders are
// confirmed only by the payment itself; returns go through the Returns flow.
export const ADMIN_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ['CANCELLED'],
  CONFIRMED: ['PACKED', 'SHIPPED', 'CANCELLED'],
  PACKED: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED', 'CANCELLED'],
  DELIVERED: [],
  CANCELLED: [],
  RETURNED: [],
};
// Unpaid online orders older than this are auto-cancelled and their reserved stock released.
const ORDER_PAYMENT_WINDOW_MIN = 30;

const STATUS_MESSAGE: Partial<Record<OrderStatus, string>> = {
  CONFIRMED: 'is confirmed and being prepared',
  PACKED: 'has been packed and is ready to ship',
  SHIPPED: 'has been shipped and is on its way',
  DELIVERED: 'has been delivered — we hope you love it',
  CANCELLED: 'has been cancelled',
  RETURNED: 'return has been processed',
};

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pricing: PricingService,
    private readonly payments: PaymentsService,
    private readonly shipping: ShippingService,
    private readonly meta: MetaCapiService,
    private readonly email: EmailService,
  ) {}

  get shippingEnabled() { return this.shipping.configured; }

  private async shipmentInput(order: {
    orderNumber: string; userId: string; total: Prisma.Decimal; paymentMethod: string;
    shippingAddress: Prisma.JsonValue;
    items: { productId: string; sku: string | null; name: string; price: Prisma.Decimal; quantity: number }[];
  }): Promise<ShipmentInput> {
    const a = (order.shippingAddress ?? {}) as Record<string, string>;
    const isCod = order.paymentMethod === 'COD';
    const [products, customer] = await Promise.all([
      this.prisma.product.findMany({
        where: { id: { in: order.items.map((i) => i.productId) } },
        select: { id: true, hsnCode: true, gstRate: true },
      }),
      this.prisma.user.findUnique({ where: { id: order.userId }, select: { email: true } }),
    ]);
    const tax = new Map(products.map((p) => [p.id, p]));
    return {
      orderNumber: order.orderNumber,
      paymentMode: isCod ? 'COD' : 'PPD',
      codAmount: isCod ? Number(order.total) : 0,
      totalAmount: Number(order.total),
      recipient: {
        name: a.recipientName ?? '',
        phone: (a.recipientPhone ?? '').replace(/\D/g, '').slice(-10),
        email: a.email || customer?.email || null,
        address: [a.line1, a.line2, a.landmark, a.city, a.district, a.state].filter(Boolean).join(', '),
        pincode: a.postalCode ?? '',
      },
      items: order.items.map((i) => ({
        sku: i.sku ?? '',
        name: i.name,
        hsn: tax.get(i.productId)?.hsnCode ?? '',
        price: Number(i.price),
        quantity: i.quantity,
        taxPercent: Number(tax.get(i.productId)?.gstRate ?? 0),
      })),
    };
  }

  // Admin: book the courier shipment (BharatShip) → save AWB → mark SHIPPED.
  async shipOrder(storeId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({ where: { id: orderId, storeId }, include: { items: true } });
    if (!order) throw new NotFoundException('Order not found');
    if (order.awb) throw new BadRequestException('This order already has a shipment');
    if (!['CONFIRMED', 'PACKED'].includes(order.status)) throw new BadRequestException('Only confirmed/packed orders can be shipped');
    if (!this.shipping.configured) throw new BadRequestException('Courier is not configured. Add the BharatShip login in Integrations to enable automatic shipping.');

    const result = await this.shipping.createShipment(await this.shipmentInput(order));
    await this.prisma.order.update({
      where: { id: order.id },
      data: {
        awb: result.awb, courierName: result.courierName, shipmentProvider: 'bharatship', status: 'SHIPPED',
        events: { create: { status: 'SHIPPED', note: `Shipped via ${result.courierName ?? 'courier'} — AWB ${result.awb}` } },
      },
    });
    void this.notifyOrder(order.id, `Order ${order.orderNumber} shipped`, `Your order is on its way${result.courierName ? ` with ${result.courierName}` : ''}. Track it with AWB ${result.awb}.`);
    return { awb: result.awb, courierName: result.courierName };
  }

  async trackShipment(awb: string) {
    if (!this.shipping.configured) throw new BadRequestException('Courier tracking is not available.');
    return this.shipping.track(awb);
  }

  async trackForUser(uid: string, orderId: string) {
    const user = await this.user(uid);
    const order = await this.prisma.order.findFirst({ where: { id: orderId, userId: user.id }, select: { awb: true, shipmentProvider: true } });
    return this.trackOrder(order);
  }

  async trackForAdmin(storeId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({ where: { id: orderId, storeId }, select: { awb: true, shipmentProvider: true } });
    return this.trackOrder(order);
  }

  private trackOrder(order: { awb: string | null; shipmentProvider: string | null } | null) {
    if (!order?.awb) throw new BadRequestException('No shipment to track yet');
    if (order.shipmentProvider !== 'bharatship') throw new BadRequestException('Live tracking is only available for BharatShip shipments');
    return this.trackShipment(order.awb);
  }

  // Pull courier status for shipped BharatShip orders: delivered orders are closed automatically,
  // anything that needs the admin (RTO, lost, courier-cancelled) is written to the timeline once.
  @Cron(CronExpression.EVERY_2_HOURS)
  async syncCourierStatus() {
    if (!this.shipping.configured) return;
    const shipped = await this.prisma.order.findMany({
      where: { status: 'SHIPPED', shipmentProvider: 'bharatship', awb: { not: null } },
      select: { id: true, orderNumber: true, awb: true, courierStatus: true, paymentMethod: true, paymentStatus: true },
    });
    for (const order of shipped) {
      try {
        await this.applyCourierStatus(order, await this.shipping.track(order.awb!));
      } catch (err) {
        this.logger.warn(`Courier status sync failed for ${order.orderNumber}: ${(err as Error).message}`);
      }
    }
  }

  private async applyCourierStatus(
    order: { id: string; orderNumber: string; courierStatus: string | null; paymentMethod: PaymentMethod; paymentStatus: PaymentStatus },
    tracking: TrackingResult,
  ) {
    if (tracking.code == null || tracking.status === order.courierStatus) return;
    if (tracking.code === COURIER_DELIVERED) {
      await this.prisma.order.update({
        where: { id: order.id },
        data: {
          status: 'DELIVERED',
          courierStatus: tracking.status,
          paymentStatus: order.paymentMethod === 'COD' ? 'PAID' : order.paymentStatus,
          events: { create: { status: 'DELIVERED', note: 'Delivered — confirmed by courier' } },
        },
      });
      void this.notifyOrder(order.id, `Order ${order.orderNumber} update`, `Your order ${STATUS_MESSAGE.DELIVERED}.`);
      return;
    }
    const alert = COURIER_ALERTS[tracking.code];
    await this.prisma.order.update({
      where: { id: order.id },
      data: {
        courierStatus: tracking.status,
        ...(alert && { events: { create: { status: 'SHIPPED', note: `Courier: ${tracking.status} — ${alert}` } } }),
      },
    });
  }

  // Release stock held by online orders that were never paid — otherwise abandoned
  // checkouts would silently lock inventory forever. Runs every 10 minutes.
  @Cron(CronExpression.EVERY_10_MINUTES)
  async expireUnpaidOrders() {
    const cutoff = new Date(Date.now() - ORDER_PAYMENT_WINDOW_MIN * 60_000);
    const stale = await this.prisma.order.findMany({
      where: { paymentMethod: 'RAZORPAY', status: 'PENDING', paymentStatus: 'PENDING', createdAt: { lt: cutoff } },
      include: { items: true },
    });
    for (const order of stale) {
      try {
        await this.prisma.$transaction(async (tx) => {
          for (const it of order.items) {
            if (it.variantId) await tx.productVariant.update({ where: { id: it.variantId }, data: { stock: { increment: it.quantity } } });
          }
          await tx.order.update({
            where: { id: order.id },
            data: {
              status: 'CANCELLED', paymentStatus: 'FAILED', cancelledAt: new Date(), cancelReason: 'Payment not completed in time',
              events: { create: { status: 'CANCELLED', note: 'Auto-cancelled — payment not completed' } },
            },
          });
        });
      } catch (err) {
        this.logger.error(`Failed to expire order ${order.orderNumber}`, err instanceof Error ? err.stack : String(err));
      }
    }
    if (stale.length) this.logger.log(`Expired ${stale.length} unpaid order(s); reserved stock released`);
  }

  // Bell notification + email for every order update; never blocks the order flow.
  private async notifyOrder(orderId: string, subject: string, line: string) {
    try {
      const o = await this.prisma.order.findUnique({
        where: { id: orderId },
        include: { items: { include: { variant: { select: { attributes: true } } } }, user: { select: { email: true, name: true } } },
      });
      if (!o) return;
      const orderPath = `/account/orders/${orderId}`;
      await this.prisma.notification.create({ data: { storeId: o.storeId, userId: o.userId, title: subject, body: line, deepLink: orderPath } });
      if (!o.user.email) return;

      await this.email.send(o.storeId, o.user.email, subject, orderEmail(this.email, orderEmailData(o), subject, line));
    } catch (err) {
      this.logger.warn(`Order notification failed for ${orderId}: ${(err as Error).message}`);
    }
  }

  private async user(uid: string) {
    const user = await this.prisma.user.findUnique({ where: { firebaseUid: uid }, select: { id: true, customerGroupId: true } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  private async storeForItems(variantIds: string[]) {
    const v = await this.prisma.productVariant.findFirst({ where: { id: { in: variantIds } }, select: { product: { select: { storeId: true } } } });
    if (!v) throw new BadRequestException('Products not found');
    return v.product.storeId;
  }

  async checkoutConfig() {
    const store = await this.prisma.store.findFirst({ select: { settings: true } });
    const shipping = resolveShipping(store?.settings);
    return {
      delivery: { methods: shipping.methods, freeForAll: shipping.freeForAll, freeShippingThreshold: shipping.freeShippingThreshold },
      cod: { enabled: shipping.codEnabled, fee: shipping.codFee },
      payment: this.payments.config(),
    };
  }

  async create(uid: string, dto: CreateOrderDto, metaCtx: MetaContext = {}) {
    const user = await this.user(uid);
    const storeId = await this.storeForItems(dto.items.map((i) => i.variantId));

    const address = await this.prisma.address.findFirst({ where: { id: dto.addressId, userId: user.id } });
    if (!address) throw new BadRequestException('Delivery address not found');

    // Authoritative pricing — never trust client-sent amounts.
    const quote = await this.pricing.quote(storeId, {
      items: dto.items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })),
      couponCodes: dto.couponCodes,
      customerGroupId: user.customerGroupId ?? undefined,
      userId: user.id,
    });
    if (!quote.lines.length) throw new BadRequestException('Your cart is empty');

    const store = await this.prisma.store.findUnique({ where: { id: storeId }, select: { settings: true } });
    const shipping = resolveShipping(store?.settings);
    if (!shipping.methods.length) throw new BadRequestException('Delivery is not available right now. Please contact the store.');
    const method = shipping.methods.find((m) => m.key === dto.deliveryMethod);
    if (!method) throw new BadRequestException('Please choose a delivery option');

    const freeShipping = qualifiesForFreeDelivery(shipping, quote.total, quote.freeShipping);
    let shippingFee = freeShipping ? 0 : method.fee;
    if (dto.paymentMethod === 'COD') {
      if (!shipping.codEnabled) throw new BadRequestException('Cash on Delivery is not available');
      shippingFee += shipping.codFee;
    }

    // GST breakup (prices are inclusive) — proportional to the amount actually paid.
    const products = await this.prisma.product.findMany({
      where: { id: { in: quote.lines.map((l) => l.productId) } },
      select: { id: true, gstRate: true, sellerId: true },
    });
    const meta = new Map(products.map((p) => [p.id, { rate: p.gstRate ? Number(p.gstRate) : 0, sellerId: p.sellerId }]));
    const payFactor = quote.subtotal > 0 ? (quote.subtotal - quote.totalDiscount) / quote.subtotal : 1;
    const taxAmount = round(
      quote.lines.reduce((sum, l) => {
        const rate = meta.get(l.productId)?.rate ?? 0;
        const paid = l.lineTotal * payFactor;
        return sum + (rate > 0 ? (paid * rate) / (100 + rate) : 0);
      }, 0),
    );

    const total = round(quote.total + shippingFee);
    const customs = new Map(dto.items.map((i) => [i.variantId, i.customization]));
    const estimatedDelivery = new Date(Date.now() + method.days * 86_400_000);
    const online = dto.paymentMethod === 'RAZORPAY';

    // Create the payment order (external call) before touching the DB.
    let paymentOrderId: string | null = null;
    if (online) {
      const providerOrder = await this.payments.createOrder(total, 'INR', `rcpt_${Date.now().toString(36)}`);
      paymentOrderId = providerOrder.providerOrderId;
    }

    const orderNumber = `PE-${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random() * 900 + 100)}`;
    const initialStatus: OrderStatus = online ? 'PENDING' : 'CONFIRMED';

    const order = await this.prisma.$transaction(async (tx) => {
      // Conditional decrement guards against overselling under concurrency.
      for (const l of quote.lines) {
        const res = await tx.productVariant.updateMany({ where: { id: l.variantId, stock: { gte: l.quantity } }, data: { stock: { decrement: l.quantity } } });
        if (res.count === 0) throw new BadRequestException(`"${l.title}" is out of stock`);
      }
      return tx.order.create({
        data: {
          orderNumber, storeId, userId: user.id, status: initialStatus,
          subtotal: quote.subtotal, discount: quote.totalDiscount, taxAmount, shippingFee, total,
          couponCode: quote.appliedDiscounts.find((d) => d.code)?.code ?? null,
          shippingAddress: address as unknown as Prisma.InputJsonValue,
          deliveryMethod: method.key, estimatedDelivery, notes: dto.notes ?? null,
          paymentMethod: dto.paymentMethod,
          paymentStatus: online ? 'PENDING' : 'UNPAID',
          paymentOrderId,
          items: {
            create: quote.lines.map((l) => ({
              productId: l.productId, variantId: l.variantId, sellerId: meta.get(l.productId)?.sellerId ?? null,
              name: l.title, image: l.image, sku: l.sku, price: l.unitPrice, mrp: l.mrp, quantity: l.quantity,
              customization: (customs.get(l.variantId) ?? undefined) as Prisma.InputJsonValue | undefined,
            })),
          },
          events: { create: { status: initialStatus, note: online ? 'Awaiting payment' : 'Order placed' } },
        },
        include: { items: true },
      });
    });

    if (!online) {
      void this.notifyOrder(order.id, `Order ${order.orderNumber} confirmed`, 'Thanks for your order! We’ve received it and it’s confirmed.');
      this.meta.purchase(order.id, metaCtx);
    }

    return {
      id: order.id, orderNumber: order.orderNumber, status: order.status, total: Number(order.total),
      paymentMethod: order.paymentMethod,
      payment: online
        ? { provider: 'razorpay', orderId: paymentOrderId, amount: Math.round(total * 100), currency: 'INR', keyId: this.payments.config().razorpay.keyId }
        : null,
    };
  }

  async verifyPayment(uid: string, orderId: string, paymentId: string, signature: string, metaCtx: MetaContext = {}) {
    const user = await this.user(uid);
    const order = await this.prisma.order.findFirst({ where: { id: orderId, userId: user.id } });
    if (!order) throw new NotFoundException('Order not found');
    if (!order.paymentOrderId) throw new BadRequestException('This order has no online payment');
    if (order.paymentStatus === 'PAID') return { paid: true };

    if (!this.payments.verifyPayment(order.paymentOrderId, paymentId, signature)) {
      throw new BadRequestException('Payment verification failed');
    }
    await this.prisma.order.update({
      where: { id: order.id },
      data: {
        paymentStatus: 'PAID', paymentRef: paymentId, status: 'CONFIRMED',
        events: { create: { status: 'CONFIRMED', note: 'Payment received' } },
      },
    });
    void this.notifyOrder(order.id, `Payment received for ${order.orderNumber}`, 'Your payment was successful and your order is confirmed.');
    this.meta.purchase(order.id, metaCtx);
    return { paid: true };
  }

  async handleWebhook(rawBody: string, signature: string) {
    if (!this.payments.verifyWebhook(rawBody, signature)) throw new ForbiddenException('Invalid signature');
    const event = JSON.parse(rawBody) as { event: string; payload?: { payment?: { entity?: { order_id?: string; id?: string } } } };
    const entity = event.payload?.payment?.entity;
    if (event.event === 'payment.captured' && entity?.order_id) {
      const order = await this.prisma.order.findFirst({ where: { paymentOrderId: entity.order_id, paymentStatus: { not: 'PAID' } } });
      if (order) {
        await this.prisma.order.update({
          where: { id: order.id },
          data: { paymentStatus: 'PAID', paymentRef: entity.id ?? null, status: 'CONFIRMED', events: { create: { status: 'CONFIRMED', note: 'Payment confirmed (webhook)' } } },
        });
        this.meta.purchase(order.id);
      }
    }
    return { received: true };
  }

  // ---------------- Customer reads ----------------
  async listForUser(uid: string) {
    const user = await this.user(uid);
    const orders = await this.prisma.order.findMany({
      where: { userId: user.id }, orderBy: { createdAt: 'desc' },
      include: { items: { select: { name: true, image: true, quantity: true } } },
    });
    return orders.map((o) => this.serialize(o));
  }

  async getForUser(uid: string, id: string) {
    const user = await this.user(uid);
    const order = await this.prisma.order.findFirst({
      where: { id, userId: user.id },
      include: { items: true, events: { orderBy: { createdAt: 'asc' } }, returns: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });
    if (!order) throw new NotFoundException('Order not found');
    return { ...this.serialize(order), events: this.customerTimeline(order), afterSales: await this.afterSalesFor(order) };
  }

  // What the customer may raise on this order right now — the same rules requestReturn enforces.
  private async afterSalesFor(order: { id: string; status: OrderStatus; events: { status: OrderStatus; createdAt: Date }[]; returns: { status: ReturnStatus }[] }) {
    if (order.status !== 'DELIVERED' || order.returns.some((r) => r.status !== 'REJECTED')) return null;
    const items = await this.prisma.orderItem.findMany({ where: { orderId: order.id }, select: { product: { select: POLICY_SELECT } } });
    const deliveredAt = [...order.events].reverse().find((e) => e.status === 'DELIVERED')?.createdAt ?? null;
    const products = items.map((i) => i.product);
    return { return: afterSalesOption('RETURN', products, deliveredAt), exchange: afterSalesOption('EXCHANGE', products, deliveredAt) };
  }

  // Customers see one plain-language step per status; admin notes and system details stay internal.
  private customerTimeline(order: {
    status: OrderStatus; paymentMethod: PaymentMethod; paymentStatus: PaymentStatus; courierName: string | null;
    events: { id: string; status: OrderStatus; createdAt: Date }[];
  }) {
    const online = order.paymentMethod === 'RAZORPAY';
    const text: Record<OrderStatus, string> = {
      PENDING: 'Awaiting payment',
      CONFIRMED: online ? 'Payment received — order confirmed' : 'Order placed',
      PACKED: 'Packed and ready to ship',
      SHIPPED: order.courierName ? `Shipped with ${order.courierName}` : 'Shipped',
      DELIVERED: 'Delivered',
      CANCELLED: order.paymentStatus === 'REFUNDED' ? 'Cancelled — refund initiated to your original payment method' : 'Cancelled',
      RETURNED: 'Returned — refund processed',
    };
    const seen = new Set<OrderStatus>();
    return order.events
      .filter((e) => !seen.has(e.status) && seen.add(e.status))
      .map((e) => ({ id: e.id, status: e.status, note: text[e.status], createdAt: e.createdAt }));
  }

  async invoiceFor(uid: string, id: string) {
    const user = await this.user(uid);
    const order = await this.prisma.order.findFirst({
      where: { id, userId: user.id },
      include: { items: true, store: { select: { name: true, settings: true } } },
    });
    if (!order) throw new NotFoundException('Order not found');
    const sellerId = order.items.find((i) => i.sellerId)?.sellerId;
    const seller = sellerId
      ? await this.prisma.seller.findUnique({ where: { id: sellerId }, select: { name: true, gstin: true, pickupCity: true, pickupState: true } })
      : null;
    const gstin = (order.store.settings as Record<string, unknown> | null)?.gstin as string | undefined;
    return {
      ...this.serialize(order),
      store: { name: order.store.name, gstin: gstin ?? seller?.gstin ?? null },
      seller: seller ? { name: seller.name, gstin: seller.gstin, city: seller.pickupCity, state: seller.pickupState } : null,
    };
  }

  async cancel(uid: string, id: string, reason?: string) {
    const user = await this.user(uid);
    const order = await this.prisma.order.findFirst({ where: { id, userId: user.id }, include: { items: true } });
    if (!order) throw new NotFoundException('Order not found');
    if (!CANCELLABLE.includes(order.status)) throw new BadRequestException('This order can no longer be cancelled');
    const refundId = await this.cancelOrder(order, reason ?? 'Cancelled by customer');
    return { cancelled: true, refundId };
  }

  // Cancels the courier shipment, refunds a captured online payment, restocks and records the
  // event. Any step that fails stops the cancellation so nothing is left half-done.
  private async cancelOrder(order: Prisma.OrderGetPayload<{ include: { items: true } }>, note: string) {
    if (order.awb && order.shipmentProvider === 'bharatship') {
      if (!this.shipping.configured) throw new BadRequestException('Courier is not configured, so the BharatShip shipment cannot be cancelled. Reconnect BharatShip in Integrations first.');
      try {
        await this.shipping.cancel(order.awb);
      } catch (e) {
        throw new BadRequestException(`Courier could not cancel shipment ${order.awb}: ${(e as Error).message}. Cancel it in BharatShip first, then try again.`);
      }
    }

    let refundId: string | null = null;
    if (order.paymentMethod === 'RAZORPAY' && order.paymentStatus === 'PAID') {
      if (!order.paymentRef) throw new BadRequestException('Payment reference missing — refund this order from the Razorpay dashboard, then cancel it.');
      try {
        refundId = (await this.payments.refund(order.paymentRef, Number(order.total), { orderNumber: order.orderNumber, reason: 'order_cancelled' })).refundId;
      } catch (e) {
        throw new BadRequestException(`Refund failed: ${(e as Error).message}`);
      }
    }

    await this.prisma.$transaction(async (tx) => {
      for (const it of order.items) {
        if (it.variantId) await tx.productVariant.update({ where: { id: it.variantId }, data: { stock: { increment: it.quantity } } });
      }
      await tx.order.update({
        where: { id: order.id },
        data: {
          status: 'CANCELLED', cancelReason: note, cancelledAt: new Date(),
          paymentStatus: refundId ? 'REFUNDED' : order.paymentStatus,
          events: { create: { status: 'CANCELLED', note: refundId ? `${note} — refund ${refundId}` : note } },
        },
      });
    });
    void this.notifyOrder(
      order.id,
      `Order ${order.orderNumber} cancelled`,
      refundId
        ? `Your order is cancelled and a refund of ₹${Number(order.total).toLocaleString('en-IN')} has been initiated to your original payment method.`
        : 'Your order has been cancelled.',
    );
    return refundId;
  }

  // ---------------- Returns / RMA ----------------
  async requestReturn(uid: string, orderId: string, type: AfterSalesType, reason: string) {
    const user = await this.user(uid);
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId: user.id },
      select: {
        id: true, storeId: true, status: true, orderNumber: true,
        items: { select: { product: { select: POLICY_SELECT } } },
        events: { where: { status: 'DELIVERED' }, orderBy: { createdAt: 'desc' }, take: 1, select: { createdAt: true } },
        returns: { where: { status: { not: 'REJECTED' } }, select: { id: true }, take: 1 },
      },
    });
    if (!order) throw new NotFoundException('Order not found');
    if (order.status !== 'DELIVERED') throw new BadRequestException('Returns and exchanges can be raised only after delivery');
    if (order.returns.length) throw new BadRequestException('A return or exchange has already been raised for this order');

    const option = afterSalesOption(type, order.items.map((i) => i.product), order.events[0]?.createdAt ?? null);
    if (!option.allowed) throw new BadRequestException(option.reason ?? 'This order is not eligible');

    const rr = await this.prisma.returnRequest.create({ data: { storeId: order.storeId, orderId, userId: user.id, type, reason } });
    void this.notifyOrder(order.id, `Return requested for ${order.orderNumber}`, `We’ve received your ${type.toLowerCase()} request and will review it shortly.`);
    return { id: rr.id, status: rr.status };
  }

  async myReturns(uid: string) {
    const user = await this.user(uid);
    return this.prisma.returnRequest.findMany({
      where: { userId: user.id }, orderBy: { createdAt: 'desc' },
      include: { order: { select: { orderNumber: true } } },
    });
  }

  async adminReturns(storeId: string, status?: ReturnStatus) {
    const rows = await this.prisma.returnRequest.findMany({
      where: { storeId, ...(status ? { status } : {}) }, orderBy: { createdAt: 'desc' }, take: 100,
      include: { order: { select: { id: true, orderNumber: true, total: true, paymentMethod: true, paymentStatus: true } }, user: { select: { name: true, email: true } } },
    });
    const pending = await this.prisma.returnRequest.count({ where: { storeId, status: 'REQUESTED' } });
    return { items: rows, pendingCount: pending };
  }

  async resolveReturn(
    storeId: string,
    id: string,
    action: 'APPROVE' | 'REJECT' | 'MARK_PICKED_UP' | 'REFUND' | 'COMPLETE_EXCHANGE',
    resolution?: string,
    pickup?: 'COURIER' | 'SELF',
  ) {
    const rr = await this.prisma.returnRequest.findFirst({ where: { id, storeId }, include: { order: { include: { items: true } } } });
    if (!rr) throw new NotFoundException('Return request not found');
    const order = rr.order;

    if (action === 'REJECT') {
      if (rr.status !== 'REQUESTED') throw new BadRequestException('Only a requested return can be rejected');
      await this.prisma.returnRequest.update({ where: { id }, data: { status: 'REJECTED', resolution: resolution ?? null } });
      void this.notifyOrder(order.id, `Return update for ${order.orderNumber}`, `Your return request could not be approved. ${resolution ?? ''}`.trim());
      return { updated: true, status: 'REJECTED' as const };
    }

    if (action === 'APPROVE') {
      if (rr.status !== 'REQUESTED') throw new BadRequestException('This return is already approved or resolved');
      if (!pickup) throw new BadRequestException('Choose how the item comes back: courier pickup or arranged by you');
      let reverseAwb: string | null = null;
      if (pickup === 'COURIER') {
        if (!this.shipping.configured) throw new BadRequestException('BharatShip is not connected. Connect it in Integrations, or choose "Arrange pickup yourself".');
        try {
          reverseAwb = (await this.shipping.createReverseShipment(await this.shipmentInput(order))).awb;
        } catch (e) {
          throw new BadRequestException(`Courier could not book the pickup: ${(e as Error).message}`);
        }
      }
      await this.prisma.returnRequest.update({ where: { id }, data: { status: 'APPROVED', resolution: resolution?.trim() || null, reverseAwb } });
      void this.notifyOrder(
        order.id,
        `Return approved for ${order.orderNumber}`,
        reverseAwb
          ? `Your return is approved. Our courier will collect the item (pickup AWB ${reverseAwb}) — please keep it packed and ready.`
          : `Your return is approved. We'll contact you to arrange collecting the item.${resolution?.trim() ? ` ${resolution.trim()}` : ''}`,
      );
      return { updated: true, status: 'APPROVED' as const, reverseAwb };
    }

    if (action === 'MARK_PICKED_UP') {
      if (rr.status !== 'APPROVED') throw new BadRequestException('Only an approved return can be marked as picked up');
      await this.prisma.returnRequest.update({ where: { id }, data: { status: 'PICKED_UP', pickedUpAt: new Date() } });
      void this.notifyOrder(order.id, `Item collected for ${order.orderNumber}`, 'We’ve collected your returned item. Your refund will be initiated shortly.');
      return { updated: true, status: 'PICKED_UP' as const };
    }

    if (action === 'COMPLETE_EXCHANGE') {
      if (rr.type !== 'EXCHANGE') throw new BadRequestException('Only an exchange can be completed this way');
      if (rr.status !== 'PICKED_UP') throw new BadRequestException('Complete the exchange after the item is picked up');
      const sent = resolution?.trim();
      if (!sent) throw new BadRequestException('Enter the replacement details (item, courier and tracking number)');
      await this.prisma.$transaction([
        this.prisma.returnRequest.update({ where: { id }, data: { status: 'EXCHANGED', resolution: sent } }),
        this.prisma.orderEvent.create({ data: { orderId: order.id, status: order.status, note: `Exchange completed — ${sent}` } }),
      ]);
      void this.notifyOrder(order.id, `Exchange for ${order.orderNumber}`, `Your replacement is on its way. ${sent}`);
      return { updated: true, status: 'EXCHANGED' as const };
    }

    // REFUND — only after the item is back with us.
    if (rr.status !== 'PICKED_UP') throw new BadRequestException('Refund can be initiated only after the item is picked up');
    if (rr.type === 'EXCHANGE') throw new BadRequestException('This is an exchange — send the replacement instead of refunding');
    const refundAmount = Number(order.total);
    const note = resolution?.trim();
    let refundId: string | null = null;
    if (order.paymentMethod === 'RAZORPAY') {
      if (order.paymentStatus !== 'PAID') throw new BadRequestException(`This order's payment is ${order.paymentStatus.toLowerCase()}, so there is nothing to refund online`);
      if (!order.paymentRef) throw new BadRequestException('Payment reference missing — refund from the Razorpay dashboard, then record it here with a note.');
      try {
        refundId = (await this.payments.refund(order.paymentRef, refundAmount, { orderNumber: order.orderNumber, returnId: rr.id })).refundId;
      } catch (e) {
        throw new BadRequestException(`Refund failed: ${(e as Error).message}`);
      }
    } else if (!note) {
      throw new BadRequestException('Cash on Delivery refunds are paid back by you — enter how you paid (e.g. UPI reference) in the note');
    }
    await this.prisma.$transaction(async (tx) => {
      for (const it of order.items) {
        if (it.variantId) await tx.productVariant.update({ where: { id: it.variantId }, data: { stock: { increment: it.quantity } } });
      }
      await tx.order.update({
        where: { id: order.id },
        data: {
          status: 'RETURNED', paymentStatus: 'REFUNDED',
          events: { create: { status: 'RETURNED', note: refundId ? `Refund processed (${refundId})` : `Refunded manually — ${note}` } },
        },
      });
      await tx.returnRequest.update({ where: { id }, data: { status: 'REFUNDED', refunded: true, refundId, refundAmount, refundedAt: new Date(), resolution: note || rr.resolution } });
    });
    void this.notifyOrder(
      order.id,
      `Refund for ${order.orderNumber}`,
      refundId
        ? `Your refund of ₹${refundAmount.toLocaleString('en-IN')} has been initiated to your original payment method.`
        : `Your refund of ₹${refundAmount.toLocaleString('en-IN')} has been paid. ${note}`,
    );
    return { updated: true, status: 'REFUNDED' as const, refundId };
  }

  // ---------------- Admin ----------------
  async adminList(storeId: string, query: { status?: OrderStatus; page?: number; limit?: number; search?: string; paymentStatus?: string; paymentMethod?: string; from?: string; to?: string }) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, query.limit ?? 20);
    const where: Prisma.OrderWhereInput = { storeId };
    if (query.status) where.status = query.status;
    if (query.paymentStatus) where.paymentStatus = query.paymentStatus as Prisma.OrderWhereInput['paymentStatus'];
    if (query.paymentMethod) where.paymentMethod = query.paymentMethod as Prisma.OrderWhereInput['paymentMethod'];
    if (query.from || query.to) {
      where.createdAt = {
        ...(query.from ? { gte: new Date(query.from) } : {}),
        ...(query.to ? { lte: new Date(new Date(query.to).getTime() + 86_399_999) } : {}),
      };
    }
    if (query.search) {
      where.OR = [
        { orderNumber: { contains: query.search, mode: 'insensitive' } },
        { user: { name: { contains: query.search, mode: 'insensitive' } } },
        { user: { email: { contains: query.search, mode: 'insensitive' } } },
      ];
    }

    const [rows, total, counts] = await Promise.all([
      this.prisma.order.findMany({
        where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit,
        include: { items: { select: { name: true, quantity: true } }, user: { select: { name: true, email: true } } },
      }),
      this.prisma.order.count({ where }),
      this.prisma.order.groupBy({ by: ['status'], where: { storeId }, _count: true }),
    ]);
    return {
      items: rows.map((o) => ({ ...this.serialize(o), customer: o.user.name ?? o.user.email })),
      total, page, limit,
      statusCounts: Object.fromEntries(counts.map((c) => [c.status, c._count])),
    };
  }

  // Counts for the admin menu badge: orders placed and waiting to be packed/shipped.
  async adminAttention(storeId: string) {
    const [newOrders, returns] = await Promise.all([
      this.prisma.order.count({ where: { storeId, status: 'CONFIRMED' } }),
      this.prisma.returnRequest.count({ where: { storeId, status: 'REQUESTED' } }),
    ]);
    return { newOrders, returns };
  }

  async adminGet(storeId: string, id: string) {
    const order = await this.prisma.order.findFirst({
      where: { id, storeId },
      include: { items: true, events: { orderBy: { createdAt: 'asc' } }, user: { select: { name: true, email: true, phone: true } } },
    });
    if (!order) throw new NotFoundException('Order not found');
    return {
      ...this.serialize(order),
      customer: order.user,
      allowedStatuses: ADMIN_TRANSITIONS[order.status],
      courierConnected: this.shipping.configured,
      paymentWindowMinutes: ORDER_PAYMENT_WINDOW_MIN,
    };
  }

  async updateStatus(storeId: string, id: string, status: OrderStatus, note?: string, shipment?: { awb?: string; courierName?: string }) {
    const order = await this.prisma.order.findFirst({ where: { id, storeId }, include: { items: true } });
    if (!order) throw new NotFoundException('Order not found');
    if (!ADMIN_TRANSITIONS[order.status].includes(status)) {
      throw new BadRequestException(`A ${order.status.toLowerCase()} order cannot be marked ${status.toLowerCase()}`);
    }
    const text = note?.trim() || null;

    if (status === 'CANCELLED') {
      await this.cancelOrder(order, text ?? 'Cancelled by store');
      return { updated: true };
    }

    let manualShipment: { awb: string; courierName: string } | null = null;
    if (status === 'SHIPPED') {
      const awb = shipment?.awb?.trim();
      const courierName = shipment?.courierName?.trim();
      if (!awb || !courierName) throw new BadRequestException('Enter the courier name and tracking number to mark this order shipped');
      manualShipment = { awb, courierName };
    }

    await this.prisma.order.update({
      where: { id: order.id },
      data: {
        status,
        ...(manualShipment && { ...manualShipment, shipmentProvider: 'manual' }),
        paymentStatus: status === 'DELIVERED' && order.paymentMethod === 'COD' ? 'PAID' : order.paymentStatus,
        events: {
          create: {
            status,
            note: manualShipment ? [`Shipped via ${manualShipment.courierName} — AWB ${manualShipment.awb}`, text].filter(Boolean).join(' · ') : text,
          },
        },
      },
    });
    const msg = manualShipment
      ? `has been shipped with ${manualShipment.courierName}. Tracking number: ${manualShipment.awb}`
      : STATUS_MESSAGE[status];
    if (msg) void this.notifyOrder(order.id, `Order ${order.orderNumber} update`, `Your order ${msg}.`);
    return { updated: true };
  }

  private serialize(o: {
    id: string; orderNumber: string; status: string; subtotal: Prisma.Decimal; discount: Prisma.Decimal;
    taxAmount: Prisma.Decimal; shippingFee: Prisma.Decimal; total: Prisma.Decimal; currency: string;
    couponCode: string | null; paymentMethod: string; paymentStatus: string; deliveryMethod: string;
    estimatedDelivery: Date | null; shippingAddress: Prisma.JsonValue; notes: string | null; createdAt: Date;
    awb?: string | null; courierName?: string | null; shipmentProvider?: string | null; courierStatus?: string | null;
    items?: unknown[]; events?: unknown[];
    returns?: { id: string; type: string; reason: string; status: string; resolution: string | null; refundId: string | null; refundAmount: Prisma.Decimal | null; reverseAwb: string | null; pickedUpAt: Date | null; refundedAt: Date | null; createdAt: Date }[];
  }) {
    const rr = o.returns?.[0];
    return {
      id: o.id, orderNumber: o.orderNumber, status: o.status,
      subtotal: Number(o.subtotal), discount: Number(o.discount), taxAmount: Number(o.taxAmount),
      shippingFee: Number(o.shippingFee), total: Number(o.total), currency: o.currency, couponCode: o.couponCode,
      paymentMethod: o.paymentMethod, paymentStatus: o.paymentStatus,
      deliveryMethod: o.deliveryMethod, estimatedDelivery: o.estimatedDelivery,
      shippingAddress: o.shippingAddress, notes: o.notes, createdAt: o.createdAt,
      awb: o.awb ?? null, courierName: o.courierName ?? null, shipmentProvider: o.shipmentProvider ?? null, courierStatus: o.courierStatus ?? null,
      items: o.items, events: o.events,
      returnRequest: rr ? { id: rr.id, type: rr.type, reason: rr.reason, status: rr.status, resolution: rr.resolution, refundId: rr.refundId, refundAmount: rr.refundAmount != null ? Number(rr.refundAmount) : null, reverseAwb: rr.reverseAwb, pickedUpAt: rr.pickedUpAt, refundedAt: rr.refundedAt, createdAt: rr.createdAt } : null,
    };
  }
}
