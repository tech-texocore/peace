export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');

export interface ProviderOrder {
  providerOrderId: string;
  amount: number; // in paise
  currency: string;
}

/**
 * Online payment gateway. Implemented with plain fetch + HMAC (no SDK), so the
 * only thing needed to go live is the client's Razorpay keys in .env.
 */
export interface PaymentProvider {
  readonly name: string;
  /** True once real credentials are present; false = COD-only until keys are added. */
  readonly configured: boolean;
  /** Public key id the browser checkout needs (never the secret). */
  readonly publicKey: string | null;
  createOrder(amountPaise: number, currency: string, receipt: string): Promise<ProviderOrder>;
  verifyPayment(providerOrderId: string, paymentId: string, signature: string): boolean;
  verifyWebhook(rawBody: string, signature: string): boolean;
}
