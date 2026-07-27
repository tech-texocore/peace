import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { CreateSellerDto } from './dto/create-seller.dto';
import { UpdateSellerDto } from './dto/update-seller.dto';
import { ListSellersDto } from './dto/list-sellers.dto';

@Injectable()
export class SellersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(storeId: string, query: ListSellersDto) {
    const where: Prisma.SellerWhereInput = {
      storeId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? { OR: [{ name: { contains: query.search, mode: 'insensitive' } }, { gstin: { contains: query.search, mode: 'insensitive' } }] }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.seller.findMany({
        where,
        orderBy: [{ isFirstParty: 'desc' }, { createdAt: 'desc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        include: { _count: { select: { products: true } } },
      }),
      this.prisma.seller.count({ where }),
    ]);
    return { items, total, page: query.page, limit: query.limit };
  }

  async get(storeId: string, id: string) {
    const seller = await this.prisma.seller.findFirst({
      where: { id, storeId },
      include: { _count: { select: { products: true } } },
    });
    if (!seller) throw new NotFoundException('Seller not found');
    return seller;
  }

  async create(storeId: string, dto: CreateSellerDto) {
    if (dto.isFirstParty) await this.clearFirstParty(storeId);
    return this.prisma.seller.create({ data: { ...dto, storeId } });
  }

  async update(storeId: string, id: string, dto: UpdateSellerDto) {
    await this.get(storeId, id);
    if (dto.isFirstParty) await this.clearFirstParty(storeId, id);
    return this.prisma.seller.update({ where: { id }, data: dto });
  }

  async remove(storeId: string, id: string) {
    const seller = await this.get(storeId, id);
    if (seller._count.products > 0) {
      throw new BadRequestException('Seller has products. Move or delete them first, or set the seller inactive.');
    }
    await this.prisma.seller.delete({ where: { id } });
    return { ok: true };
  }

  // Only one first-party seller per store.
  private async clearFirstParty(storeId: string, exceptId?: string) {
    await this.prisma.seller.updateMany({
      where: { storeId, isFirstParty: true, ...(exceptId ? { id: { not: exceptId } } : {}) },
      data: { isFirstParty: false },
    });
  }
}
