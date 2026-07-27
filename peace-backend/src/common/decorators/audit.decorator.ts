import { SetMetadata } from '@nestjs/common';

export const AUDIT_KEY = 'audit';

export interface AuditMeta {
  action: string;
  entity?: string;
}

// Optional — overrides the auto-derived action label for an audited mutation.
export const Audit = (action: string, entity?: string) => SetMetadata(AUDIT_KEY, { action, entity });
