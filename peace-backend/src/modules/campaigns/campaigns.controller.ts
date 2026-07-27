import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { Audit } from '../../common/decorators/audit.decorator';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { CampaignsService } from './campaigns.service';
import { AudienceCountDto, UpsertCampaignDto } from './dto/campaign.dto';

@Controller('campaigns')
export class CampaignsController {
  constructor(private readonly campaigns: CampaignsService) {}

  @RequirePermissions('campaigns.read')
  @Get()
  list(@CurrentUser() user: AuthUser, @Query('storeId') storeId?: string) {
    return this.campaigns.list(this.resolveStoreId(user, storeId));
  }

  @RequirePermissions('campaigns.read')
  @Post('audience-count')
  audienceCount(@CurrentUser() user: AuthUser, @Body() body: AudienceCountDto, @Query('storeId') storeId?: string) {
    return this.campaigns.audienceCount(this.resolveStoreId(user, storeId), body);
  }

  @RequirePermissions('campaigns.read')
  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string, @Query('storeId') storeId?: string) {
    return this.campaigns.get(this.resolveStoreId(user, storeId), id);
  }

  @RequirePermissions('campaigns.create')
  @Audit('campaigns.create', 'campaign')
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: UpsertCampaignDto, @Query('storeId') storeId?: string) {
    return this.campaigns.create(this.resolveStoreId(user, storeId), dto);
  }

  @RequirePermissions('campaigns.update')
  @Audit('campaigns.update', 'campaign')
  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpsertCampaignDto, @Query('storeId') storeId?: string) {
    return this.campaigns.update(this.resolveStoreId(user, storeId), id, dto);
  }

  @RequirePermissions('campaigns.update')
  @Audit('campaigns.send', 'campaign')
  @Post(':id/send')
  send(@CurrentUser() user: AuthUser, @Param('id') id: string, @Query('storeId') storeId?: string) {
    return this.campaigns.send(this.resolveStoreId(user, storeId), id);
  }

  @RequirePermissions('campaigns.delete')
  @Audit('campaigns.delete', 'campaign')
  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string, @Query('storeId') storeId?: string) {
    return this.campaigns.remove(this.resolveStoreId(user, storeId), id);
  }

  private resolveStoreId(user: AuthUser, storeId?: string): string {
    const id = user.role === 'SUPER_ADMIN' ? storeId : user.storeId;
    if (!id) throw new BadRequestException('storeId is required');
    return id;
  }
}
