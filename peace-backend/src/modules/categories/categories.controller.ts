import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { Audit } from '../../common/decorators/audit.decorator';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto, UpdateCategoryDto, ReorderCategoriesDto } from './dto/category.dto';

@Controller('categories')
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @RequirePermissions('categories.read')
  @Get()
  tree(@CurrentUser() user: AuthUser, @Query('storeId') storeId?: string) {
    return this.categories.tree(this.storeId(user, storeId));
  }

  @RequirePermissions('categories.read')
  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string, @Query('storeId') storeId?: string) {
    return this.categories.get(this.storeId(user, storeId), id);
  }

  @RequirePermissions('categories.create')
  @Audit('categories.create', 'category')
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateCategoryDto, @Query('storeId') storeId?: string) {
    return this.categories.create(this.storeId(user, storeId), dto);
  }

  @RequirePermissions('categories.update')
  @Audit('categories.reorder', 'category')
  @Post('reorder')
  reorder(@CurrentUser() user: AuthUser, @Body() dto: ReorderCategoriesDto, @Query('storeId') storeId?: string) {
    return this.categories.reorder(this.storeId(user, storeId), dto.orderedIds);
  }

  @RequirePermissions('categories.update')
  @Audit('categories.update', 'category')
  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateCategoryDto, @Query('storeId') storeId?: string) {
    return this.categories.update(this.storeId(user, storeId), id, dto);
  }

  @RequirePermissions('categories.delete')
  @Audit('categories.delete', 'category')
  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string, @Query('storeId') storeId?: string) {
    return this.categories.remove(this.storeId(user, storeId), id);
  }

  private storeId(user: AuthUser, storeId?: string): string {
    const id = user.role === 'SUPER_ADMIN' ? storeId : user.storeId;
    if (!id) throw new BadRequestException('storeId is required');
    return id;
  }
}
