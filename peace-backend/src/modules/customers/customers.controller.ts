import { BadRequestException, Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { Audit } from '../../common/decorators/audit.decorator';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { CustomersService } from './customers.service';

@Controller('customers')
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @RequirePermissions('customers.read')
  @Get()
  list(@CurrentUser() user: AuthUser, @Query('search') search?: string, @Query('page') page?: string, @Query('limit') limit?: string, @Query('state') state?: string, @Query('groupId') groupId?: string, @Query('storeId') storeId?: string) {
    return this.customers.list(this.resolveStoreId(user, storeId), { search, page: page ? +page : undefined, limit: limit ? +limit : undefined, state, groupId });
  }

  @RequirePermissions('customers.read')
  @Get(':id')
  detail(@CurrentUser() user: AuthUser, @Param('id') id: string, @Query('storeId') storeId?: string) {
    return this.customers.detail(this.resolveStoreId(user, storeId), id);
  }

  @RequirePermissions('customers.update')
  @Audit('customers.assign-group', 'customer')
  @Patch(':id/group')
  assignGroup(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: { customerGroupId: string | null }, @Query('storeId') storeId?: string) {
    return this.customers.assignGroup(this.resolveStoreId(user, storeId), id, body.customerGroupId ?? null);
  }

  private resolveStoreId(user: AuthUser, storeId?: string): string {
    const id = user.role === 'SUPER_ADMIN' ? storeId : user.storeId;
    if (!id) throw new BadRequestException('storeId is required');
    return id;
  }
}
