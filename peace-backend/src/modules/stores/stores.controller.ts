import { BadRequestException, Body, Controller, Get, Post, Put, Query } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { StoresService } from './stores.service';
import { CreateStoreDto } from './dto/create-store.dto';
import { UpdateIntegrationsDto, UpdateSettingsDto } from './dto/store-settings.dto';

@Controller('stores')
export class StoresController {
  constructor(private readonly stores: StoresService) {}

  @Roles('SUPER_ADMIN')
  @Post()
  create(@Body() dto: CreateStoreDto) {
    return this.stores.create(dto);
  }

  @Roles('SUPER_ADMIN')
  @Get()
  findAll() {
    return this.stores.findAll();
  }

  @RequirePermissions('settings.read')
  @Get('settings')
  getSettings(@CurrentUser() user: AuthUser, @Query('storeId') storeId?: string) {
    return this.stores.getSettings(this.resolveStoreId(user, storeId));
  }

  @RequirePermissions('settings.update')
  @Put('settings')
  updateSettings(@CurrentUser() user: AuthUser, @Body() dto: UpdateSettingsDto, @Query('storeId') storeId?: string) {
    return this.stores.updateSettings(this.resolveStoreId(user, storeId), dto.settings);
  }

  @RequirePermissions('integrations.read')
  @Get('integrations')
  getIntegrations(@CurrentUser() user: AuthUser, @Query('storeId') storeId?: string) {
    return this.stores.getIntegrations(this.resolveStoreId(user, storeId));
  }

  @RequirePermissions('integrations.update')
  @Put('integrations')
  updateIntegrations(@CurrentUser() user: AuthUser, @Body() dto: UpdateIntegrationsDto, @Query('storeId') storeId?: string) {
    return this.stores.updateIntegrations(this.resolveStoreId(user, storeId), dto.integrations);
  }

  private resolveStoreId(user: AuthUser, storeId?: string): string {
    const id = user.role === 'SUPER_ADMIN' ? storeId : user.storeId;
    if (!id) throw new BadRequestException('storeId is required');
    return id;
  }
}
