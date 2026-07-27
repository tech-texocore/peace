import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { WishlistService } from './wishlist.service';

// Wishlist requires authentication.
@Controller('wishlist')
export class WishlistController {
  constructor(private readonly wishlist: WishlistService) {}

  @Get()
  get(@CurrentUser('uid') uid: string) {
    return this.wishlist.get(uid);
  }

  @Post('items')
  add(@CurrentUser('uid') uid: string, @Body() body: { productId: string }) {
    return this.wishlist.add(uid, body.productId);
  }

  @Delete('items/:productId')
  remove(@CurrentUser('uid') uid: string, @Param('productId') productId: string) {
    return this.wishlist.remove(uid, productId);
  }

  // Guest → account merge on sign-in.
  @Post('merge')
  merge(@CurrentUser('uid') uid: string, @Body() body: { productIds?: string[] }) {
    return this.wishlist.merge(uid, body.productIds ?? []);
  }
}
