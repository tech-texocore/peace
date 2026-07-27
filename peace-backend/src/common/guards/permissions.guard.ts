import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/require-permissions.decorator';
import type { AuthUser } from '../decorators/current-user.decorator';
import { PermissionsService } from '../../modules/access/permissions.service';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissions: PermissionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthUser | undefined;
    if (!user?.uid) throw new ForbiddenException('Not authenticated');
    if (user.role === 'SUPER_ADMIN') return true;

    const granted = await this.permissions.getForUid(user.uid);
    const ok = required.every((p) => this.permissions.has(granted, p));
    if (!ok) throw new ForbiddenException('Missing required permission');

    request.permissions = granted;
    return true;
  }
}
