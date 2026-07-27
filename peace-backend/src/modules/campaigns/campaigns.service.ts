import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { NotificationsService } from '../../infra/notifications/notifications.service';
import { UpsertCampaignDto } from './dto/campaign.dto';

interface Audience { base?: string; groupId?: string; state?: string }
interface Recipient { email: string; userId: string | null; name: string | null; phone: string | null; emailOptIn: boolean; smsOptIn: boolean; whatsappOptIn: boolean }

@Injectable()
export class CampaignsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  list(storeId: string) {
    return this.prisma.campaign.findMany({ where: { storeId }, orderBy: { createdAt: 'desc' } });
  }

  async get(storeId: string, id: string) {
    const c = await this.prisma.campaign.findFirst({ where: { id, storeId } });
    if (!c) throw new NotFoundException('Campaign not found');
    return c;
  }

  private data(dto: UpsertCampaignDto) {
    return {
      name: dto.name,
      channels: dto.channels ?? [],
      subject: dto.subject ?? null,
      body: dto.body,
      audience: (dto.audience ?? {}) as Prisma.InputJsonValue,
      targetUrl: dto.targetUrl || null,
      productIds: dto.productIds ?? [],
      scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null,
    };
  }

  create(storeId: string, dto: UpsertCampaignDto) {
    return this.prisma.campaign.create({ data: { storeId, ...this.data(dto), status: dto.scheduledAt ? 'SCHEDULED' : 'DRAFT' } });
  }

  async update(storeId: string, id: string, dto: UpsertCampaignDto) {
    const c = await this.get(storeId, id);
    if (c.status === 'SENT') throw new BadRequestException('A sent campaign cannot be edited.');
    return this.prisma.campaign.update({ where: { id }, data: { ...this.data(dto), status: dto.scheduledAt ? 'SCHEDULED' : 'DRAFT' } });
  }

  async remove(storeId: string, id: string) {
    await this.get(storeId, id);
    await this.prisma.campaign.delete({ where: { id } });
    return { ok: true };
  }

  async audienceCount(storeId: string, audience: Audience) {
    return { count: (await this.resolveAudience(storeId, audience)).length };
  }

  private async resolveAudience(storeId: string, audience: Audience): Promise<Recipient[]> {
    const base = audience?.base || 'all_customers';
    const map = new Map<string, Recipient>();

    if (base === 'newsletter') {
      const subs = await this.prisma.newsletterSubscriber.findMany({ where: { storeId, status: 'SUBSCRIBED' }, select: { email: true, userId: true } });
      const userIds = subs.map((s) => s.userId).filter((x): x is string => !!x);
      const users = userIds.length ? await this.prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, phone: true, emailOptIn: true, smsOptIn: true, whatsappOptIn: true } }) : [];
      const byId = new Map(users.map((u) => [u.id, u]));
      for (const s of subs) {
        const u = s.userId ? byId.get(s.userId) : undefined;
        map.set(s.email.toLowerCase(), { email: s.email, userId: s.userId, name: u?.name ?? null, phone: u?.phone ?? null, emailOptIn: u?.emailOptIn ?? true, smsOptIn: u?.smsOptIn ?? false, whatsappOptIn: u?.whatsappOptIn ?? false });
      }
      return [...map.values()];
    }

    const where: Prisma.UserWhereInput = { role: 'CUSTOMER' };
    if (base === 'customer_group' && audience.groupId) where.customerGroupId = audience.groupId;
    if (base === 'has_ordered') where.orders = { some: { storeId } };
    if (audience.state) where.addresses = { some: { state: audience.state } };
    const users = await this.prisma.user.findMany({ where, select: { id: true, email: true, name: true, phone: true, emailOptIn: true, smsOptIn: true, whatsappOptIn: true } });
    for (const u of users) map.set(u.email.toLowerCase(), { email: u.email, userId: u.id, name: u.name, phone: u.phone, emailOptIn: u.emailOptIn, smsOptIn: u.smsOptIn, whatsappOptIn: u.whatsappOptIn });
    return [...map.values()];
  }

  private render(text: string, r: Recipient) {
    return text.replace(/\{name\}/g, r.name || 'there');
  }

  private emailHtml(subject: string, body: string, targetUrl: string | null) {
    const cta = targetUrl ? `<p style="margin-top:16px"><a href="${targetUrl}">Shop now →</a></p>` : '';
    return `<div><h2>${subject}</h2><p>${body.replace(/\n/g, '<br/>')}</p>${cta}<p style="color:#888;margin-top:24px">— Peace</p></div>`;
  }

  async send(storeId: string, id: string) {
    const c = await this.get(storeId, id);
    if (c.status === 'SENT') throw new BadRequestException('This campaign has already been sent.');
    if (!c.channels.length) throw new BadRequestException('Pick at least one channel to send on.');
    const recipients = await this.resolveAudience(storeId, (c.audience as Audience) ?? {});
    const subject = c.subject || c.name;

    let count = 0;
    for (const r of recipients) {
      const body = this.render(c.body, r);
      let delivered = false;
      if (c.channels.includes('EMAIL') && r.email && (r.userId ? r.emailOptIn : true)) {
        await this.notifications.sendEmail(r.email, subject, this.emailHtml(subject, body, c.targetUrl));
        delivered = true;
      }
      if (c.channels.includes('SMS') && r.phone && r.smsOptIn) { await this.notifications.sendSms(r.phone, `${subject}: ${body}`); delivered = true; }
      if (c.channels.includes('WHATSAPP') && r.phone && r.whatsappOptIn) { await this.notifications.sendWhatsapp(r.phone, `${subject}: ${body}`); delivered = true; }
      if (c.channels.includes('IN_APP') && r.userId) {
        await this.prisma.notification.create({ data: { storeId, userId: r.userId, title: subject, body, deepLink: c.targetUrl } });
        delivered = true;
      }
      if (delivered) count++;
    }

    await this.prisma.campaign.update({ where: { id }, data: { status: 'SENT', recipientCount: count, sentAt: new Date() } });
    return { sent: count };
  }
}
