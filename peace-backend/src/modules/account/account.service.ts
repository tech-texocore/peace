import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { OtpService } from '../otp/otp.service';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import {
  CreateAddressDto,
  UpdateAddressDto,
  UpdatePreferencesDto,
  UpdateProfileDto,
} from './dto/account.dto';
import { NOTIFICATION_CATEGORIES, normalizePrefs } from '../../common/notification-prefs';

@Injectable()
export class AccountService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly otp: OtpService,
  ) {}

  // Creates the customer record on first access from the Firebase token.
  async getOrCreateProfile(user: AuthUser) {
    return this.prisma.user.upsert({
      where: { firebaseUid: user.uid },
      create: {
        firebaseUid: user.uid,
        email: user.email ?? `${user.uid}@no-email.local`,
        name: user.name,
        avatarUrl: user.picture,
      },
      update: {},
      include: { addresses: { orderBy: { isDefault: 'desc' } } },
    });
  }

  private async userId(uid: string): Promise<string> {
    const user = await this.prisma.user.findUnique({ where: { firebaseUid: uid }, select: { id: true } });
    if (!user) throw new NotFoundException('Profile not found');
    return user.id;
  }

  async notifications(uid: string) {
    const userId = await this.userId(uid);
    const [items, unread] = await Promise.all([
      this.prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 50 }),
      this.prisma.notification.count({ where: { userId, read: false } }),
    ]);
    return { items, unread };
  }

  async notificationCount(uid: string) {
    const userId = await this.userId(uid);
    return { count: await this.prisma.notification.count({ where: { userId, read: false } }) };
  }

  async markNotificationRead(uid: string, id: string) {
    const userId = await this.userId(uid);
    await this.prisma.notification.updateMany({ where: { id, userId }, data: { read: true } });
    return { ok: true };
  }

  async markAllNotificationsRead(uid: string) {
    const userId = await this.userId(uid);
    await this.prisma.notification.updateMany({ where: { userId, read: false }, data: { read: true } });
    return { ok: true };
  }

  async updateProfile(uid: string, dto: UpdateProfileDto) {
    return this.prisma.user.update({
      where: { firebaseUid: uid },
      data: {
        name: dto.name,
        gender: dto.gender,
        dob: dto.dob ? new Date(dto.dob) : undefined,
        emailOptIn: dto.emailOptIn,
        smsOptIn: dto.smsOptIn,
        whatsappOptIn: dto.whatsappOptIn,
      },
      include: { addresses: { orderBy: { isDefault: 'desc' } } },
    });
  }

  async getPreferences(uid: string) {
    const user = await this.prisma.user.findUnique({
      where: { firebaseUid: uid },
      select: { emailOptIn: true, smsOptIn: true, whatsappOptIn: true, notificationPrefs: true },
    });
    if (!user) throw new NotFoundException('Profile not found');
    return {
      channels: { emailOptIn: user.emailOptIn, smsOptIn: user.smsOptIn, whatsappOptIn: user.whatsappOptIn },
      categories: normalizePrefs(user.notificationPrefs),
      catalog: NOTIFICATION_CATEGORIES,
    };
  }

  async updatePreferences(uid: string, dto: UpdatePreferencesDto) {
    const current = await this.prisma.user.findUnique({
      where: { firebaseUid: uid },
      select: { notificationPrefs: true },
    });
    if (!current) throw new NotFoundException('Profile not found');
    const provided = Object.fromEntries(
      Object.entries(dto.categories ?? {}).map(([k, v]) => [k, Boolean(v)]),
    );
    const merged = { ...normalizePrefs(current.notificationPrefs), ...provided };
    await this.prisma.user.update({
      where: { firebaseUid: uid },
      data: {
        emailOptIn: dto.emailOptIn,
        smsOptIn: dto.smsOptIn,
        whatsappOptIn: dto.whatsappOptIn,
        notificationPrefs: merged,
      },
    });
    return this.getPreferences(uid);
  }

  sendPhoneOtp(phone: string) {
    return this.otp.request(phone, 'phone_verify');
  }

  async verifyPhoneOtp(uid: string, phone: string, code: string) {
    const takenBy = await this.prisma.user.findFirst({
      where: { phone, phoneVerified: true, NOT: { firebaseUid: uid } },
      select: { id: true },
    });
    if (takenBy) {
      throw new ConflictException('This mobile number is already registered to another account');
    }
    await this.otp.verify(phone, code, 'phone_verify');
    return this.prisma.user.update({
      where: { firebaseUid: uid },
      data: { phone, phoneVerified: true },
      select: { phone: true, phoneVerified: true },
    });
  }

  async listAddresses(uid: string) {
    return this.prisma.address.findMany({
      where: { userId: await this.userId(uid) },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async createAddress(uid: string, dto: CreateAddressDto) {
    const userId = await this.userId(uid);
    const count = await this.prisma.address.count({ where: { userId } });
    const makeDefault = dto.isDefault || count === 0;
    if (makeDefault) {
      await this.prisma.address.updateMany({ where: { userId }, data: { isDefault: false } });
    }
    return this.prisma.address.create({
      data: { ...dto, isDefault: makeDefault, userId },
    });
  }

  private async ownAddress(uid: string, id: string) {
    const userId = await this.userId(uid);
    const address = await this.prisma.address.findUnique({ where: { id } });
    if (!address) throw new NotFoundException('Address not found');
    if (address.userId !== userId) throw new ForbiddenException('Not your address');
    return { userId, address };
  }

  async updateAddress(uid: string, id: string, dto: UpdateAddressDto) {
    const { userId } = await this.ownAddress(uid, id);
    if (dto.isDefault) {
      await this.prisma.address.updateMany({ where: { userId }, data: { isDefault: false } });
    }
    return this.prisma.address.update({ where: { id }, data: dto });
  }

  async setDefaultAddress(uid: string, id: string) {
    const { userId } = await this.ownAddress(uid, id);
    await this.prisma.address.updateMany({ where: { userId }, data: { isDefault: false } });
    return this.prisma.address.update({ where: { id }, data: { isDefault: true } });
  }

  async removeAddress(uid: string, id: string) {
    const { userId, address } = await this.ownAddress(uid, id);
    await this.prisma.address.delete({ where: { id } });
    if (address.isDefault) {
      const next = await this.prisma.address.findFirst({ where: { userId }, orderBy: { createdAt: 'desc' } });
      if (next) await this.prisma.address.update({ where: { id: next.id }, data: { isDefault: true } });
    }
    return { id };
  }
}
