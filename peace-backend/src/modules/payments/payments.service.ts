import { Inject, Injectable } from '@nestjs/common';
import { PAYMENT_PROVIDER, type PaymentProvider, type ProviderOrder } from './payment-provider.interface';

@Injectable()
export class PaymentsService {
  constructor(@Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProvider) {}

  get onlineEnabled() { return this.provider.configured; }

  /** Public config the storefront checkout reads (no secrets). */
  config() {
    return { razorpay: { enabled: this.provider.configured, keyId: this.provider.publicKey } };
  }

  createOrder(amountRupees: number, currency: string, receipt: string): Promise<ProviderOrder> {
    return this.provider.createOrder(Math.round(amountRupees * 100), currency, receipt);
  }

  verifyPayment(providerOrderId: string, paymentId: string, signature: string): boolean {
    return this.provider.verifyPayment(providerOrderId, paymentId, signature);
  }

  verifyWebhook(rawBody: string, signature: string): boolean {
    return this.provider.verifyWebhook(rawBody, signature);
  }
}
