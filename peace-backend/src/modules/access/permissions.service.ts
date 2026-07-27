import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { WILDCARD } from './permissions.catalog';

@Injectable()
export class PermissionsService {
  constructor(private readonly prisma: PrismaService) {}

  async getForUid(uid: string): Promise<string[]> {
    const admin = await this.prisma.adminUser.findUnique({
      where: { firebaseUid: uid },
      include: { roleRef: true },
    });
    if (!admin || !admin.isActive) return [];
    if (admin.role === 'SUPER_ADMIN') return [WILDCARD];
    return admin.roleRef?.permissions ?? [];
  }

  has(granted: string[], required: string): boolean {
    return granted.includes(WILDCARD) || granted.includes(required);
  }
}
