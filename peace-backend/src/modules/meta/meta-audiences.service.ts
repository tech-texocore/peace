import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { IntegrationsService } from '../../infra/integrations/integrations.service';
import { META_GRAPH_VERSION } from '../../infra/integrations/integration-fields';
import { CampaignsService } from '../campaigns/campaigns.service';
import {
  AudienceRuleDto,
  CreateMetaAudienceDto,
} from './dto/meta-audience.dto';

const BATCH = 10_000;
const sha = (v: string) =>
  createHash('sha256').update(v.trim().toLowerCase()).digest('hex');
const indianPhone = (v: string) => {
  const d = v.replace(/\D/g, '');
  return d.length === 10 ? `91${d}` : d;
};

// Only customers who agreed to marketing are uploaded, hashed as Meta requires.
@Injectable()
export class MetaAudiencesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly integrations: IntegrationsService,
    private readonly campaigns: CampaignsService,
  ) {}

  list(storeId: string) {
    return this.prisma.metaAudience.findMany({
      where: { storeId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async count(storeId: string, rule: AudienceRuleDto) {
    const all = await this.campaigns.resolveAudience(storeId, rule);
    return {
      total: all.length,
      eligible: all.filter((r) => r.emailOptIn).length,
    };
  }

  async create(storeId: string, dto: CreateMetaAudienceDto) {
    this.credentials();
    const row = await this.prisma.metaAudience.create({
      data: {
        storeId,
        name: dto.name,
        audience: dto.audience as unknown as Prisma.InputJsonValue,
      },
    });
    try {
      return await this.sync(storeId, row.id);
    } catch (e) {
      await this.prisma.metaAudience.delete({ where: { id: row.id } });
      throw e;
    }
  }

  // Meta ignores people already in the audience, so re-syncing only adds new ones.
  async sync(storeId: string, id: string) {
    const row = await this.get(storeId, id);
    const { account, token } = this.credentials();
    const people = (
      await this.campaigns.resolveAudience(
        storeId,
        row.audience as unknown as AudienceRuleDto,
      )
    ).filter((r) => r.emailOptIn);
    if (!people.length)
      throw new BadRequestException(
        'No customers in this audience have agreed to marketing.',
      );

    const metaAudienceId =
      row.metaAudienceId ??
      (
        await this.graph('POST', `${account}/customaudiences`, token, {
          name: `Peace — ${row.name}`,
          subtype: 'CUSTOM',
          customer_file_source: 'USER_PROVIDED_ONLY',
          description: 'Synced from Peace admin → Meta Ads',
        })
      ).id!;

    const data = people.map((r) => [
      sha(r.email),
      r.phone ? sha(indianPhone(r.phone)) : '',
    ]);
    for (let i = 0; i < data.length; i += BATCH) {
      await this.graph('POST', `${metaAudienceId}/users`, token, {
        payload: { schema: ['EMAIL', 'PHONE'], data: data.slice(i, i + BATCH) },
      });
    }
    return this.prisma.metaAudience.update({
      where: { id },
      data: { metaAudienceId, size: data.length, syncedAt: new Date() },
    });
  }

  async remove(storeId: string, id: string) {
    const row = await this.get(storeId, id);
    if (row.metaAudienceId) {
      const { token } = this.credentials();
      await this.graph('DELETE', row.metaAudienceId, token).catch(
        (e: Error) => {
          if (!/does not exist|cannot be loaded/i.test(e.message)) throw e;
        },
      );
    }
    await this.prisma.metaAudience.delete({ where: { id } });
    return { deleted: true };
  }

  async testAdAccount() {
    const { account, token } = this.credentials();
    try {
      const res = await this.graph(
        'GET',
        `${account}?fields=name,account_status`,
        token,
      );
      return {
        ok: true,
        message: `Connected to ad account "${res.name ?? account}".`,
      };
    } catch (e) {
      return { ok: false, message: (e as Error).message };
    }
  }

  private async get(storeId: string, id: string) {
    const row = await this.prisma.metaAudience.findFirst({
      where: { id, storeId },
    });
    if (!row) throw new NotFoundException('Audience not found');
    return row;
  }

  private credentials() {
    const { adAccountId, audienceToken, accessToken } =
      this.integrations.current.meta;
    const token = audienceToken || accessToken;
    if (!adAccountId || !token) {
      throw new BadRequestException(
        'Add the Ad Account ID and audience token in Meta Ads → Connection first.',
      );
    }
    return {
      account: adAccountId.startsWith('act_')
        ? adAccountId
        : `act_${adAccountId}`,
      token,
    };
  }

  private async graph(
    method: 'GET' | 'POST' | 'DELETE',
    path: string,
    token: string,
    body?: unknown,
  ) {
    const res = await fetch(
      `https://graph.facebook.com/${META_GRAPH_VERSION}/${path}`,
      {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      },
    );
    const json = (await res.json().catch(() => ({}))) as {
      id?: string;
      name?: string;
      error?: { message?: string };
    };
    if (!res.ok)
      throw new BadRequestException(
        `Meta: ${json.error?.message ?? `HTTP ${res.status}`}`,
      );
    return json;
  }
}
