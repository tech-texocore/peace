import { api } from "@/lib/api/client";

export type OrderStatus = "PENDING" | "CONFIRMED" | "PACKED" | "SHIPPED" | "DELIVERED" | "CANCELLED" | "RETURNED";
export type PaymentMethod = "COD" | "RAZORPAY";

export interface DeliveryMethod { key: string; label: string; fee: number; days: number }
export interface CheckoutConfig {
  delivery: { methods: DeliveryMethod[]; freeShippingThreshold: number };
  cod: { enabled: boolean; fee: number };
  payment: { razorpay: { enabled: boolean; keyId: string | null } };
}

export interface OrderItem {
  id?: string; productId?: string; name: string; image: string | null; sku?: string | null;
  price?: number; mrp?: number | null; quantity: number; customization?: Record<string, unknown> | null;
}
export interface OrderEvent { id: string; status: OrderStatus; note: string | null; createdAt: string }
export interface ShippingAddress {
  recipientName: string; recipientPhone: string; line1: string; line2?: string | null; landmark?: string | null;
  city: string; district?: string | null; state: string; postalCode: string; country: string;
}
export interface Order {
  id: string; orderNumber: string; status: OrderStatus;
  subtotal: number; discount: number; taxAmount: number; shippingFee: number; total: number; currency: string;
  couponCode: string | null; paymentMethod: PaymentMethod; paymentStatus: string;
  deliveryMethod: string; estimatedDelivery: string | null; shippingAddress: ShippingAddress;
  notes: string | null; createdAt: string; items: OrderItem[]; events?: OrderEvent[];
  returnRequest?: {
    id: string; type: "RETURN" | "EXCHANGE"; reason: string; status: ReturnStatus;
    resolution: string | null; refundId: string | null; refundAmount: number | null;
    pickedUpAt: string | null; refundedAt: string | null; createdAt: string;
  } | null;
}

export interface CreateOrderInput {
  items: { variantId: string; quantity: number; customization?: Record<string, unknown> }[];
  couponCodes?: string[]; addressId: string; deliveryMethod: string; paymentMethod: PaymentMethod; notes?: string;
}
export interface CreateOrderResult {
  id: string; orderNumber: string; status: OrderStatus; total: number; paymentMethod: PaymentMethod;
  payment: { provider: string; orderId: string; amount: number; currency: string; keyId: string | null } | null;
}

export const getCheckoutConfig = () => api.get<CheckoutConfig>("/orders/checkout-config", { auth: true });
export const createOrder = (input: CreateOrderInput) => api.post<CreateOrderResult>("/orders", input, { auth: true });
export const verifyPayment = (orderId: string, paymentId: string, signature: string) =>
  api.post<{ paid: boolean }>(`/orders/${orderId}/verify-payment`, { paymentId, signature }, { auth: true });
export interface Invoice extends Order {
  store: { name: string; gstin: string | null };
  seller: { name: string; gstin: string | null; city: string | null; state: string | null } | null;
}
export const getInvoice = (id: string) => api.get<Invoice>(`/orders/mine/${id}/invoice`, { auth: true });
export const getMyOrders = () => api.get<Order[]>("/orders/mine", { auth: true });
export const getMyOrder = (id: string) => api.get<Order>(`/orders/mine/${id}`, { auth: true });
export const cancelOrder = (id: string, reason?: string) => api.post(`/orders/${id}/cancel`, { reason }, { auth: true });

export type ReturnStatus = "REQUESTED" | "APPROVED" | "PICKED_UP" | "REFUNDED" | "REJECTED";
export interface ReturnRequestT {
  id: string; type: "RETURN" | "EXCHANGE"; reason: string; status: ReturnStatus;
  resolution: string | null; refunded: boolean; createdAt: string; order?: { orderNumber: string };
}
export const requestReturn = (orderId: string, type: "RETURN" | "EXCHANGE", reason: string) =>
  api.post<{ id: string; status: ReturnStatus }>(`/orders/${orderId}/return`, { type, reason }, { auth: true });
export const getMyReturns = () => api.get<ReturnRequestT[]>("/orders/mine/returns", { auth: true });

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING: "Pending", CONFIRMED: "Confirmed", PACKED: "Packed", SHIPPED: "Shipped",
  DELIVERED: "Delivered", CANCELLED: "Cancelled", RETURNED: "Returned",
};
export const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;
