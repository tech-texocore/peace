import { BadRequestException, Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { Audit } from '../../common/decorators/audit.decorator';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { SiteConfigService } from './site-config.service';
import { UpdateDraftDto } from './dto/update-draft.dto';

@Controller('site-config')
export class SiteConfigController {
  constructor(private readonly config: SiteConfigService) {}

  // Storefront reads the published config for a store (no auth).
  @Public()
  @Get('published/:slug')
  getPublished(@Param('slug') slug: string) {
    return this.config.getPublished(slug);
  }

  @RequirePermissions('config.read')
  @Get()
  get(@CurrentUser() user: AuthUser, @Query('storeId') storeId?: string) {
    return this.config.getForStore(this.resolveStoreId(user, storeId));
  }

  @RequirePermissions('config.update')
  @Put('draft')
  saveDraft(@CurrentUser() user: AuthUser, @Body() dto: UpdateDraftDto, @Query('storeId') storeId?: string) {
    return this.config.saveDraft(this.resolveStoreId(user, storeId), dto.draft);
  }

  @RequirePermissions('config.publish')
  @Audit('config.publish', 'config')
  @Post('publish')
  publish(@CurrentUser() user: AuthUser, @Query('storeId') storeId?: string) {
    return this.config.publish(this.resolveStoreId(user, storeId));
  }

  // Admins act only on their own store; Super Admin may target one via ?storeId=.
  private resolveStoreId(user: AuthUser, storeId?: string): string {
    const id = user.role === 'SUPER_ADMIN' ? storeId : user.storeId;
    if (!id) throw new BadRequestException('storeId is required');
    return id;
  }
}
