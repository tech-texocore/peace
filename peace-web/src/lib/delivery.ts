export interface DeliveryMethod { key: string; label: string; fee: number; days: number }
export interface DeliveryRules { freeForAll: boolean; freeShippingThreshold: number }

// Mirrors the server rule so the cart and checkout show exactly what will be charged.
export function qualifiesForFreeDelivery(rules: DeliveryRules, orderTotal: number, couponFree = false) {
  if (couponFree || rules.freeForAll) return true;
  return rules.freeShippingThreshold > 0 && orderTotal >= rules.freeShippingThreshold;
}
