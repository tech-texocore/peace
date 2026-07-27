import { Controller, Get } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { PaymentsService } from './payments.service';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  // Storefront checkout reads this to decide whether to show online payment.
  @Public()
  @Get('config')
  config() {
    return this.payments.config();
  }
}
