import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { Audit } from '../../common/decorators/audit.decorator';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { CustomerGroupsService } from './customer-groups.service';
import { CreateCustomerGroupDto, UpdateCustomerGroupDto, ListCustomerGroupsDto } from './dto/customer-group.dto';

@Controller('customer-groups')
export class CustomerGroupsController {
  constructor(private readonly groups: CustomerGroupsService) {}

  @RequirePermissions('customergroups.read')
  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: ListCustomerGroupsDto, @Query('storeId') storeId?: string) {
    return this.groups.list(this.storeId(user, storeId), query);
  }

  @RequirePermissions('customergroups.read')
  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string, @Query('storeId') storeId?: string) {
    return this.groups.get(this.storeId(user, storeId), id);
  }

  @RequirePermissions('customergroups.create')
  @Audit('customergroups.create', 'customerGroup')
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateCustomerGroupDto, @Query('storeId') storeId?: string) {
    return this.groups.create(this.storeId(user, storeId), dto);
  }

  @RequirePermissions('customergroups.update')
  @Audit('customergroups.update', 'customerGroup')
  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateCustomerGroupDto, @Query('storeId') storeId?: string) {
    return this.groups.update(this.storeId(user, storeId), id, dto);
  }

  @RequirePermissions('customergroups.delete')
  @Audit('customergroups.delete', 'customerGroup')
  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string, @Query('storeId') storeId?: string) {
    return this.groups.remove(this.storeId(user, storeId), id);
  }

  private storeId(user: AuthUser, storeId?: string): string {
    const id = user.role === 'SUPER_ADMIN' ? storeId : user.storeId;
    if (!id) throw new BadRequestException('storeId is required');
    return id;
  }
}
