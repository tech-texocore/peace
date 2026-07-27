import { BadRequestException, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { Audit } from '../../common/decorators/audit.decorator';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { SubscriptionsService } from './subscriptions.service';

@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subs: SubscriptionsService) {}

  @RequirePermissions('subscriptions.read')
  @Get('newsletter')
  newsletter(@CurrentUser() user: AuthUser, @Query('search') search?: string, @Query('page') page?: string, @Query('limit') limit?: string, @Query('storeId') storeId?: string) {
    return this.subs.newsletter(this.resolveStoreId(user, storeId), { search, page: page ? +page : undefined, limit: limit ? +limit : undefined });
  }

  @RequirePermissions('subscriptions.read')
  @Get('back-in-stock')
  backInStock(@CurrentUser() user: AuthUser, @Query('search') search?: string, @Query('pending') pending?: string, @Query('page') page?: string, @Query('limit') limit?: string, @Query('storeId') storeId?: string) {
    return this.subs.backInStock(this.resolveStoreId(user, storeId), { search, pending: pending === 'true', page: page ? +page : undefined, limit: limit ? +limit : undefined });
  }

  @RequirePermissions('subscriptions.read')
  @Audit('subscriptions.notify', 'back-in-stock')
  @Post('back-in-stock/notify-all')
  notifyAll(@CurrentUser() user: AuthUser, @Query('storeId') storeId?: string) {
    return this.subs.notifyAllInStock(this.resolveStoreId(user, storeId));
  }

  @RequirePermissions('subscriptions.read')
  @Audit('subscriptions.notify', 'back-in-stock')
  @Post('back-in-stock/:id/notify')
  notify(@CurrentUser() user: AuthUser, @Param('id') id: string, @Query('storeId') storeId?: string) {
    return this.subs.notifyOne(this.resolveStoreId(user, storeId), id);
  }

  private resolveStoreId(user: AuthUser, storeId?: string): string {
    const id = user.role === 'SUPER_ADMIN' ? storeId : user.storeId;
    if (!id) throw new BadRequestException('storeId is required');
    return id;
  }
}
