import Link from "next/link";
import { BookOpen } from "lucide-react";

export default function JournalPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-20 text-center sm:px-5 lg:px-6">
      <BookOpen className="mx-auto h-10 w-10 text-accent" />
      <h1 className="mt-4 font-display text-4xl font-medium">The Journal</h1>
      <p className="mt-3 text-base leading-relaxed text-muted">Stories on craft, care and considered living are on their way. Check back soon for our first edit.</p>
      <Link href="/products" className="mt-6 inline-block rounded-full bg-accent px-6 py-3 text-sm font-semibold text-accent-foreground hover:opacity-90">Explore the collection</Link>
    </div>
  );
}
