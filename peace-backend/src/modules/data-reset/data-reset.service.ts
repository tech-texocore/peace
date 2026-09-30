import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../infra/prisma/prisma.service';
import {
  MediaService,
  type MediaFolder,
} from '../../infra/media/media.service';
import { FirebaseService } from '../../infra/firebase/firebase.service';
import { EmailService } from '../../infra/notifications/email.service';
import { verificationCodeEmail } from '../../infra/notifications/email-content';
import { SmtpEmailProvider } from '../../infra/notifications/providers/smtp-email.provider';
import { MastersService } from '../masters/masters.service';
import { OtpService } from '../otp/otp.service';

export type ResetScope = 'transactions' | 'everything';
export const RESET_SCOPES: ResetScope[] = ['transactions', 'everything'];

// Customer photos (reviews, personalisation, avatars) go with the transactions.
const CUSTOMER_MEDIA: MediaFolder[] = ['reviews', 'customizations', 'avatars'];

// Catalog images also go on a full reset. Banners, sellers and misc stay — the
// kept site config and sellers still use them.
const CATALOG_MEDIA: MediaFolder[] = [
  'products',
  'brands',
  'categories',
  'collections',
];

const LABEL: Record<ResetScope, string> = {
  transactions: 'Delete all transaction data',
  everything: 'Delete all data and restart fresh',
};

@Injectable()
export class DataResetService {
  private readonly logger = new Logger(DataResetService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly firebase: FirebaseService,
    private readonly mailer: EmailService,
    private readonly email: SmtpEmailProvider,
    private readonly masters: MastersService,
    private readonly otp: OtpService,
    private readonly media: MediaService,
  ) {}

  async summary() {
    const p = this.prisma;
    const [
      orders,
      returns,
      customers,
      reviews,
      products,
      categories,
      collections,
      brands,
      discounts,
      campaigns,
      admins,
    ] = await Promise.all([
      p.order.count(),
      p.returnRequest.count(),
      p.user.count({
        where: { firebaseUid: { notIn: await this.adminUids() } },
      }),
      p.review.count(),
      p.product.count(),
      p.category.count(),
      p.collection.count(),
      p.brand.count(),
      p.discount.count(),
      p.campaign.count(),
      p.adminUser.count({ where: { role: { not: 'SUPER_ADMIN' } } }),
    ]);
    return {
      transactions: { orders, returns, customers, reviews },
      everything: {
        products,
        categories,
        collections,
        brands,
        discounts,
        campaigns,
        admins,
      },
      emailReady: this.email.configured,
    };
  }

  async sendCode(scope: ResetScope, to?: string) {
    if (!to)
      throw new BadRequestException(
        'Your account has no email address for the verification code.',
      );
    const production = this.config.get<string>('app.env') === 'production';
    if (production && !this.email.configured) {
      throw new BadRequestException(
        'Set up Email in Integrations first — the verification code is sent by email.',
      );
    }
    const { code, ttl } = await this.otp.issue(to, this.purpose(scope));
    if (!this.email.configured)
      this.logger.warn(
        `[DEV] ${LABEL[scope]} — verification code for ${to}: ${code}`,
      );
    const store = await this.prisma.store.findFirstOrThrow({ select: { id: true } });
    await this.mailer.sendOrThrow(store.id, to, `Verification code: ${LABEL[scope]}`, verificationCodeEmail(LABEL[scope], code, ttl / 60));
    return { sent: true, to, expiresInSeconds: ttl };
  }

  async run(scope: ResetScope, code: string, to?: string) {
    if (!to)
      throw new BadRequestException('Your account has no email address.');
    await this.otp.verify(to, code, this.purpose(scope));
    const result =
      scope === 'transactions'
        ? await this.wipeTransactions()
        : await this.wipeEverything();
    this.logger.warn(
      `${LABEL[scope]} done by ${to}: ${JSON.stringify(result)}`,
    );
    return result;
  }

  private purpose(scope: ResetScope) {
    return `reset_${scope}`;
  }

  private async adminUids(roles?: Array<'SUPER_ADMIN' | 'ADMIN' | 'STAFF'>) {
    const admins = await this.prisma.adminUser.findMany({
      where: roles ? { role: { in: roles } } : {},
      select: { firebaseUid: true },
    });
    return admins.map((a) => a.firebaseUid);
  }

