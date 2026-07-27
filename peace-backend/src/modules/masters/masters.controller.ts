import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { Audit } from '../../common/decorators/audit.decorator';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { MastersService } from './masters.service';
import { CreateMasterListDto, UpdateMasterListDto, CreateMasterItemDto, UpdateMasterItemDto } from './dto/masters.dto';

@Controller('masters')
export class MastersController {
  constructor(private readonly masters: MastersService) {}

  @RequirePermissions('masters.read')
  @Get()
  listLists(@CurrentUser() user: AuthUser, @Query('storeId') storeId?: string) {
    return this.masters.listLists(this.storeId(user, storeId));
  }

  @RequirePermissions('masters.read')
  @Get(':key')
  getList(@CurrentUser() user: AuthUser, @Param('key') key: string, @Query('storeId') storeId?: string) {
    return this.masters.getList(this.storeId(user, storeId), key);
  }

  @RequirePermissions('masters.create')
  @Audit('masters.seed', 'master')
  @Post('seed')
  seed(@CurrentUser() user: AuthUser, @Query('storeId') storeId?: string) {
    return this.masters.seedDefaults(this.storeId(user, storeId));
  }

  @RequirePermissions('masters.create')
  @Audit('masters.create', 'master')
  @Post()
  createList(@CurrentUser() user: AuthUser, @Body() dto: CreateMasterListDto, @Query('storeId') storeId?: string) {
    return this.masters.createList(this.storeId(user, storeId), dto);
  }

  @RequirePermissions('masters.update')
  @Audit('masters.update', 'master')
  @Patch(':id')
  updateList(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateMasterListDto, @Query('storeId') storeId?: string) {
    return this.masters.updateList(this.storeId(user, storeId), id, dto);
  }

  @RequirePermissions('masters.delete')
  @Audit('masters.delete', 'master')
  @Delete(':id')
  removeList(@CurrentUser() user: AuthUser, @Param('id') id: string, @Query('storeId') storeId?: string) {
    return this.masters.removeList(this.storeId(user, storeId), id);
  }

  @RequirePermissions('masters.create')
  @Audit('masters.item.create', 'master')
  @Post(':listId/items')
  addItem(@CurrentUser() user: AuthUser, @Param('listId') listId: string, @Body() dto: CreateMasterItemDto, @Query('storeId') storeId?: string) {
    return this.masters.addItem(this.storeId(user, storeId), listId, dto);
  }

  @RequirePermissions('masters.update')
  @Audit('masters.item.update', 'master')
  @Patch('items/:id')
  updateItem(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateMasterItemDto, @Query('storeId') storeId?: string) {
    return this.masters.updateItem(this.storeId(user, storeId), id, dto);
  }

  @RequirePermissions('masters.delete')
  @Audit('masters.item.delete', 'master')
  @Delete('items/:id')
  removeItem(@CurrentUser() user: AuthUser, @Param('id') id: string, @Query('storeId') storeId?: string) {
    return this.masters.removeItem(this.storeId(user, storeId), id);
  }

  private storeId(user: AuthUser, storeId?: string): string {
    const id = user.role === 'SUPER_ADMIN' ? storeId : user.storeId;
    if (!id) throw new BadRequestException('storeId is required');
    return id;
  }
}
