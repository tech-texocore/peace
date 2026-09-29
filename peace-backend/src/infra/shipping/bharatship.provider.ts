import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { IntegrationsService } from '../integrations/integrations.service';
import type { ShipmentInput, ShipmentResult, TrackingResult } from './shipping.types';

// BharatShip (app.bharatship.com) courier aggregator — REST + Bearer token.
// API reference: https://documenter.getpostman.com/view/50218431/2sB3dHWDP6
// Auth: POST /api/authToken {email,password} -> { token }. Token cached until near expiry.
// Keys come from admin → Integrations; a save there takes effect immediately.
type BookingResponse = { waybill?: string; order_id?: number; message?: string; courierName?: string };
type TrackingScan = { shipment_status?: number; status_title?: string; tracking_date?: string; location?: string | null; log_desc?: string | null };

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
  private get shippingMode() { return this.s.shippingMode || 'surface'; }
  // Parcel size in cm as "length x width x height" (default fits a folded garment).
  private get parcel() {
    const [length, width, height] = (this.s.parcelSizeCm || '25x20x3').split(/\s*x\s*/i);
    return { length, width, height };
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

  // courier_ship_type 1 books the configured courier; 2 lets BharatShip pick by the account's courier priority.
  private courierSelection() {
    return this.courierCode ? { courier_ship_type: 1, courier_code: this.courierCode } : { courier_ship_type: 2 };
  }

  // BharatShip takes weight in kilograms; the admin setting is in grams.
  private weightKg(input: ShipmentInput) {
    return String((input.weightGrams ?? this.defaultWeightGrams) / 1000);
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
      express: this.shippingMode,
      ...this.courierSelection(),
      callback_url: '',
    };
  }

  async createShipment(input: ShipmentInput): Promise<ShipmentResult> {
    const payload = {
      ...this.orderPayload(input),
      payment_mode: input.paymentMode,
      consignee_emailid: input.recipient.email ?? '',
      weight: [this.weightKg(input)],
      length: [this.parcel.length],
      width: [this.parcel.width],
      height: [this.parcel.height],
      no_box: ['1'],
    };
    const r = await this.call<BookingResponse>('/api/v1/create-order', payload);
    if (!r.waybill) throw new BadRequestException(r.message ?? 'Courier did not return a tracking number.');
    return { awb: r.waybill, courierName: r.courierName ?? this.courierFromMessage(r.message), providerOrderId: r.order_id ?? null };
  }

  async createReverseShipment(input: ShipmentInput): Promise<ShipmentResult> {
    const payload = {
      ...this.orderPayload(input),
      weight: this.weightKg(input),
      ...this.parcel,
    };
    const r = await this.call<BookingResponse>('/api/v1/create-reverse-order', payload);
    if (!r.waybill) throw new BadRequestException(r.message ?? 'Courier did not return a reverse tracking number.');
    return { awb: r.waybill, courierName: r.courierName ?? this.courierFromMessage(r.message), providerOrderId: r.order_id ?? null };
  }

  async track(awb: string): Promise<TrackingResult> {
    const r = await this.call<{ data?: { summary?: { shipment_status?: number }; history?: TrackingScan[] } }>('/api/v1/tracking-order', { awb });
    const history = Array.isArray(r.data?.history) ? r.data.history : [];
    const events = history.map((h) => ({ status: h.status_title ?? '', location: h.location ?? h.log_desc ?? null, time: h.tracking_date ?? null }));
    const code = r.data?.summary?.shipment_status ?? history[0]?.shipment_status ?? null;
    return { awb, code, status: history[0]?.status_title ?? (code != null ? `Status ${code}` : 'Awaiting courier update'), courierName: null, events };
  }

  async cancel(awb: string): Promise<void> {
    await this.call('/api/v1/cancel-order', { awb });
  }

  async courierList(): Promise<{ code: string; name: string }[]> {
    const r = await this.call<{ data?: { courier_code?: string; courier_name?: string }[] }>('/api/v1/courier-list', undefined, 'GET');
    return (r.data ?? []).filter((c) => c.courier_code).map((c) => ({ code: c.courier_code!, name: c.courier_name ?? c.courier_code! }));
  }

  private courierFromMessage(message?: string): string | null {
    if (!message) return null;
    const m = message.match(/by\s+(.+)$/i);
    return m ? m[1].trim() : null;
  }
}
