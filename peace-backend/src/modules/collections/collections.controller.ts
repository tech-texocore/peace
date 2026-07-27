import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { Audit } from '../../common/decorators/audit.decorator';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { CollectionsService } from './collections.service';
import { CreateCollectionDto, UpdateCollectionDto, ListCollectionsDto, SetProductsDto } from './dto/collection.dto';

@Controller('collections')
export class CollectionsController {
  constructor(private readonly collections: CollectionsService) {}

  @RequirePermissions('collections.read')
  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: ListCollectionsDto, @Query('storeId') storeId?: string) {
    return this.collections.list(this.storeId(user, storeId), query);
  }

  @RequirePermissions('collections.read')
  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string, @Query('storeId') storeId?: string) {
    return this.collections.get(this.storeId(user, storeId), id);
  }

  @RequirePermissions('collections.create')
  @Audit('collections.create', 'collection')
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateCollectionDto, @Query('storeId') storeId?: string) {
    return this.collections.create(this.storeId(user, storeId), dto);
  }

  @RequirePermissions('collections.update')
  @Audit('collections.update', 'collection')
  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateCollectionDto, @Query('storeId') storeId?: string) {
    return this.collections.update(this.storeId(user, storeId), id, dto);
  }

  @RequirePermissions('collections.update')
  @Audit('collections.setProducts', 'collection')
  @Post(':id/products')
  setProducts(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: SetProductsDto, @Query('storeId') storeId?: string) {
    return this.collections.setProducts(this.storeId(user, storeId), id, dto.productIds);
  }

  @RequirePermissions('collections.delete')
  @Audit('collections.delete', 'collection')
  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string, @Query('storeId') storeId?: string) {
    return this.collections.remove(this.storeId(user, storeId), id);
  }

  private storeId(user: AuthUser, storeId?: string): string {
    const id = user.role === 'SUPER_ADMIN' ? storeId : user.storeId;
    if (!id) throw new BadRequestException('storeId is required');
    return id;
  }
}
