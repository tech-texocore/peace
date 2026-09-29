// Return / exchange rules: a product's own setting wins, otherwise its seller's default.
// An order qualifies only when every item in it does, and only within the shortest window.
export const POLICY_SELECT = {
  title: true,
  returnable: true,
  returnWindowDays: true,
  exchangeable: true,
  exchangeWindowDays: true,
  seller: { select: { returnable: true, returnWindowDays: true, replacementDays: true } },
} as const;

export interface PolicyProduct {
  title: string;
  returnable: boolean | null;
  returnWindowDays: number | null;
  exchangeable: boolean | null;
  exchangeWindowDays: number | null;
  seller: { returnable: boolean; returnWindowDays: number; replacementDays: number | null };
}

export type AfterSalesType = 'RETURN' | 'EXCHANGE';

// Days allowed after delivery, or null when the product does not accept it.
export function productWindows(p: PolicyProduct): Record<AfterSalesType, number | null> {
  const returnable = p.returnable ?? p.seller.returnable;
  const returnDays = returnable ? (p.returnWindowDays ?? p.seller.returnWindowDays) : null;
  const exchangeable = p.exchangeable ?? (p.seller.replacementDays ?? 0) > 0;
  const exchangeDays = exchangeable ? (p.exchangeWindowDays ?? p.seller.replacementDays) : null;
  return {
    RETURN: returnDays && returnDays > 0 ? returnDays : null,
    EXCHANGE: exchangeDays && exchangeDays > 0 ? exchangeDays : null,
  };
}

export interface AfterSalesOption {
  allowed: boolean;
  until: Date | null;
  reason: string | null;
}

export function afterSalesOption(type: AfterSalesType, products: PolicyProduct[], deliveredAt: Date | null, now = new Date()): AfterSalesOption {
  const label = type === 'RETURN' ? 'returned' : 'exchanged';
  const blocked = products.filter((p) => productWindows(p)[type] == null);
  if (blocked.length) return { allowed: false, until: null, reason: `${blocked.map((p) => p.title).join(', ')} can't be ${label}` };
  if (!deliveredAt) return { allowed: false, until: null, reason: 'Available after delivery' };
  const days = Math.min(...products.map((p) => productWindows(p)[type]!));
  const until = new Date(deliveredAt.getTime() + days * 86_400_000);
  if (now > until) return { allowed: false, until, reason: `The ${days}-day window ended on ${until.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}` };
  return { allowed: true, until, reason: null };
}
