import type { ReactNode } from "react";

export interface PolicySection { heading: string; body: ReactNode }

export function PolicyPage({ title, intro, sections, updated }: { title: string; intro?: string; sections: PolicySection[]; updated?: string }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-5 lg:px-6">
      <h1 className="font-display text-4xl font-medium">{title}</h1>
      {updated && <p className="mt-2 text-xs uppercase tracking-widest text-muted">Last updated · {updated}</p>}
      {intro && <p className="mt-4 text-base leading-relaxed text-muted">{intro}</p>}
      <div className="mt-8 space-y-8">
        {sections.map((s) => (
          <section key={s.heading}>
            <h2 className="font-display text-lg font-medium">{s.heading}</h2>
            <div className="mt-2 space-y-2 text-sm leading-relaxed text-muted">{s.body}</div>
          </section>
        ))}
      </div>
    </div>
  );
}
