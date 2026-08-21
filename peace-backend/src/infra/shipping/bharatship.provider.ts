import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ShipmentInput, ShipmentResult, TrackingResult } from './shipping.types';

// BharatShip (app.bharatship.com) courier aggregator — REST + Bearer token.
// Auth: POST /api/authToken {email,password} -> { token }. Token cached until near expiry.
// No SDK; goes live the moment the client's BHARATSHIP_EMAIL/PASSWORD are in .env.
@Injectable()
export class BharatShipProvider {
  readonly name = 'bharatship';
  private readonly logger = new Logger(BharatShipProvider.name);
  private readonly email?: string;
  private readonly password?: string;
  private readonly apiBase: string;
  private readonly pickupAddressId?: string;
  private readonly defaultWeightGrams: number;
  private readonly courierCode?: string;
  private token: { value: string; expiresAt: number } | null = null;

  constructor(config: ConfigService) {
    this.email = config.get<string>('integrations.courier.bharatship.email');
    this.password = config.get<string>('integrations.courier.bharatship.password');
    this.apiBase = (config.get<string>('integrations.courier.bharatship.apiBase') ?? 'https://app.bharatship.com').replace(/\/$/, '');
    this.pickupAddressId = config.get<string>('integrations.courier.bharatship.pickupAddressId');
    this.defaultWeightGrams = Number(config.get<string>('integrations.courier.bharatship.defaultWeightGrams')) || 500;
    this.courierCode = config.get<string>('integrations.courier.bharatship.courierCode') || undefined;
  }

  get configured() { return Boolean(this.email && this.password && this.pickupAddressId); }

  private async authToken(): Promise<string> {
    if (this.token && this.token.expiresAt > Date.now() + 60_000) return this.token.value;
    if (!this.email || !this.password) throw new BadRequestException('Courier is not configured.');
    const res = await fetch(`${this.apiBase}/api/authToken`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: this.email, password: this.password }),
    });
    const body = (await res.json().catch(() => ({}))) as { token?: string; message?: string };
    if (!res.ok || !body.token) throw new BadRequestException(body.message ?? 'Courier authentication failed.');
    // JWT — read exp if present, else cache 50 minutes.
    let expiresAt = Date.now() + 50 * 60_000;
    try {
      const payload = JSON.parse(Buffer.from(body.token.split('.')[1], 'base64').toString());
      if (payload.exp) expiresAt = payload.exp * 1000;
    } catch { /* keep default */ }
    this.token = { value: body.token, expiresAt };
    return body.token;
  }

  private async call<T>(path: string, body: unknown, method: 'POST' | 'GET' = 'POST'): Promise<T> {
    const token = await this.authToken();
    const res = await fetch(`${this.apiBase}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      ...(method === 'POST' ? { body: JSON.stringify(body) } : {}),
    });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok || json.status === false || json.status === 'error') {
      throw new BadRequestException((json.message as string) ?? `Courier request failed (${path}).`);
    }
    return json as T;
  }

  private orderPayload(input: ShipmentInput) {
    return {
      client_order_id: input.orderNumber,
      pickup_address_id: this.pickupAddressId,
      return_address_id: 0,
      phone_number: input.recipient.phone,
      full_name: input.recipient.name,
      full_address: input.recipient.address,
      pincode: input.recipient.pincode,
      cod_amount: input.codAmount,
      product_sku: input.items.map((i) => i.sku || ''),
      product_name: input.items.map((i) => i.name),
      product_hsn: input.items.map((i) => i.hsn || ''),
      product_unit_type: input.items.map(() => 'per_unit'),
      product_price: input.items.map((i) => String(i.price)),
      product_quantity: input.items.map((i) => String(i.quantity)),
      product_tax_per: input.items.map((i) => String(i.taxPercent)),
      total_amount: String(input.totalAmount),
      order_amount: String(input.totalAmount),
      invoice_number: input.orderNumber,
      ewaybill_no: null,
      consignee_gst_number: null,
      consigner_gst_number: null,
      appointment: 'no',
      mps: 'no',
      insurance: 0,
      weight: [String(input.weightGrams ?? this.defaultWeightGrams)],
      length: ['25'],
      width: ['20'],
      height: ['3'],
      no_box: ['1'],
      express: 'surface',
      courier_ship_type: 1,
      ...(this.courierCode ? { courier_code: this.courierCode } : {}),
      callback_url: '',
    };
  }

  async createShipment(input: ShipmentInput): Promise<ShipmentResult> {
    const payload = { ...this.orderPayload(input), payment_mode: input.paymentMode, consignee_emailid: input.recipient.email ?? '' };
    const r = await this.call<{ waybill?: string; order_id?: number; message?: string }>('/api/v1/create-order', payload);
    if (!r.waybill) throw new BadRequestException(r.message ?? 'Courier did not return a tracking number.');
    return { awb: r.waybill, courierName: this.courierFromMessage(r.message), providerOrderId: r.order_id ?? null };
  }

  async createReverseShipment(input: ShipmentInput): Promise<ShipmentResult> {
    const payload = this.orderPayload(input);
    const r = await this.call<{ waybill?: string; order_id?: number; message?: string }>('/api/v1/create-reverse-order', payload);
    if (!r.waybill) throw new BadRequestException(r.message ?? 'Courier did not return a reverse tracking number.');
    return { awb: r.waybill, courierName: this.courierFromMessage(r.message), providerOrderId: r.order_id ?? null };
  }

  async track(awb: string): Promise<TrackingResult> {
    const r = await this.call<Record<string, unknown>>('/api/v1/tracking-order', { awb });
    const scans = (r.tracking_data ?? r.scans ?? r.data ?? []) as Array<Record<string, unknown>>;
    const events = (Array.isArray(scans) ? scans : []).map((s) => ({
      status: String(s.status ?? s.activity ?? s.remark ?? ''),
      location: (s.location as string) ?? (s.city as string) ?? null,
      time: (s.date as string) ?? (s.timestamp as string) ?? (s.time as string) ?? null,
    }));
    return { awb, status: String(r.current_status ?? r.status ?? events[0]?.status ?? 'In transit'), courierName: (r.courier_name as string) ?? null, events };
  }

  async cancel(awb: string): Promise<void> {
    await this.call('/api/v1/cancel-order', { awb });
  }

  private courierFromMessage(message?: string): string | null {
    if (!message) return null;
    const m = message.match(/by\s+(.+)$/i);
    return m ? m[1].trim() : null;
  }
}
