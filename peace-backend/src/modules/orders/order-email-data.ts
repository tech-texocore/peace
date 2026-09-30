import type { Prisma } from '@prisma/client';
import type { OrderEmailData } from '../../infra/notifications/email-content';

type OrderWithItems = Prisma.OrderGetPayload<{
  include: { items: { include: { variant: { select: { attributes: true } } } }; user: { select: { name: true } } };
}>;

export function orderEmailData(o: OrderWithItems): OrderEmailData {
  return {
    id: o.id,
    orderNumber: o.orderNumber,
    status: o.status,
    paymentMethod: o.paymentMethod,
    paymentStatus: o.paymentStatus,
    subtotal: Number(o.subtotal),
    discount: Number(o.discount),
    couponCode: o.couponCode,
    shippingFee: Number(o.shippingFee),
    total: Number(o.total),
    awb: o.awb,
    courierName: o.courierName,
    estimatedDelivery: o.estimatedDelivery,
    shippingAddress: (o.shippingAddress ?? {}) as Record<string, string | undefined>,
    customerName: o.user.name,
    items: o.items.map((it) => ({
      name: it.name,
      image: it.image,
      attributes: it.variant?.attributes,
      quantity: it.quantity,
      price: Number(it.price),
      mrp: it.mrp ? Number(it.mrp) : null,
    })),
  };
}
