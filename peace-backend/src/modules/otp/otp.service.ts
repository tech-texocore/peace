import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomInt } from 'crypto';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { NotificationsService } from '../../infra/notifications/notifications.service';

@Injectable()
export class OtpService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly notifications: NotificationsService,
  ) {}

  private hash(code: string): string {
    return createHash('sha256').update(code).digest('hex');
  }

  async request(phone: string, purpose = 'phone_verify') {
    const length = this.config.get<number>('otp.length')!;
    const ttl = this.config.get<number>('otp.ttlSeconds')!;
    const code = String(randomInt(0, 10 ** length)).padStart(length, '0');

    await this.prisma.otpChallenge.updateMany({
      where: { phone, purpose, consumed: false },
      data: { consumed: true },
    });
    await this.prisma.otpChallenge.create({
      data: { phone, purpose, codeHash: this.hash(code), expiresAt: new Date(Date.now() + ttl * 1000) },
    });

    await this.notifications.sendSms(phone, `Your Peace verification code is ${code}. Valid for ${ttl / 60} minutes.`);

    const isDev = this.config.get<string>('app.env') !== 'production';
    return { sent: true, expiresInSeconds: ttl, ...(isDev ? { devCode: code } : {}) };
  }

  async verify(phone: string, code: string, purpose = 'phone_verify'): Promise<void> {
    const challenge = await this.prisma.otpChallenge.findFirst({
      where: { phone, purpose, consumed: false },
      orderBy: { createdAt: 'desc' },
    });
    if (!challenge) throw new BadRequestException('No verification in progress');
    if (challenge.expiresAt < new Date()) throw new BadRequestException('Code expired');
    if (challenge.attempts >= this.config.get<number>('otp.maxAttempts')!) {
      throw new BadRequestException('Too many attempts, request a new code');
    }
    if (challenge.codeHash !== this.hash(code)) {
      await this.prisma.otpChallenge.update({ where: { id: challenge.id }, data: { attempts: { increment: 1 } } });
      throw new BadRequestException('Invalid code');
    }
    await this.prisma.otpChallenge.update({ where: { id: challenge.id }, data: { consumed: true } });
  }
}
