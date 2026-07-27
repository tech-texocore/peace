import { SetMetadata } from '@nestjs/common';
import type { AdminRole } from './current-user.decorator';

export const ROLES_KEY = 'roles';

// Restricts a route to the given admin roles (used with RolesGuard).
export const Roles = (...roles: AdminRole[]) => SetMetadata(ROLES_KEY, roles);
