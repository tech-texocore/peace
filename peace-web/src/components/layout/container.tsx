import { cn } from "@/lib/utils/cn";
import { container } from "@/lib/tokens";
import type { ReactNode } from "react";

export function Container({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn(container, className)}>{children}</div>;
}
