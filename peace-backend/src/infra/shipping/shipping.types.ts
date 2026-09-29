export interface ShipmentItem {
  sku: string;
  name: string;
  hsn: string;
  price: number;
  quantity: number;
  taxPercent: number;
}

export interface ShipmentInput {
  orderNumber: string;
  paymentMode: 'PPD' | 'COD'; // prepaid vs cash-on-delivery
  codAmount: number;
  totalAmount: number;
  recipient: { name: string; phone: string; email?: string | null; address: string; pincode: string };
  items: ShipmentItem[];
  weightGrams?: number;
}

export interface ShipmentResult {
  awb: string;
  courierName: string | null;
  providerOrderId: string | number | null;
}

export interface TrackingEvent {
  status: string;
  location?: string | null;
  time?: string | null;
}

export interface TrackingResult {
  awb: string;
  // BharatShip shipment_status code (5 = Delivered, 7 = RTO, …); null when unknown.
  code?: number | null;
  status: string;
  courierName?: string | null;
  events: TrackingEvent[];
}
