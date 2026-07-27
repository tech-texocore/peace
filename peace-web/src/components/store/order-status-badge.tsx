import { cn } from "@/lib/utils/cn";
import { ORDER_STATUS_LABEL, type OrderStatus } from "@/lib/orders";

const STYLES: Record<OrderStatus, string> = {
  PENDING: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
  CONFIRMED: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400",
  PACKED: "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-400",
  SHIPPED: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-400",
  DELIVERED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
  CANCELLED: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400",
  RETURNED: "bg-gray-200 text-gray-700 dark:bg-white/10 dark:text-gray-300",
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", STYLES[status])}>{ORDER_STATUS_LABEL[status]}</span>;
}
