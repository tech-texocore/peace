import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { RazorpayProvider } from './providers/razorpay.provider';
import { PAYMENT_PROVIDER } from './payment-provider.interface';

@Module({
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    RazorpayProvider,
    {
      provide: PAYMENT_PROVIDER,
      inject: [ConfigService, RazorpayProvider],
      useFactory: (config: ConfigService, razorpay: RazorpayProvider) => {
        const provider = config.get<string>('integrations.payments.provider') ?? 'razorpay';
        if (provider === 'razorpay') return razorpay;
        throw new Error(`Unsupported PAYMENTS_PROVIDER "${provider}". Only 'razorpay' is configured.`);
      },
    },
  ],
  exports: [PaymentsService],
})
export class PaymentsModule {}
