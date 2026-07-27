import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { ALL_PERMISSION_KEYS } from './permissions.catalog';
import { CreateRoleDto, UpdateRoleDto } from './dto/role.dto';

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  private sanitize(permissions: string[]): string[] {
    const valid = permissions.filter((p) => ALL_PERMISSION_KEYS.includes(p));
    if (valid.length === 0) throw new BadRequestException('No valid permissions provided');
    return [...new Set(valid)];
  }

  // scopeStoreId: null = super admin (unrestricted); a string confines the
  // caller to that store's roles.
  list(scopeStoreId: string | null, queryStoreId?: string) {
    const storeId = scopeStoreId ?? queryStoreId;
    return this.prisma.accessRole.findMany({
      where: storeId ? { storeId } : {},
      orderBy: { createdAt: 'asc' },
    });
  }

  create(dto: CreateRoleDto, scopeStoreId: string | null) {
    return this.prisma.accessRole.create({
      data: {
        storeId: scopeStoreId ?? dto.storeId ?? null,
        key: dto.key,
        name: dto.name,
        permissions: this.sanitize(dto.permissions),
      },
    });
  }

  private async loadOwned(id: string, scopeStoreId: string | null) {
    const role = await this.prisma.accessRole.findUnique({ where: { id }, include: { admins: true } });
    if (!role) throw new NotFoundException('Role not found');
    if (scopeStoreId !== null && role.storeId !== scopeStoreId) {
      throw new ForbiddenException('Role belongs to a different store');
    }
    return role;
  }

  async update(id: string, dto: UpdateRoleDto, scopeStoreId: string | null) {
    const role = await this.loadOwned(id, scopeStoreId);
    return this.prisma.accessRole.update({
      where: { id },
      data: {
        name: dto.name ?? role.name,
        permissions: dto.permissions ? this.sanitize(dto.permissions) : role.permissions,
      },
    });
  }

  async remove(id: string, scopeStoreId: string | null) {
    const role = await this.loadOwned(id, scopeStoreId);
    if (role.isSystem) throw new ForbiddenException('System roles cannot be deleted');
    if (role.admins.length > 0) throw new BadRequestException('Role is assigned to admins');
    return this.prisma.accessRole.delete({ where: { id } });
  }
}
