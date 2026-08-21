import { Injectable } from '@nestjs/common';
import { BharatShipProvider } from './bharatship.provider';
import type { ShipmentInput, ShipmentResult, TrackingResult } from './shipping.types';

@Injectable()
export class ShippingService {
  constructor(private readonly provider: BharatShipProvider) {}

  get configured() { return this.provider.configured; }
  get providerName() { return this.provider.name; }

  createShipment(input: ShipmentInput): Promise<ShipmentResult> {
    return this.provider.createShipment(input);
  }

  createReverseShipment(input: ShipmentInput): Promise<ShipmentResult> {
    return this.provider.createReverseShipment(input);
  }

  track(awb: string): Promise<TrackingResult> {
    return this.provider.track(awb);
  }

  cancel(awb: string): Promise<void> {
    return this.provider.cancel(awb);
  }
}
