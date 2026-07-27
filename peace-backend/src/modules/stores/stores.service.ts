import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { defaultSiteConfig } from '../site-config/default-site-config';
import { DEFAULT_ADMIN_PERMISSIONS, DEFAULT_STAFF_PERMISSIONS } from '../access/permissions.catalog';
import { MastersService } from '../masters/masters.service';
import { CreateStoreDto } from './dto/create-store.dto';

// Which integration fields are secrets — masked on read, preserved if not re-sent.
const SECRET_FIELDS = ['keySecret', 'licenseKey', 'accessToken', 'apiKey', 'password'];

@Injectable()
export class StoresService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly masters: MastersService,
  ) {}

  async create(dto: CreateStoreDto) {
    const config = defaultSiteConfig(dto.name);
    const store = await this.prisma.store.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        domain: dto.domain,
        siteConfig: {
          create: { draft: config, published: config, publishedAt: new Date() },
        },
        roles: {
          create: [
            { key: 'admin', name: 'Store Admin', permissions: DEFAULT_ADMIN_PERMISSIONS, isSystem: true },
            { key: 'staff', name: 'Staff', permissions: DEFAULT_STAFF_PERMISSIONS, isSystem: true },
          ],
        },
      },
      include: { roles: true },
    });
    await this.masters.seedDefaults(store.id);
    return store;
  }

  findAll() {
    return this.prisma.store.findMany({ orderBy: { createdAt: 'desc' } });
  }

  findBySlug(slug: string) {
    return this.prisma.store.findUnique({ where: { slug } });
  }

  async getSettings(storeId: string) {
    const store = await this.prisma.store.findUnique({ where: { id: storeId }, select: { settings: true } });
    return store?.settings ?? {};
  }

  async updateSettings(storeId: string, settings: Record<string, unknown>) {
    const store = await this.prisma.store.update({
      where: { id: storeId },
      data: { settings: settings as Prisma.InputJsonValue },
      select: { settings: true },
    });
    return store.settings;
  }

  private maskIntegrations(raw: Record<string, Record<string, string>>) {
    const out: Record<string, Record<string, string | boolean>> = {};
    for (const [group, fields] of Object.entries(raw ?? {})) {
      out[group] = {};
      for (const [key, value] of Object.entries(fields ?? {})) {
        out[group][key] = SECRET_FIELDS.includes(key) ? (value ? '••••••••' : '') : value;
      }
    }
    return out;
  }

  async getIntegrations(storeId: string) {
    const store = await this.prisma.store.findUnique({ where: { id: storeId }, select: { integrations: true } });
    return this.maskIntegrations((store?.integrations as Record<string, Record<string, string>>) ?? {});
  }

  // Merges provided values; blank/masked values keep the existing secret.
  async updateIntegrations(storeId: string, patch: Record<string, Record<string, string>>) {
    const store = await this.prisma.store.findUnique({ where: { id: storeId }, select: { integrations: true } });
    const current = (store?.integrations as Record<string, Record<string, string>>) ?? {};
    const merged: Record<string, Record<string, string>> = { ...current };
    for (const [group, fields] of Object.entries(patch ?? {})) {
      merged[group] = { ...(current[group] ?? {}) };
      for (const [key, value] of Object.entries(fields ?? {})) {
        if (value && value !== '••••••••') merged[group][key] = value;
      }
    }
    await this.prisma.store.update({
      where: { id: storeId },
      data: { integrations: merged as Prisma.InputJsonValue },
    });
    return this.maskIntegrations(merged);
  }
}
