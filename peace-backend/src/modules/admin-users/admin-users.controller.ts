import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { AdminUsersService } from './admin-users.service';
import { CreateAdminDto } from './dto/create-admin.dto';
import { UpdateAdminDto } from './dto/update-admin.dto';

@Controller('admin-users')
export class AdminUsersController {
  constructor(private readonly adminUsers: AdminUsersService) {}

  @Roles('SUPER_ADMIN', 'ADMIN', 'STAFF')
  @Get('me')
  me(@CurrentUser('uid') uid: string) {
    return this.adminUsers.findByUid(uid);
  }

  @RequirePermissions('admins.read')
  @Get()
  findAll(@CurrentUser() caller: AuthUser) {
    return this.adminUsers.findAll(caller);
  }

  @RequirePermissions('admins.create')
  @Post()
  create(@CurrentUser() caller: AuthUser, @Body() dto: CreateAdminDto) {
    return this.adminUsers.createAdmin(dto, caller);
  }

  @RequirePermissions('admins.update')
  @Patch(':id')
  update(@CurrentUser() caller: AuthUser, @Param('id') id: string, @Body() dto: UpdateAdminDto) {
    return this.adminUsers.update(id, dto, caller);
  }

  @RequirePermissions('admins.delete')
  @Delete(':id')
  remove(@CurrentUser() caller: AuthUser, @Param('id') id: string) {
    return this.adminUsers.remove(id, caller);
  }
}
