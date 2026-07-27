import type { ComponentType, ReactNode } from "react";

export function EmptyState({ icon: Icon, title, description, action }: {
  icon?: ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-line py-16 text-center">
      {Icon && <Icon className="mx-auto h-8 w-8 text-muted/60" />}
      <p className="mt-3 font-medium">{title}</p>
      {description && <p className="mx-auto mt-1 max-w-sm text-sm text-muted">{description}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}
