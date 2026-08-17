import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { PaymentProvider, ProviderOrder } from '../payment-provider.interface';

// Razorpay via REST + HMAC only — no SDK dependency. Works in test mode with
// test keys (free, no real money) and in live mode once live keys are set.
@Injectable()
export class RazorpayProvider implements PaymentProvider {
  readonly name = 'razorpay';
  private readonly keyId?: string;
  private readonly keySecret?: string;
  private readonly webhookSecret?: string;

  constructor(config: ConfigService) {
    this.keyId = config.get<string>('integrations.payments.razorpay.keyId');
    this.keySecret = config.get<string>('integrations.payments.razorpay.keySecret');
    this.webhookSecret = config.get<string>('integrations.payments.razorpay.webhookSecret');
  }

  get configured() { return Boolean(this.keyId && this.keySecret); }
  get publicKey() { return this.keyId ?? null; }

  async createOrder(amountPaise: number, currency: string, receipt: string): Promise<ProviderOrder> {
    if (!this.configured) throw new BadRequestException('Online payments are not configured. Please use Cash on Delivery.');
    const auth = Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64');
    const res = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: amountPaise, currency, receipt, payment_capture: 1 }),
    });
    if (!res.ok) throw new BadRequestException('Could not initiate payment. Please try again.');
    const body = (await res.json()) as { id: string; amount: number; currency: string };
    return { providerOrderId: body.id, amount: body.amount, currency: body.currency };
  }

  async refund(paymentId: string, amountPaise: number, notes?: Record<string, string>) {
    if (!this.configured) throw new BadRequestException('Online payments are not configured.');
    const auth = Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64');
    const res = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}/refund`, {
      method: 'POST',
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: amountPaise, speed: 'normal', notes: notes ?? {} }),
    });
    const body = (await res.json()) as { id?: string; amount?: number; status?: string; error?: { description?: string } };
    if (!res.ok || !body.id) throw new BadRequestException(body.error?.description ?? 'Refund could not be processed at the gateway.');
    return { refundId: body.id, amount: body.amount ?? amountPaise, status: body.status ?? 'processed' };
  }

  verifyPayment(providerOrderId: string, paymentId: string, signature: string): boolean {
    if (!this.keySecret) return false;
    const expected = createHmac('sha256', this.keySecret).update(`${providerOrderId}|${paymentId}`).digest('hex');
    return this.safeEqual(expected, signature);
  }

  verifyWebhook(rawBody: string, signature: string): boolean {
    if (!this.webhookSecret) return false;
    const expected = createHmac('sha256', this.webhookSecret).update(rawBody).digest('hex');
    return this.safeEqual(expected, signature);
  }

  private safeEqual(a: string, b: string): boolean {
    const ab = Buffer.from(a);
    const bb = Buffer.from(b);
    return ab.length === bb.length && timingSafeEqual(ab, bb);
  }
}
