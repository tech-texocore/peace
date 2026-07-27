import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { FirebaseService } from '../../infra/firebase/firebase.service';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { CreateAdminDto } from './dto/create-admin.dto';
import { UpdateAdminDto } from './dto/update-admin.dto';

@Injectable()
export class AdminUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly firebase: FirebaseService,
  ) {}

  // Creates the Firebase user, sets role claims, and stores the record.
  // `caller` is trusted for authorisation; a non-super caller is confined to
  // their own store and cannot mint super admins.
  async createAdmin(dto: CreateAdminDto, caller?: AuthUser) {
    if (!this.firebase.isEnabled()) {
      throw new BadRequestException('Firebase is not configured on the server');
    }

    const isSuper = caller?.role === 'SUPER_ADMIN';

    if (dto.role === 'SUPER_ADMIN' && caller && !isSuper) {
      throw new ForbiddenException('Only a super admin can create super admins');
    }

    // Non-super callers may only create admins within their own store.
    const storeId = caller && !isSuper ? caller.storeId : dto.storeId;
    if (caller && !isSuper && !storeId) {
      throw new ForbiddenException('No store context for this operation');
    }

    if (dto.roleId) {
      const role = await this.prisma.accessRole.findUnique({ where: { id: dto.roleId } });
      if (!role) throw new BadRequestException('Assigned role not found');
      if (role.storeId && storeId && role.storeId !== storeId) {
        throw new ForbiddenException('Role belongs to a different store');
      }
    }

    const existing = await this.firebase.getUserByEmail(dto.email);
    const user = existing ?? (await this.firebase.createUser(dto.email, dto.password, dto.name));

    await this.firebase.setRoleClaims(user.uid, {
      role: dto.role,
      storeId: storeId ?? null,
    });

    return this.prisma.adminUser.upsert({
      where: { firebaseUid: user.uid },
      create: {
        firebaseUid: user.uid,
        email: dto.email,
        name: dto.name,
        role: dto.role,
        storeId,
        roleId: dto.roleId,
      },
      update: { role: dto.role, storeId, roleId: dto.roleId, name: dto.name },
    });
  }

  findByUid(firebaseUid: string) {
    return this.prisma.adminUser.findUnique({
      where: { firebaseUid },
      include: { store: true, roleRef: true },
    });
  }

  findAll(caller?: AuthUser) {
    const where = caller && caller.role !== 'SUPER_ADMIN' ? { storeId: caller.storeId } : {};
    return this.prisma.adminUser.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { store: true, roleRef: true },
    });
  }

  private async loadManageable(id: string, caller?: AuthUser) {
    const admin = await this.prisma.adminUser.findUnique({ where: { id } });
    if (!admin) throw new NotFoundException('Admin not found');
    const isSuper = caller?.role === 'SUPER_ADMIN';
    if (admin.role === 'SUPER_ADMIN' && !isSuper) {
      throw new ForbiddenException('Cannot manage a super admin');
    }
    if (caller && !isSuper && admin.storeId !== caller.storeId) {
      throw new ForbiddenException('Admin belongs to a different store');
    }
    return admin;
  }

  async update(id: string, dto: UpdateAdminDto, caller?: AuthUser) {
    const admin = await this.loadManageable(id, caller);
    const isSuper = caller?.role === 'SUPER_ADMIN';
    const storeId = isSuper ? (dto.storeId ?? admin.storeId) : admin.storeId;

    if (dto.roleId) {
      const role = await this.prisma.accessRole.findUnique({ where: { id: dto.roleId } });
      if (!role) throw new BadRequestException('Assigned role not found');
      if (role.storeId && storeId && role.storeId !== storeId) {
        throw new ForbiddenException('Role belongs to a different store');
      }
    }

    if (this.firebase.isEnabled()) {
      await this.firebase.setRoleClaims(admin.firebaseUid, { role: admin.role, storeId: storeId ?? null });
      if (dto.isActive !== undefined) await this.firebase.setDisabled(admin.firebaseUid, !dto.isActive);
    }

    return this.prisma.adminUser.update({
      where: { id },
      data: {
        name: dto.name ?? admin.name,
        roleId: dto.roleId ?? admin.roleId,
        storeId,
        isActive: dto.isActive ?? admin.isActive,
      },
      include: { store: true, roleRef: true },
    });
  }

  async remove(id: string, caller?: AuthUser) {
    const admin = await this.loadManageable(id, caller);
    if (this.firebase.isEnabled()) {
      await this.firebase.setDisabled(admin.firebaseUid, true).catch(() => undefined);
    }
    return this.prisma.adminUser.delete({ where: { id } });
  }
}
