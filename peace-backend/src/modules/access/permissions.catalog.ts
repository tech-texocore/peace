export type PermissionAction = "create" | "read" | "update" | "delete" | "publish";

export interface PermissionModule {
  key: string;
  label: string;
  route: string;
  actions: PermissionAction[];
}

// Each admin feature/module and the actions it supports. Permission keys are
// `${module}.${action}`. The Super Admin grants these per role.
export const PERMISSION_MODULES: PermissionModule[] = [
  { key: "config", label: "Site Config", route: "/admin/config", actions: ["read", "update", "publish"] },
  { key: "sellers", label: "Sellers", route: "/admin/sellers", actions: ["create", "read", "update", "delete"] },
  { key: "products", label: "Products", route: "/admin/products", actions: ["create", "read", "update", "delete"] },
  { key: "categories", label: "Categories", route: "/admin/categories", actions: ["create", "read", "update", "delete"] },
  { key: "brands", label: "Brands", route: "/admin/brands", actions: ["create", "read", "update", "delete"] },
  { key: "collections", label: "Collections", route: "/admin/collections", actions: ["create", "read", "update", "delete"] },
  { key: "inventory", label: "Inventory & Warehouse", route: "/admin/inventory", actions: ["create", "read", "update", "delete"] },
  { key: "masters", label: "Masters", route: "/admin/masters", actions: ["create", "read", "update", "delete"] },
  { key: "orders", label: "Orders", route: "/admin/orders", actions: ["read", "update"] },
  { key: "discounts", label: "Discounts & Promotions", route: "/admin/discounts", actions: ["create", "read", "update", "delete"] },
  { key: "customers", label: "Customers", route: "/admin/customers", actions: ["read", "update"] },
  { key: "customergroups", label: "Customer Groups", route: "/admin/customer-groups", actions: ["create", "read", "update", "delete"] },
  { key: "reviews", label: "Reviews", route: "/admin/reviews", actions: ["read", "update", "delete"] },
  { key: "subscriptions", label: "Subscriptions", route: "/admin/subscriptions", actions: ["read"] },
  { key: "campaigns", label: "Campaigns", route: "/admin/campaigns", actions: ["create", "read", "update", "delete"] },
  { key: "settings", label: "Store Settings", route: "/admin/settings", actions: ["read", "update"] },
  { key: "integrations", label: "Integrations", route: "/admin/integrations", actions: ["read", "update"] },
  { key: "roles", label: "Roles & Permissions", route: "/admin/roles", actions: ["create", "read", "update", "delete"] },
  { key: "admins", label: "Admins", route: "/admin/admins", actions: ["create", "read", "update", "delete"] },
  { key: "audit", label: "Audit Log", route: "/admin/audit", actions: ["read"] },
  { key: "analytics", label: "Analytics", route: "/admin/analytics", actions: ["read"] },
];

export const ALL_PERMISSION_KEYS: string[] = PERMISSION_MODULES.flatMap((m) =>
  m.actions.map((a) => `${m.key}.${a}`),
);

export const WILDCARD = "*";

// Store Admin: everything except platform-only administration (roles, admins, audit).
export const DEFAULT_ADMIN_PERMISSIONS: string[] = ALL_PERMISSION_KEYS.filter(
  (k) => !k.startsWith("roles.") && !k.startsWith("admins.") && !k.startsWith("audit."),
);

// Staff: read-only on operational modules.
export const DEFAULT_STAFF_PERMISSIONS: string[] = [
  "config.read",
  "sellers.read",
  "products.read",
  "categories.read",
  "brands.read",
  "collections.read",
  "masters.read",
  "inventory.read",
  "orders.read",
  "customers.read",
  "reviews.read",
];
