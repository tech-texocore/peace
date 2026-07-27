import { Truck, RotateCcw, ShieldCheck, Headphones, type LucideIcon } from "lucide-react";
import { Section } from "@/components/layout/section";
import type { SiteConfig, ValueProp } from "@/lib/site-config";

// Maps serialisable icon keys from config to icon components.
const icons: Record<ValueProp["icon"], LucideIcon> = {
  shipping: Truck,
  returns: RotateCcw,
  secure: ShieldCheck,
  support: Headphones,
};

export function ValueProps({ config }: { config: SiteConfig }) {
  return (
    <Section tight>
      <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">
        {config.valueProps.map((prop) => {
          const Icon = icons[prop.icon];
          return (
            <div key={prop.title} className="flex flex-col items-start gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-accent">
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-display text-lg">{prop.title}</h3>
                <p className="mt-1 text-sm text-muted">{prop.text}</p>
              </div>
            </div>
          );
        })}
      </div>
    </Section>
  );
}
