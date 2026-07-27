import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { Audit } from '../../common/decorators/audit.decorator';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { DiscountsService } from './discounts.service';
import { CreateDiscountDto, UpdateDiscountDto, ListDiscountsDto } from './dto/discount.dto';

@Controller('discounts')
export class DiscountsController {
  constructor(private readonly discounts: DiscountsService) {}

  @RequirePermissions('discounts.read')
  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: ListDiscountsDto, @Query('storeId') storeId?: string) {
    return this.discounts.list(this.storeId(user, storeId), query);
  }

  @RequirePermissions('discounts.read')
  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string, @Query('storeId') storeId?: string) {
    return this.discounts.get(this.storeId(user, storeId), id);
  }

  @RequirePermissions('discounts.create')
  @Audit('discounts.create', 'discount')
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateDiscountDto, @Query('storeId') storeId?: string) {
    return this.discounts.create(this.storeId(user, storeId), dto);
  }

  @RequirePermissions('discounts.update')
  @Audit('discounts.update', 'discount')
  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateDiscountDto, @Query('storeId') storeId?: string) {
    return this.discounts.update(this.storeId(user, storeId), id, dto);
  }

  @RequirePermissions('discounts.delete')
  @Audit('discounts.delete', 'discount')
  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string, @Query('storeId') storeId?: string) {
    return this.discounts.remove(this.storeId(user, storeId), id);
  }

  private storeId(user: AuthUser, storeId?: string): string {
    const id = user.role === 'SUPER_ADMIN' ? storeId : user.storeId;
    if (!id) throw new BadRequestException('storeId is required');
    return id;
  }
}
