import { Global, Module } from '@nestjs/common';
import { BharatShipProvider } from './bharatship.provider';
import { ShippingService } from './shipping.service';

@Global()
@Module({
  providers: [BharatShipProvider, ShippingService],
  exports: [ShippingService],
})
export class ShippingModule {}
