import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AUDIT_KEY, type AuditMeta } from '../decorators/audit.decorator';
import type { AuthUser } from '../decorators/current-user.decorator';
import { AuditService } from '../../modules/audit/audit.service';

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
// Only money & fulfilment events are audited — orders, payments and shipping/courier.
// Catalog/marketing/config edits are intentionally NOT recorded here.
const AUDITED_RESOURCES = new Set(['orders', 'payments', 'shipping', 'courier', 'bharatship']);
const VERB: Record<string, string> = { POST: 'create', PUT: 'update', PATCH: 'update', DELETE: 'delete' };

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly audit: AuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest();
    const user = req.user as AuthUser | undefined;
    const resourceForGate = (req.path || req.url).replace(/^\/api\//, '').split('/')[0] || '';
    const shouldAudit = MUTATING.has(req.method) && !!user?.uid && AUDITED_RESOURCES.has(resourceForGate);

    if (!shouldAudit) return next.handle();

    const meta = this.reflector.get<AuditMeta>(AUDIT_KEY, context.getHandler());

    return next.handle().pipe(
      tap(() => {
        const res = context.switchToHttp().getResponse();
        const resource = (req.path || req.url).replace(/^\/api\//, '').split('/')[0] || 'unknown';
        this.audit.record({
          storeId: user!.storeId ?? null,
          actorId: user!.uid,
          actorEmail: user!.email ?? null,
          actorRole: user!.role ?? null,
          action: meta?.action ?? `${resource}.${VERB[req.method] ?? req.method.toLowerCase()}`,
          entity: meta?.entity ?? resource,
          entityId: req.params?.id ?? null,
          method: req.method,
          path: req.path || req.url,
          status: res.statusCode,
          ip: req.ip ?? null,
          userAgent: req.headers?.['user-agent'] ?? null,
        });
      }),
    );
  }
}
