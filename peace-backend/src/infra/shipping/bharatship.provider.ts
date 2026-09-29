import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { IntegrationsService } from '../integrations/integrations.service';
import type { ShipmentInput, ShipmentResult, TrackingResult } from './shipping.types';

// BharatShip (app.bharatship.com) courier aggregator — REST + Bearer token.
// Auth: POST /api/authToken {email,password} -> { token }. Token cached until near expiry.
// Keys come from admin → Integrations; a save there takes effect immediately.
@Injectable()
export class BharatShipProvider {
  readonly name = 'bharatship';
  private readonly logger = new Logger(BharatShipProvider.name);
  private token: { value: string; expiresAt: number } | null = null;

  constructor(private readonly integrations: IntegrationsService) {
    integrations.onChange(() => (this.token = null));
  }

  private get s() { return this.integrations.current.bharatship; }
  private get email() { return this.s.email; }
  private get password() { return this.s.password; }
  private get apiBase() { return (this.s.apiBase || 'https://app.bharatship.com').replace(/\/$/, ''); }
  private get pickupAddressId() { return this.s.pickupAddressId; }
  private get defaultWeightGrams() { return Number(this.s.defaultWeightGrams) || 500; }
  private get courierCode() { return this.s.courierCode || undefined; }

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
      this.logger.warn(`BharatShip ${path} failed (${res.status}): ${JSON.stringify(json).slice(0, 2000)}`);
      throw new BadRequestException(this.errorMessage(json, path));
    }
    return json as T;
  }

  // BharatShip validation errors come as { message, errors: { field: [reason] } } — surface the reasons.
  private errorMessage(json: Record<string, unknown>, path: string) {
    const base = typeof json.message === 'string' && json.message ? json.message : `Courier request failed (${path})`;
    const errors = json.errors ?? json.error ?? json.data;
    const details =
      errors && typeof errors === 'object'
        ? Object.entries(errors as Record<string, unknown>)
            .map(([field, reason]) => `${field}: ${Array.isArray(reason) ? reason.join(', ') : String(reason)}`)
            .slice(0, 5)
        : typeof errors === 'string'
          ? [errors]
          : [];
    return details.length ? `${base} — ${details.join('; ')}` : base;
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

  // BharatShip rejects bookings without a courier; it does not pick one itself.
  private requireCourierCode() {
    if (!this.courierCode) {
      throw new BadRequestException('Add your BharatShip courier code in Integrations → BharatShip → Courier code, then try again.');
    }
  }

  async createShipment(input: ShipmentInput): Promise<ShipmentResult> {
    this.requireCourierCode();
    const payload = { ...this.orderPayload(input), payment_mode: input.paymentMode, consignee_emailid: input.recipient.email ?? '' };
    const r = await this.call<{ waybill?: string; order_id?: number; message?: string }>('/api/v1/create-order', payload);
    if (!r.waybill) throw new BadRequestException(r.message ?? 'Courier did not return a tracking number.');
    return { awb: r.waybill, courierName: this.courierFromMessage(r.message), providerOrderId: r.order_id ?? null };
  }

  async createReverseShipment(input: ShipmentInput): Promise<ShipmentResult> {
    this.requireCourierCode();
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
    return { awb, status: String(r.current_status ?? events[0]?.status ?? 'Awaiting courier update'), courierName: (r.courier_name as string) ?? null, events };
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
