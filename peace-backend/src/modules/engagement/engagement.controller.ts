import { BadRequestException, Controller, Post, Query } from '@nestjs/common';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { Audit } from '../../common/decorators/audit.decorator';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { EngagementService } from './engagement.service';

@Controller('engagement')
export class EngagementController {
  constructor(private readonly engagement: EngagementService) {}

  @RequirePermissions('campaigns.update')
  @Audit('engagement.abandoned-cart-scan')
  @Post('abandoned-cart/scan')
  scanAbandonedCarts(@CurrentUser() user: AuthUser, @Query('storeId') storeId?: string) {
    return this.engagement.runAbandonedCartScan(this.resolveStoreId(user, storeId));
  }

  private resolveStoreId(user: AuthUser, storeId?: string): string {
    const id = user.role === 'SUPER_ADMIN' ? storeId : user.storeId;
    if (!id) throw new BadRequestException('storeId is required');
    return id;
  }
}
