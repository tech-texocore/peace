import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { Audit } from '../../common/decorators/audit.decorator';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { BrandsService } from './brands.service';
import { CreateBrandDto, UpdateBrandDto, ListBrandsDto } from './dto/brand.dto';

@Controller('brands')
export class BrandsController {
  constructor(private readonly brands: BrandsService) {}

  @RequirePermissions('brands.read')
  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: ListBrandsDto, @Query('storeId') storeId?: string) {
    return this.brands.list(this.storeId(user, storeId), query);
  }

  @RequirePermissions('brands.read')
  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string, @Query('storeId') storeId?: string) {
    return this.brands.get(this.storeId(user, storeId), id);
  }

  @RequirePermissions('brands.create')
  @Audit('brands.create', 'brand')
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateBrandDto, @Query('storeId') storeId?: string) {
    return this.brands.create(this.storeId(user, storeId), dto);
  }

  @RequirePermissions('brands.update')
  @Audit('brands.update', 'brand')
  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateBrandDto, @Query('storeId') storeId?: string) {
    return this.brands.update(this.storeId(user, storeId), id, dto);
  }

  @RequirePermissions('brands.delete')
  @Audit('brands.delete', 'brand')
  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string, @Query('storeId') storeId?: string) {
    return this.brands.remove(this.storeId(user, storeId), id);
  }

  private storeId(user: AuthUser, storeId?: string): string {
    const id = user.role === 'SUPER_ADMIN' ? storeId : user.storeId;
    if (!id) throw new BadRequestException('storeId is required');
    return id;
  }
}
