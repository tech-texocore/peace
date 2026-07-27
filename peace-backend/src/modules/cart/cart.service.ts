import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';

interface CartLineInput { variantId: string; quantity: number; customization?: Record<string, unknown> }

@Injectable()
export class CartService {
  constructor(private readonly prisma: PrismaService) {}

  private async userId(uid: string) {
    const user = await this.prisma.user.findUnique({ where: { firebaseUid: uid }, select: { id: true } });
    if (!user) throw new NotFoundException('User not found');
    return user.id;
  }

  async get(uid: string) {
    const userId = await this.userId(uid);
    const rows = await this.prisma.cartItem.findMany({ where: { userId }, orderBy: { createdAt: 'asc' }, select: { variantId: true, quantity: true, customization: true } });
    return { items: rows.map((r) => ({ variantId: r.variantId, quantity: r.quantity, customization: (r.customization ?? undefined) as Record<string, unknown> | undefined })) };
  }

  private async productMap(variantIds: string[]) {
    const variants = await this.prisma.productVariant.findMany({ where: { id: { in: variantIds } }, select: { id: true, productId: true } });
    return new Map(variants.map((v) => [v.id, v.productId]));
  }

  // Guest cart → account on sign-in (guest quantity wins per line; server-only lines kept).
  async merge(uid: string, items: CartLineInput[]) {
    const userId = await this.userId(uid);
    const pmap = await this.productMap(items.map((i) => i.variantId));
    for (const it of items) {
      const productId = pmap.get(it.variantId);
      if (!productId || it.quantity <= 0) continue;
      const customization = (it.customization ?? undefined) as Prisma.InputJsonValue | undefined;
      await this.prisma.cartItem.upsert({
        where: { userId_variantId: { userId, variantId: it.variantId } },
        update: { quantity: it.quantity, customization },
        create: { userId, variantId: it.variantId, productId, quantity: it.quantity, customization },
      });
    }
    return this.get(uid);
  }

  // Full replace — keeps the signed-in cart in sync with the client on every change.
  async replace(uid: string, items: CartLineInput[]) {
    const userId = await this.userId(uid);
    const pmap = await this.productMap(items.map((i) => i.variantId));
    const valid = items.filter((i) => pmap.get(i.variantId) && i.quantity > 0);
    await this.prisma.$transaction([
      this.prisma.cartItem.deleteMany({ where: { userId } }),
      ...(valid.length
        ? [this.prisma.cartItem.createMany({
            data: valid.map((i) => ({ userId, variantId: i.variantId, productId: pmap.get(i.variantId)!, quantity: i.quantity, customization: (i.customization ?? undefined) as Prisma.InputJsonValue })),
          })]
        : []),
    ]);
    return { saved: true };
  }
}
