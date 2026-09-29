import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { IntegrationsService } from '../../infra/integrations/integrations.service';
import { META_GRAPH_VERSION } from '../../infra/integrations/integration-fields';

export interface MetaContext {
  ip?: string;
  userAgent?: string;
  fbp?: string;
  fbc?: string;
  url?: string;
}

type Address = {
  recipientName?: string;
  recipientPhone?: string;
  city?: string;
  state?: string;
  postalCode?: string;
};

const hash = (v?: string | null) =>
  v
    ? createHash('sha256').update(v.trim().toLowerCase()).digest('hex')
    : undefined;
const phoneDigits = (v?: string | null) => {
  const d = (v ?? '').replace(/\D/g, '');
  return d.length === 10 ? `91${d}` : d || undefined;
};

// event_id is the order number, so Meta de-duplicates it with the browser's Purchase.
@Injectable()
export class MetaCapiService {
  private readonly logger = new Logger(MetaCapiService.name);

  constructor(
    private readonly integrations: IntegrationsService,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  // Fire-and-forget: a Meta outage must never affect an order.
  purchase(orderId: string, ctx: MetaContext = {}) {
    void this.sendPurchase(orderId, ctx).catch((e: Error) =>
      this.logger.warn(`Meta purchase event failed: ${e.message}`),
    );
  }

  private async sendPurchase(orderId: string, ctx: MetaContext) {
    const { pixelId, accessToken, testEventCode } =
      this.integrations.current.meta;
    if (!pixelId || !accessToken) return;
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
        user: { select: { id: true, email: true, phone: true } },
      },
    });
    if (!order) return;

    const addr = (order.shippingAddress ?? {}) as Address;
    const [first, ...rest] = (addr.recipientName ?? '').trim().split(/\s+/);
    const webUrl = this.config.get<string[]>('app.corsOrigins')?.[0] ?? '';
    const event = {
      event_name: 'Purchase',
      event_time: Math.floor(Date.now() / 1000),
      event_id: order.orderNumber,
      action_source: 'website',
      event_source_url: ctx.url ?? `${webUrl}/checkout`,
      user_data: {
        em: [hash(order.user?.email)].filter(Boolean),
        ph: [
          hash(phoneDigits(addr.recipientPhone ?? order.user?.phone)),
        ].filter(Boolean),
        fn: [hash(first)].filter(Boolean),
        ln: [hash(rest.join(' '))].filter(Boolean),
        ct: [hash(addr.city?.replace(/\s+/g, ''))].filter(Boolean),
        st: [hash(addr.state?.replace(/\s+/g, ''))].filter(Boolean),
        zp: [hash(addr.postalCode)].filter(Boolean),
        country: [hash('in')],
        external_id: [hash(order.user?.id)].filter(Boolean),
        client_ip_address: ctx.ip,
        client_user_agent: ctx.userAgent,
        fbp: ctx.fbp,
        fbc: ctx.fbc,
      },
      custom_data: {
        currency: 'INR',
        value: Number(order.total),
        order_id: order.orderNumber,
        content_type: 'product',
        content_ids: order.items
          .map((i) => i.variantId ?? i.productId)
          .filter(Boolean),
        contents: order.items.map((i) => ({
          id: i.variantId ?? i.productId,
          quantity: i.quantity,
          item_price: Number(i.price),
        })),
        num_items: order.items.reduce((n, i) => n + i.quantity, 0),
      },
    };

    const res = await fetch(
      `https://graph.facebook.com/${META_GRAPH_VERSION}/${encodeURIComponent(pixelId)}/events`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          data: [event],
          ...(testEventCode ? { test_event_code: testEventCode } : {}),
        }),
      },
    );
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as {
        error?: { message?: string };
      };
      throw new Error(body.error?.message ?? `HTTP ${res.status}`);
    }
  }
}
