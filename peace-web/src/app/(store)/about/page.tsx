import Link from "next/link";
import { Leaf, Package, ShieldCheck, Sparkles } from "lucide-react";
import { getSiteConfig } from "@/lib/site-config-server";

export const dynamic = "force-dynamic";

const values = [
  { icon: Leaf, title: "Consciously made", text: "Natural fibres and low-impact processes, from loom to doorstep." },
  { icon: Sparkles, title: "Considered design", text: "Timeless pieces meant to be worn and loved for years." },
  { icon: ShieldCheck, title: "Honest quality", text: "Fair pricing, transparent sourcing, no hidden mark-ups." },
  { icon: Package, title: "Calmly delivered", text: "Carefully packed and shipped across India, with easy returns." },
];

export default async function AboutPage() {
  const config = await getSiteConfig();
  const { brand } = config;

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-5 lg:px-6">
      <p className="text-xs font-semibold uppercase tracking-widest text-accent">Our story</p>
      <h1 className="mt-2 font-display text-4xl font-medium">{brand.name}</h1>
      <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted">{brand.tagline}</p>

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        {values.map((v) => (
          <div key={v.title} className="rounded-2xl border border-line p-5">
            <v.icon className="h-6 w-6 text-accent" />
            <h2 className="mt-3 font-medium">{v.title}</h2>
            <p className="mt-1 text-sm text-muted">{v.text}</p>
          </div>
        ))}
      </div>

      <div className="mt-10 rounded-2xl bg-accent-soft/40 p-8 text-center">
        <h2 className="font-display text-2xl font-medium">Ready to explore?</h2>
        <p className="mt-1 text-sm text-muted">Discover textiles thoughtfully made for everyday living.</p>
        <Link href="/products" className="mt-4 inline-block rounded-full bg-accent px-6 py-3 text-sm font-semibold text-accent-foreground hover:opacity-90">Shop the collection</Link>
      </div>
    </div>
  );
}
