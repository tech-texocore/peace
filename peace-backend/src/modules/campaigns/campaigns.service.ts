import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
    private readonly config: ConfigService,
  ) {}

  // Absolute, UTM-tagged link per channel; in-app keeps a site-relative path.
  private link(c: { name: string; targetUrl: string | null }, channel: 'email' | 'sms' | 'whatsapp' | 'in_app') {
    if (!c.targetUrl) return null;
    const webUrl = (this.config.get<string[]>('app.corsOrigins')?.[0] ?? 'http://localhost:3000').replace(/\/$/, '');
    const url = new URL(c.targetUrl, `${webUrl}/`);
    url.searchParams.set('utm_source', channel === 'in_app' ? 'peace_app' : channel);
    url.searchParams.set('utm_medium', channel === 'email' ? 'email' : channel === 'in_app' ? 'notification' : 'message');
    url.searchParams.set('utm_campaign', c.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'campaign');
    return channel === 'in_app' && url.origin === new URL(webUrl).origin ? url.pathname + url.search : url.toString();
  }

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

  async resolveAudience(storeId: string, audience: Audience): Promise<Recipient[]> {
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

  private emailHtml(subject: string, body: string, link: string | null) {
    const cta = link ? `<p style="margin-top:16px"><a href="${link}">Shop now →</a></p>` : '';
    return `<div><h2>${subject}</h2><p>${body.replace(/\n/g, '<br/>')}</p>${cta}<p style="color:#888;margin-top:24px">— Peace</p></div>`;
  }

  async send(storeId: string, id: string) {
    const c = await this.get(storeId, id);
    if (c.status === 'SENT') throw new BadRequestException('This campaign has already been sent.');
    if (!c.channels.length) throw new BadRequestException('Pick at least one channel to send on.');
    const recipients = await this.resolveAudience(storeId, (c.audience as Audience) ?? {});
    const subject = c.subject || c.name;

    const links = { email: this.link(c, 'email'), sms: this.link(c, 'sms'), whatsapp: this.link(c, 'whatsapp'), inApp: this.link(c, 'in_app') };
    const withLink = (text: string, link: string | null) => (link ? `${text}\n${link}` : text);

    let count = 0;
    for (const r of recipients) {
      const body = this.render(c.body, r);
      let delivered = false;
      if (c.channels.includes('EMAIL') && r.email && (r.userId ? r.emailOptIn : true)) {
        await this.notifications.sendEmail(r.email, subject, this.emailHtml(subject, body, links.email));
        delivered = true;
      }
      if (c.channels.includes('SMS') && r.phone && r.smsOptIn) { await this.notifications.sendSms(r.phone, withLink(`${subject}: ${body}`, links.sms)); delivered = true; }
      if (c.channels.includes('WHATSAPP') && r.phone && r.whatsappOptIn) { await this.notifications.sendWhatsapp(r.phone, withLink(`${subject}: ${body}`, links.whatsapp)); delivered = true; }
      if (c.channels.includes('IN_APP') && r.userId) {
        await this.prisma.notification.create({ data: { storeId, userId: r.userId, title: subject, body, deepLink: links.inApp } });
        delivered = true;
      }
      if (delivered) count++;
    }

    await this.prisma.campaign.update({ where: { id }, data: { status: 'SENT', recipientCount: count, sentAt: new Date() } });
    return { sent: count };
  }
}
