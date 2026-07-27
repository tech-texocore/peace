import { cn } from "@/lib/utils/cn";
import { space } from "@/lib/tokens";
import { Container } from "./container";
import type { ReactNode } from "react";

interface SectionProps {
  children: ReactNode;
  className?: string;
  containerClassName?: string;
  tight?: boolean;
  /** Render full-bleed without the Container frame. */
  bleed?: boolean;
}

export function Section({
  children,
  className,
  containerClassName,
  tight,
  bleed,
}: SectionProps) {
  return (
    <section className={cn(tight ? space.sectionTight : space.section, className)}>
      {bleed ? children : <Container className={containerClassName}>{children}</Container>}
    </section>
  );
}
