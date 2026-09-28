import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { RazorpayProvider } from './providers/razorpay.provider';
import { PAYMENT_PROVIDER } from './payment-provider.interface';

@Module({
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    RazorpayProvider,
    { provide: PAYMENT_PROVIDER, useExisting: RazorpayProvider },
  ],
  exports: [PaymentsService],
})
export class PaymentsModule {}
