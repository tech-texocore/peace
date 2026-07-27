import { Body, Controller, Delete, ForbiddenException, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { RolesService } from './roles.service';
import { PERMISSION_MODULES } from './permissions.catalog';
import { CreateRoleDto, UpdateRoleDto } from './dto/role.dto';

@Controller('access')
export class AccessController {
  constructor(private readonly roles: RolesService) {}

  // null = super admin (unrestricted); otherwise confined to the caller's store.
  private scope(user: AuthUser): string | null {
    if (user.role === 'SUPER_ADMIN') return null;
    if (!user.storeId) throw new ForbiddenException('No store context');
    return user.storeId;
  }

  @RequirePermissions('roles.read')
  @Get('permissions')
  catalog() {
    return PERMISSION_MODULES;
  }

  @RequirePermissions('roles.read')
  @Get('roles')
  list(@CurrentUser() user: AuthUser, @Query('storeId') storeId?: string) {
    return this.roles.list(this.scope(user), storeId);
  }

  @RequirePermissions('roles.create')
  @Post('roles')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateRoleDto) {
    return this.roles.create(dto, this.scope(user));
  }

  @RequirePermissions('roles.update')
  @Patch('roles/:id')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateRoleDto) {
    return this.roles.update(id, dto, this.scope(user));
  }

  @RequirePermissions('roles.delete')
  @Delete('roles/:id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.roles.remove(id, this.scope(user));
  }
}
