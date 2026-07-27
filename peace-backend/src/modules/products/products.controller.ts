import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { Audit } from '../../common/decorators/audit.decorator';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { ProductsService } from './products.service';
import { CreateProductDto, UpdateProductDto, ListProductsDto } from './dto/product.dto';

@Controller('products')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @RequirePermissions('products.read')
  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: ListProductsDto, @Query('storeId') storeId?: string) {
    return this.products.list(this.storeId(user, storeId), query);
  }

  @RequirePermissions('products.read')
  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string, @Query('storeId') storeId?: string) {
    return this.products.get(this.storeId(user, storeId), id);
  }

  @RequirePermissions('products.create')
  @Audit('products.create', 'product')
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateProductDto, @Query('storeId') storeId?: string) {
    return this.products.create(this.storeId(user, storeId), dto);
  }

  @RequirePermissions('products.update')
  @Audit('products.update', 'product')
  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateProductDto, @Query('storeId') storeId?: string) {
    return this.products.update(this.storeId(user, storeId), id, dto);
  }

  @RequirePermissions('products.delete')
  @Audit('products.delete', 'product')
  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string, @Query('storeId') storeId?: string) {
    return this.products.remove(this.storeId(user, storeId), id);
  }

  private storeId(user: AuthUser, storeId?: string): string {
    const id = user.role === 'SUPER_ADMIN' ? storeId : user.storeId;
    if (!id) throw new BadRequestException('storeId is required');
    return id;
  }
}
