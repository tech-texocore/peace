import { Module } from '@nestjs/common';
import { DiscountsController } from './discounts.controller';
import { DiscountsService } from './discounts.service';
import { PricingService } from './pricing.service';

@Module({
  controllers: [DiscountsController],
  providers: [DiscountsService, PricingService],
  exports: [DiscountsService, PricingService],
})
export class DiscountsModule {}
