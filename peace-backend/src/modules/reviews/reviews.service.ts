import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ModerationStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import type { CreateReviewDto } from './dto/review.dto';

interface ReviewListQuery { sort?: string; rating?: number; withPhotos?: boolean; verified?: boolean }

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  private async userId(uid: string) {
    const user = await this.prisma.user.findUnique({ where: { firebaseUid: uid }, select: { id: true } });
    if (!user) throw new NotFoundException('User not found');
    return user.id;
  }

  private async productStore(productId: string) {
    const p = await this.prisma.product.findUnique({ where: { id: productId }, select: { storeId: true } });
    if (!p) throw new NotFoundException('Product not found');
    return p.storeId;
  }

  private async autoApprove(storeId: string) {
    const store = await this.prisma.store.findUnique({ where: { id: storeId }, select: { settings: true } });
    return (store?.settings as Record<string, unknown> | null)?.reviewsAutoApprove === true;
  }

  // ---------------- Storefront: read ----------------
  async findForProduct(productId: string, q: ReviewListQuery = {}) {
    const where: Prisma.ReviewWhereInput = { productId, status: 'APPROVED' };
    if (q.rating) where.rating = q.rating;
    if (q.withPhotos) where.media = { isEmpty: false };
    if (q.verified) where.isVerifiedPurchase = true;

    const orderBy: Prisma.ReviewOrderByWithRelationInput =
      q.sort === 'helpful' ? { helpfulCount: 'desc' }
      : q.sort === 'high' ? { rating: 'desc' }
      : q.sort === 'low' ? { rating: 'asc' }
      : { createdAt: 'desc' };

    const [rows, summary] = await Promise.all([
      this.prisma.review.findMany({ where, orderBy, take: 50, include: { user: { select: { name: true, avatarUrl: true } } } }),
      this.summary(productId),
    ]);

    const reviews = rows.map((r) => ({
      id: r.id, rating: r.rating, title: r.title, comment: r.comment, media: r.media,
      isVerifiedPurchase: r.isVerifiedPurchase, helpfulCount: r.helpfulCount, createdAt: r.createdAt,
      author: r.user.name ?? 'Anonymous', avatar: r.user.avatarUrl,
    }));
    return { summary, reviews };
  }

  async summary(productId: string) {
    const grouped = await this.prisma.review.groupBy({ by: ['rating'], where: { productId, status: 'APPROVED' }, _count: true });
    const breakdown: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let count = 0, sum = 0;
    for (const g of grouped) { breakdown[g.rating] = g._count; count += g._count; sum += g.rating * g._count; }
    const verifiedCount = await this.prisma.review.count({ where: { productId, status: 'APPROVED', isVerifiedPurchase: true } });
    return { average: count ? Math.round((sum / count) * 10) / 10 : 0, count, breakdown, verifiedCount };
  }

  // Only a customer who actually bought the product may review it.
  private async purchaseOf(userId: string, productId: string) {
    return this.prisma.orderItem.findFirst({
      where: { productId, order: { userId, status: { in: ['CONFIRMED', 'SHIPPED', 'DELIVERED'] } } },
      select: { orderId: true },
    });
  }

  /** Tells the storefront whether the signed-in shopper may write a review. */
  async eligibility(uid: string, productId: string) {
    const userId = await this.userId(uid);
    const [purchase, existing] = await Promise.all([
      this.purchaseOf(userId, productId),
      this.prisma.review.findUnique({ where: { productId_userId: { productId, userId } }, select: { id: true } }),
    ]);
    return { purchased: Boolean(purchase), alreadyReviewed: Boolean(existing), canReview: Boolean(purchase) && !existing };
  }

  // ---------------- Storefront: write ----------------
  async create(uid: string, dto: CreateReviewDto) {
    const userId = await this.userId(uid);
    const storeId = await this.productStore(dto.productId);

    const existing = await this.prisma.review.findUnique({ where: { productId_userId: { productId: dto.productId, userId } }, select: { id: true } });
    if (existing) throw new BadRequestException('You have already reviewed this product');

    const purchase = await this.purchaseOf(userId, dto.productId);
    if (!purchase) throw new ForbiddenException('You can review this product only after purchasing it');

    const status: ModerationStatus = (await this.autoApprove(storeId)) ? 'APPROVED' : 'PENDING';

    const review = await this.prisma.review.create({
      data: {
        storeId, productId: dto.productId, userId,
        orderId: purchase.orderId, isVerifiedPurchase: true,
        rating: dto.rating, title: dto.title ?? null, comment: dto.comment ?? null, media: dto.media ?? [],
        status,
      },
    });
    return { id: review.id, status: review.status, pending: status === 'PENDING' };
  }

  async voteHelpful(uid: string, reviewId: string) {
    const userId = await this.userId(uid);
    try {
      await this.prisma.reviewVote.create({ data: { reviewId, userId } });
    } catch {
      throw new BadRequestException('You already found this review helpful');
    }
    const r = await this.prisma.review.update({ where: { id: reviewId }, data: { helpfulCount: { increment: 1 } }, select: { helpfulCount: true } });
    return { helpfulCount: r.helpfulCount };
  }

  // ---------------- Q&A ----------------
  async questions(productId: string) {
    const rows = await this.prisma.productQuestion.findMany({
      where: { productId, status: 'APPROVED' },
      orderBy: { createdAt: 'desc' }, take: 50,
      include: {
        user: { select: { name: true } },
        answers: { where: { status: 'APPROVED' }, orderBy: { createdAt: 'asc' }, include: { user: { select: { name: true } } } },
      },
    });
    return rows.map((q) => ({
      id: q.id, body: q.body, author: q.user.name ?? 'Anonymous', createdAt: q.createdAt,
      answers: q.answers.map((a) => ({ id: a.id, body: a.body, author: a.user.name ?? 'Shopper', isSeller: a.isSeller, createdAt: a.createdAt })),
    }));
  }

  async ask(uid: string, productId: string, body: string) {
    const userId = await this.userId(uid);
    const storeId = await this.productStore(productId);
    const status: ModerationStatus = (await this.autoApprove(storeId)) ? 'APPROVED' : 'PENDING';
    const q = await this.prisma.productQuestion.create({ data: { storeId, productId, userId, body, status } });
    return { id: q.id, pending: status === 'PENDING' };
  }

  async answerQuestion(uid: string, questionId: string, body: string) {
    const userId = await this.userId(uid);
    const q = await this.prisma.productQuestion.findUnique({ where: { id: questionId }, select: { id: true } });
    if (!q) throw new NotFoundException('Question not found');
    const a = await this.prisma.productAnswer.create({ data: { questionId, userId, body, status: 'APPROVED' } });
    return { id: a.id };
  }

  // ---------------- Admin moderation ----------------
  async adminList(storeId: string, q: { status?: ModerationStatus; productId?: string; page?: number; limit?: number }) {
    const page = Math.max(1, q.page ?? 1);
    const limit = Math.min(50, q.limit ?? 20);
    const where: Prisma.ReviewWhereInput = { storeId };
    if (q.status) where.status = q.status;
    if (q.productId) where.productId = q.productId;

    const [rows, total, pending] = await Promise.all([
      this.prisma.review.findMany({
        where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit,
        include: { user: { select: { name: true, email: true } }, product: { select: { title: true, slug: true } } },
      }),
      this.prisma.review.count({ where }),
      this.prisma.review.count({ where: { storeId, status: 'PENDING' } }),
    ]);
    return { items: rows, total, page, limit, pendingCount: pending };
  }

  async moderate(storeId: string, id: string, status: ModerationStatus) {
    await this.own(storeId, id);
    return this.prisma.review.update({ where: { id }, data: { status } });
  }

  async remove(storeId: string, id: string) {
    await this.own(storeId, id);
    await this.prisma.review.delete({ where: { id } });
    return { deleted: true };
  }

  private async own(storeId: string, id: string) {
    const r = await this.prisma.review.findFirst({ where: { id, storeId }, select: { id: true } });
    if (!r) throw new NotFoundException('Review not found');
  }

  // ---------------- Aggregate helper (used by storefront cards) ----------------
  async ratingsFor(productIds: string[]) {
    const map = new Map<string, { average: number; count: number }>();
    if (!productIds.length) return map;
    const grouped = await this.prisma.review.groupBy({
      by: ['productId'], where: { productId: { in: productIds }, status: 'APPROVED' },
      _avg: { rating: true }, _count: true,
    });
    for (const g of grouped) {
      map.set(g.productId, { average: g._avg.rating ? Math.round(g._avg.rating * 10) / 10 : 0, count: g._count });
    }
    return map;
  }
}
