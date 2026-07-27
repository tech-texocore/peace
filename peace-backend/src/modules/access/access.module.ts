import { Global, Module } from '@nestjs/common';
import { AccessController } from './access.controller';
import { RolesService } from './roles.service';
import { PermissionsService } from './permissions.service';

@Global()
@Module({
  controllers: [AccessController],
  providers: [RolesService, PermissionsService],
  exports: [PermissionsService, RolesService],
})
export class AccessModule {}
