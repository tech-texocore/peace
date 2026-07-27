import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';

@Injectable()
export class WishlistService {
  constructor(private readonly prisma: PrismaService) {}

  private async userId(uid: string) {
    const user = await this.prisma.user.findUnique({ where: { firebaseUid: uid }, select: { id: true } });
    if (!user) throw new NotFoundException('User not found');
    return user.id;
  }

  async get(uid: string) {
    const userId = await this.userId(uid);
    const rows = await this.prisma.wishlistItem.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, select: { productId: true } });
    return { productIds: rows.map((r) => r.productId) };
  }

  async add(uid: string, productId: string) {
    const userId = await this.userId(uid);
    await this.prisma.wishlistItem.upsert({
      where: { userId_productId: { userId, productId } },
      update: {},
      create: { userId, productId },
    });
    return { added: true };
  }

  async remove(uid: string, productId: string) {
    const userId = await this.userId(uid);
    await this.prisma.wishlistItem.deleteMany({ where: { userId, productId } });
    return { removed: true };
  }

  // Merge a guest's local wishlist into the account on sign-in.
  async merge(uid: string, productIds: string[]) {
    const userId = await this.userId(uid);
    if (productIds.length) {
      await this.prisma.wishlistItem.createMany({
        data: productIds.map((productId) => ({ userId, productId })),
        skipDuplicates: true,
      });
    }
    return this.get(uid);
  }
}
