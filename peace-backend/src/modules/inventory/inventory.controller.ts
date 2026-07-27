import { BadRequestException, Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { Audit } from '../../common/decorators/audit.decorator';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { InventoryService } from './inventory.service';

@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  // Storefront: "notify me when back in stock" (public).
  @Public()
  @Post('notify-me')
  notifyMe(@Body() body: { variantId: string; email: string }) {
    if (!body?.variantId || !/.+@.+\..+/.test(body?.email ?? '')) throw new BadRequestException('Valid email and product required');
    return this.inventory.subscribe(body.variantId, body.email);
  }

  @RequirePermissions('inventory.read')
  @Get()
  list(@CurrentUser() user: AuthUser, @Query('search') search?: string, @Query('page') page?: string, @Query('limit') limit?: string, @Query('lowOnly') lowOnly?: string, @Query('categoryId') categoryId?: string, @Query('stockStatus') stockStatus?: 'in' | 'low' | 'out', @Query('storeId') storeId?: string) {
    return this.inventory.list(this.resolveStoreId(user, storeId), { search, page: page ? +page : undefined, limit: limit ? +limit : undefined, lowOnly: lowOnly === 'true', categoryId, stockStatus });
  }

  @RequirePermissions('inventory.read')
  @Get(':variantId/movements')
  movements(@CurrentUser() user: AuthUser, @Param('variantId') variantId: string, @Query('storeId') storeId?: string) {
    return this.inventory.movements(this.resolveStoreId(user, storeId), variantId);
  }

  @RequirePermissions('inventory.update')
  @Audit('inventory.adjust', 'variant')
  @Post(':variantId/adjust')
  adjust(@CurrentUser() user: AuthUser, @Param('variantId') variantId: string, @Body() body: { delta: number; reason: string; note?: string }, @Query('storeId') storeId?: string) {
    return this.inventory.adjust(this.resolveStoreId(user, storeId), variantId, Number(body.delta), body.reason, body.note, user.email ?? user.uid);
  }

  private resolveStoreId(user: AuthUser, storeId?: string): string {
    const id = user.role === 'SUPER_ADMIN' ? storeId : user.storeId;
    if (!id) throw new BadRequestException('storeId is required');
    return id;
  }
}
