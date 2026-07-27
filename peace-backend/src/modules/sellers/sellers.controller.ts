import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { Audit } from '../../common/decorators/audit.decorator';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { SellersService } from './sellers.service';
import { CreateSellerDto } from './dto/create-seller.dto';
import { UpdateSellerDto } from './dto/update-seller.dto';
import { ListSellersDto } from './dto/list-sellers.dto';

@Controller('sellers')
export class SellersController {
  constructor(private readonly sellers: SellersService) {}

  @RequirePermissions('sellers.read')
  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: ListSellersDto, @Query('storeId') storeId?: string) {
    return this.sellers.list(this.resolveStoreId(user, storeId), query);
  }

  @RequirePermissions('sellers.read')
  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string, @Query('storeId') storeId?: string) {
    return this.sellers.get(this.resolveStoreId(user, storeId), id);
  }

  @RequirePermissions('sellers.create')
  @Audit('sellers.create', 'seller')
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateSellerDto, @Query('storeId') storeId?: string) {
    return this.sellers.create(this.resolveStoreId(user, storeId), dto);
  }

  @RequirePermissions('sellers.update')
  @Audit('sellers.update', 'seller')
  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateSellerDto, @Query('storeId') storeId?: string) {
    return this.sellers.update(this.resolveStoreId(user, storeId), id, dto);
  }

  @RequirePermissions('sellers.delete')
  @Audit('sellers.delete', 'seller')
  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string, @Query('storeId') storeId?: string) {
    return this.sellers.remove(this.resolveStoreId(user, storeId), id);
  }

  private resolveStoreId(user: AuthUser, storeId?: string): string {
    const id = user.role === 'SUPER_ADMIN' ? storeId : user.storeId;
    if (!id) throw new BadRequestException('storeId is required');
    return id;
  }
}
