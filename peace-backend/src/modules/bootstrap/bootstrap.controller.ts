import {
  Body,
  ConflictException,
  Controller,
  Headers,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Public } from '../../common/decorators/public.decorator';
import { StoresService } from '../stores/stores.service';
import { AdminUsersService } from '../admin-users/admin-users.service';
import { BootstrapDto } from './dto/bootstrap.dto';
import { PrismaService } from '../../infra/prisma/prisma.service';

// One-time platform bootstrap: creates the default store and first Super Admin.
// Guarded by the SETUP_SECRET header since no admin exists yet to authorise it.
@Controller('bootstrap')
export class BootstrapController {
  constructor(
    private readonly config: ConfigService,
    private readonly stores: StoresService,
    private readonly adminUsers: AdminUsersService,
    private readonly prisma: PrismaService,
  ) {}

  @Public()
  @Post('super-admin')
  async bootstrap(
    @Headers('x-setup-secret') secret: string,
    @Body() dto: BootstrapDto,
  ) {
    if (secret !== this.config.get<string>('platform.setupSecret')) {
      throw new UnauthorizedException('Invalid setup secret');
    }
    if (await this.prisma.adminUser.count({ where: { role: 'SUPER_ADMIN' } })) {
      throw new ConflictException(
        'Already set up — add more admins from the admin panel',
      );
    }

    const slug = this.config.get<string>('platform.defaultStoreSlug')!;
    const store =
      (await this.stores.findBySlug(slug)) ??
      (await this.stores.create({
        slug,
        name: this.config.get<string>('platform.defaultStoreName')!,
      }));

    const admin = await this.adminUsers.createAdmin({
      email: dto.email,
      password: dto.password,
      name: dto.name,
      role: 'SUPER_ADMIN',
    });

    return {
      store: { id: store.id, slug: store.slug },
      admin: { id: admin.id, email: admin.email },
    };
  }
}
