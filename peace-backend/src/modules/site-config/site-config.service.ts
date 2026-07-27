import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';

@Injectable()
export class SiteConfigService {
  constructor(private readonly prisma: PrismaService) {}

  async getPublished(slug: string) {
    const store = await this.prisma.store.findUnique({
      where: { slug },
      include: { siteConfig: true },
    });
    if (!store?.siteConfig) throw new NotFoundException('Store not found');
    return store.siteConfig.published ?? store.siteConfig.draft;
  }

  async getForStore(storeId: string) {
    const cfg = await this.prisma.siteConfig.findUnique({ where: { storeId } });
    if (!cfg) throw new NotFoundException('Config not found');
    return { draft: cfg.draft, published: cfg.published, publishedAt: cfg.publishedAt };
  }

  saveDraft(storeId: string, draft: Record<string, unknown>) {
    return this.prisma.siteConfig.update({
      where: { storeId },
      data: { draft: draft as Prisma.InputJsonValue },
    });
  }

  async publish(storeId: string) {
    const cfg = await this.prisma.siteConfig.findUnique({ where: { storeId } });
    if (!cfg) throw new NotFoundException('Config not found');
    return this.prisma.siteConfig.update({
      where: { storeId },
      data: { published: cfg.draft as Prisma.InputJsonValue, publishedAt: new Date() },
    });
  }
}
