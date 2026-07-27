import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';

export interface AuditEntry {
  storeId?: string | null;
  actorId?: string | null;
  actorEmail?: string | null;
  actorRole?: string | null;
  action: string;
  entity?: string | null;
  entityId?: string | null;
  method: string;
  path: string;
  status: number;
  ip?: string | null;
  userAgent?: string | null;
  metadata?: Prisma.InputJsonValue;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger('Audit');

  constructor(private readonly prisma: PrismaService) {}

  record(entry: AuditEntry): void {
    this.prisma.auditLog
      .create({ data: entry })
      .catch((e) => this.logger.warn(`audit write failed: ${(e as Error).message}`));
  }

  async list(scopeStoreId: string | null, opts: { page: number; limit: number; action?: string; actorEmail?: string }) {
    const where: Prisma.AuditLogWhereInput = {
      ...(scopeStoreId ? { storeId: scopeStoreId } : {}),
      ...(opts.action ? { action: { contains: opts.action, mode: 'insensitive' } } : {}),
      ...(opts.actorEmail ? { actorEmail: { contains: opts.actorEmail, mode: 'insensitive' } } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (opts.page - 1) * opts.limit,
        take: opts.limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return { items, total, page: opts.page, limit: opts.limit };
  }
}