  // Orders, returns, customers and everything they created. Catalog, settings,
  // admins and integration keys stay; masters go back to the standard lists.
  private async wipeTransactions() {
    const keep = await this.adminUids();
    const customers = await this.prisma.user.findMany({
      where: { firebaseUid: { notIn: keep } },
      select: { firebaseUid: true },
    });
    const counts = await this.prisma.$transaction(async (tx) => {
      const orders = await this.deleteSales(tx);
      await tx.user.deleteMany({ where: { firebaseUid: { notIn: keep } } });
      return { orders, customers: customers.length };
    });
    await this.resetMasters();
    await Promise.all(CUSTOMER_MEDIA.map((f) => this.media.removeFolder(f)));
    const logins = await this.firebase.deleteUsers(
      customers.map((c) => c.firebaseUid),
    );
    return { ...counts, customerLoginsRemoved: logins, mastersReset: true };
  }

  // Back to the day after setup: only Super Admins, store settings, theme,
  // home-page config, roles, sellers, customer groups and integration keys stay.
  private async wipeEverything() {
    const keep = await this.adminUids(['SUPER_ADMIN']);
    const [users, admins] = await Promise.all([
      this.prisma.user.findMany({
        where: { firebaseUid: { notIn: keep } },
        select: { firebaseUid: true },
      }),
      this.prisma.adminUser.findMany({
        where: { role: { not: 'SUPER_ADMIN' } },
        select: { firebaseUid: true },
      }),
    ]);
    const counts = await this.prisma.$transaction(
      async (tx) => {
        const orders = await this.deleteSales(tx);
        await tx.collectionProduct.deleteMany();
        await tx.collection.deleteMany();
        await tx.productMedia.deleteMany();
        await tx.productVariant.deleteMany();
        const products = await tx.product.deleteMany();
        await tx.category.deleteMany();
        await tx.brand.deleteMany();
        await tx.discount.deleteMany();
        await tx.campaign.deleteMany();
        await tx.adminUser.deleteMany({
          where: { role: { not: 'SUPER_ADMIN' } },
        });
        await tx.user.deleteMany({ where: { firebaseUid: { notIn: keep } } });
        return {
          orders,
          products: products.count,
          customers: users.length,
          admins: admins.length,
        };
      },
      { timeout: 60_000 },
    );
    await this.resetMasters();
    const uids = [
      ...new Set([...users, ...admins].map((u) => u.firebaseUid)),
    ].filter((uid) => !keep.includes(uid));
    const logins = await this.firebase.deleteUsers(uids);
    await Promise.all(
      [...CUSTOMER_MEDIA, ...CATALOG_MEDIA].map((f) =>
        this.media.removeFolder(f),
      ),
    );
    return {
      ...counts,
      loginsRemoved: logins,
      mastersReset: true,
      mediaCleared: [...CUSTOMER_MEDIA, ...CATALOG_MEDIA],
    };
  }

  private async deleteSales(
    tx: Parameters<Parameters<PrismaService['$transaction']>[0]>[0],
  ) {
    await tx.reviewVote.deleteMany();
    await tx.productAnswer.deleteMany();
    await tx.productQuestion.deleteMany();
    await tx.review.deleteMany();
    await tx.returnRequest.deleteMany();
    await tx.orderEvent.deleteMany();
    await tx.orderItem.deleteMany();
    await tx.discountUsage.deleteMany();
    const orders = await tx.order.deleteMany();
    await tx.cartItem.deleteMany();
    await tx.wishlistItem.deleteMany();
    await tx.address.deleteMany();
    await tx.notification.deleteMany();
    await tx.backInStockSubscription.deleteMany();
    await tx.newsletterSubscriber.deleteMany();
    await tx.stockMovement.deleteMany();
    await tx.auditLog.deleteMany();
    await tx.otpChallenge.deleteMany();
    await tx.metaAudience.deleteMany();
    await tx.discount.updateMany({ data: { usedCount: 0 } });
    return orders.count;
  }

  private async resetMasters() {
    const stores = await this.prisma.store.findMany({ select: { id: true } });
    for (const { id } of stores) {
      await this.prisma.masterList.deleteMany({ where: { storeId: id } });
      await this.masters.seedDefaults(id);
    }
  }
}
