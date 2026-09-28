import { BadRequestException, Injectable } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { IntegrationsService } from '../../../infra/integrations/integrations.service';
import type { PaymentProvider, ProviderOrder } from '../payment-provider.interface';

// Razorpay via REST + HMAC only — no SDK dependency. Keys come from admin →
// Integrations: test keys for sandbox, live keys for real payments.
@Injectable()
export class RazorpayProvider implements PaymentProvider {
  readonly name = 'razorpay';

  constructor(private readonly integrations: IntegrationsService) {}

  private get keyId() { return this.integrations.current.razorpay.keyId; }
  private get keySecret() { return this.integrations.current.razorpay.keySecret; }
  private get webhookSecret() { return this.integrations.current.razorpay.webhookSecret; }

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
    if (!res.ok || !body.id) throw new BadRequestException(body.error?.description ? `Refund declined by Razorpay: ${body.error.description} (a new account may need KYC activation + settled balance).` : 'Refund could not be processed at the gateway.');
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
