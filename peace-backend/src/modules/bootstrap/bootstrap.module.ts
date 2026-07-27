import { Module } from '@nestjs/common';
import { StoresModule } from '../stores/stores.module';
import { AdminUsersModule } from '../admin-users/admin-users.module';
import { BootstrapController } from './bootstrap.controller';

@Module({
  imports: [StoresModule, AdminUsersModule],
  controllers: [BootstrapController],
})
export class BootstrapModule {}
