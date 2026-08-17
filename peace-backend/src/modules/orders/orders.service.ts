import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { OrderStatus, ReturnStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { PricingService } from '../discounts/pricing.service';
import { PaymentsService } from '../payments/payments.service';
import { NotificationsService } from '../../infra/notifications/notifications.service';
import { resolveShipping } from './checkout.config';
import type { CreateOrderDto } from './dto/order.dto';

const round = (n: number) => Math.round(n * 100) / 100;
const CANCELLABLE: OrderStatus[] = ['PENDING', 'CONFIRMED', 'PACKED'];
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
    private readonly notifications: NotificationsService,
  ) {}

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

  // Order-lifecycle email (fire-and-forget; console provider until SMTP keys are set).
  private async notifyOrder(orderId: string, subject: string, line: string) {
    try {
      const o = await this.prisma.order.findUnique({ where: { id: orderId }, select: { orderNumber: true, total: true, user: { select: { email: true, name: true } } } });
      if (!o?.user.email) return;
      const html = `<p>Hi ${o.user.name ?? 'there'},</p><p>${line}</p><p>Order <b>${o.orderNumber}</b> · Total ₹${Number(o.total).toLocaleString('en-IN')}</p><p>— Peace</p>`;
      await this.notifications.sendEmail(o.user.email, subject, html);
    } catch { /* notifications must never block the order flow */ }
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
      delivery: { methods: shipping.methods, freeShippingThreshold: shipping.freeShippingThreshold },
      cod: { enabled: shipping.codEnabled, fee: shipping.codFee },
      payment: this.payments.config(),
    };
  }

  async create(uid: string, dto: CreateOrderDto) {
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
    const method = shipping.methods.find((m) => m.key === dto.deliveryMethod) ?? shipping.methods[0];

    const freeShipping = quote.freeShipping || quote.total >= shipping.freeShippingThreshold;
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

    if (!online) void this.notifyOrder(order.id, `Order ${order.orderNumber} confirmed`, 'Thanks for your order! We’ve received it and it’s confirmed.');

    return {
      id: order.id, orderNumber: order.orderNumber, status: order.status, total: Number(order.total),
      paymentMethod: order.paymentMethod,
      payment: online
        ? { provider: 'razorpay', orderId: paymentOrderId, amount: Math.round(total * 100), currency: 'INR', keyId: this.payments.config().razorpay.keyId }
        : null,
    };
  }

  async verifyPayment(uid: string, orderId: string, paymentId: string, signature: string) {
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
      include: { items: true, events: { orderBy: { createdAt: 'asc' } } },
    });
    if (!order) throw new NotFoundException('Order not found');
    return this.serialize(order);
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

    await this.prisma.$transaction(async (tx) => {
      for (const it of order.items) {
        if (it.variantId) await tx.productVariant.update({ where: { id: it.variantId }, data: { stock: { increment: it.quantity } } });
      }
      await tx.order.update({
        where: { id: order.id },
        data: {
          status: 'CANCELLED', cancelReason: reason ?? null, cancelledAt: new Date(),
          paymentStatus: order.paymentStatus === 'PAID' ? 'REFUNDED' : order.paymentStatus,
          events: { create: { status: 'CANCELLED', note: reason ?? 'Cancelled by customer' } },
        },
      });
    });
    void this.notifyOrder(order.id, `Order ${order.orderNumber} cancelled`, 'Your order has been cancelled. Any payment will be refunded to the original method.');
    return { cancelled: true };
  }

  // ---------------- Returns / RMA ----------------
  async requestReturn(uid: string, orderId: string, type: 'RETURN' | 'EXCHANGE', reason: string) {
    const user = await this.user(uid);
    const order = await this.prisma.order.findFirst({ where: { id: orderId, userId: user.id }, select: { id: true, storeId: true, status: true, orderNumber: true } });
    if (!order) throw new NotFoundException('Order not found');
    if (order.status !== 'DELIVERED') throw new BadRequestException('Returns can be raised only after delivery');
    const existing = await this.prisma.returnRequest.findFirst({ where: { orderId, status: { in: ['REQUESTED', 'APPROVED'] } } });
    if (existing) throw new BadRequestException('A return is already in progress for this order');

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
      include: { order: { select: { orderNumber: true, total: true } }, user: { select: { name: true, email: true } } },
    });
    const pending = await this.prisma.returnRequest.count({ where: { storeId, status: 'REQUESTED' } });
    return { items: rows, pendingCount: pending };
  }

  async resolveReturn(storeId: string, id: string, action: 'APPROVE' | 'REJECT', resolution?: string) {
    const rr = await this.prisma.returnRequest.findFirst({ where: { id, storeId }, include: { order: { include: { items: true } } } });
    if (!rr) throw new NotFoundException('Return request not found');
    if (rr.status !== 'REQUESTED') throw new BadRequestException('This request is already resolved');

    if (action === 'REJECT') {
      await this.prisma.returnRequest.update({ where: { id }, data: { status: 'REJECTED', resolution: resolution ?? null } });
      void this.notifyOrder(rr.orderId, `Return update for ${rr.order.orderNumber}`, `Your return request could not be approved. ${resolution ?? ''}`);
      return { updated: true };
    }

    // Approve → mark order RETURNED, restock, flag refund.
    await this.prisma.$transaction(async (tx) => {
      for (const it of rr.order.items) {
        if (it.variantId) await tx.productVariant.update({ where: { id: it.variantId }, data: { stock: { increment: it.quantity } } });
      }
      await tx.order.update({
        where: { id: rr.orderId },
        data: {
          status: 'RETURNED',
          paymentStatus: rr.order.paymentStatus === 'PAID' ? 'REFUNDED' : rr.order.paymentStatus,
          events: { create: { status: 'RETURNED', note: 'Return approved & restocked' } },
        },
      });
      await tx.returnRequest.update({ where: { id }, data: { status: 'COMPLETED', refunded: true, resolution: resolution ?? null } });
    });
    void this.notifyOrder(rr.orderId, `Return approved for ${rr.order.orderNumber}`, 'Your return is approved. Your refund will be processed to the original payment method.');
    return { updated: true };
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

  async adminGet(storeId: string, id: string) {
    const order = await this.prisma.order.findFirst({
      where: { id, storeId },
      include: { items: true, events: { orderBy: { createdAt: 'asc' } }, user: { select: { name: true, email: true, phone: true } } },
    });
    if (!order) throw new NotFoundException('Order not found');
    return { ...this.serialize(order), customer: order.user };
  }

  async updateStatus(storeId: string, id: string, status: OrderStatus, note?: string) {
    const order = await this.prisma.order.findFirst({ where: { id, storeId }, include: { items: true } });
    if (!order) throw new NotFoundException('Order not found');

    await this.prisma.$transaction(async (tx) => {
      // Restock when an order is cancelled/returned by the admin.
      if ((status === 'CANCELLED' || status === 'RETURNED') && !['CANCELLED', 'RETURNED'].includes(order.status)) {
        for (const it of order.items) {
          if (it.variantId) await tx.productVariant.update({ where: { id: it.variantId }, data: { stock: { increment: it.quantity } } });
        }
      }
      await tx.order.update({
        where: { id: order.id },
        data: {
          status,
          paymentStatus: status === 'DELIVERED' && order.paymentMethod === 'COD' ? 'PAID' : order.paymentStatus,
          cancelledAt: status === 'CANCELLED' ? new Date() : order.cancelledAt,
          events: { create: { status, note: note ?? null } },
        },
      });
    });
    const msg = STATUS_MESSAGE[status];
    if (msg) void this.notifyOrder(order.id, `Order ${order.orderNumber} update`, `Your order ${msg}.`);
    return { updated: true };
  }

  private serialize(o: {
    id: string; orderNumber: string; status: string; subtotal: Prisma.Decimal; discount: Prisma.Decimal;
    taxAmount: Prisma.Decimal; shippingFee: Prisma.Decimal; total: Prisma.Decimal; currency: string;
    couponCode: string | null; paymentMethod: string; paymentStatus: string; deliveryMethod: string;
    estimatedDelivery: Date | null; shippingAddress: Prisma.JsonValue; notes: string | null; createdAt: Date;
    items?: unknown[]; events?: unknown[];
  }) {
    return {
      id: o.id, orderNumber: o.orderNumber, status: o.status,
      subtotal: Number(o.subtotal), discount: Number(o.discount), taxAmount: Number(o.taxAmount),
      shippingFee: Number(o.shippingFee), total: Number(o.total), currency: o.currency, couponCode: o.couponCode,
      paymentMethod: o.paymentMethod, paymentStatus: o.paymentStatus,
      deliveryMethod: o.deliveryMethod, estimatedDelivery: o.estimatedDelivery,
      shippingAddress: o.shippingAddress, notes: o.notes, createdAt: o.createdAt,
      items: o.items, events: o.events,
    };
  }
}
