import { Body, Controller, Get, Post, Put } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CartService } from './cart.service';

interface CartLineInput { variantId: string; quantity: number; customization?: Record<string, unknown> }

// Cart requires authentication — persists a signed-in shopper's cart across devices.
@Controller('cart')
export class CartController {
  constructor(private readonly cart: CartService) {}

  @Get()
  get(@CurrentUser('uid') uid: string) {
    return this.cart.get(uid);
  }

  @Post('merge')
  merge(@CurrentUser('uid') uid: string, @Body() body: { items?: CartLineInput[] }) {
    return this.cart.merge(uid, body.items ?? []);
  }

  @Put()
  replace(@CurrentUser('uid') uid: string, @Body() body: { items?: CartLineInput[] }) {
    return this.cart.replace(uid, body.items ?? []);
  }
}
