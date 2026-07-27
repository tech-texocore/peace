"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ThumbsUp, BadgeCheck, ImagePlus, X, Loader2, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useAuth } from "@/context/auth-context";
import { api } from "@/lib/api/client";
import { Stars, StarInput } from "./star-rating";
import { Lightbox } from "./lightbox";
import type { ReviewsResponse, Question } from "@/lib/storefront-server";

const fmtDate = (s: string) => new Date(s).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

export function ReviewsSection({ productId, initialAvg, initialCount }: { productId: string; initialAvg: number; initialCount: number }) {
  const { user } = useAuth();
  const [data, setData] = useState<ReviewsResponse | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [sort, setSort] = useState("recent");
  const [filter, setFilter] = useState<{ rating?: number; withPhotos?: boolean; verified?: boolean }>({});
  const [lightbox, setLightbox] = useState<{ url: string }[] | null>(null);
  const [writing, setWriting] = useState(false);
  const [voted, setVoted] = useState<Record<string, number>>({});
  const [eligibility, setEligibility] = useState<{ canReview: boolean; purchased: boolean; alreadyReviewed: boolean } | null>(null);

  const query = useMemo(() => {
    const p = new URLSearchParams();
    if (sort !== "recent") p.set("sort", sort);
    if (filter.rating) p.set("rating", String(filter.rating));
    if (filter.withPhotos) p.set("withPhotos", "true");
    if (filter.verified) p.set("verified", "true");
    return p.toString();
  }, [sort, filter]);

  function reload() {
    api.get<ReviewsResponse>(`/reviews/product/${productId}${query ? "?" + query : ""}`).then(setData).catch(() => setData({ summary: { average: 0, count: 0, breakdown: {}, verifiedCount: 0 }, reviews: [] }));
  }

  useEffect(reload, [productId, query]);
  useEffect(() => { api.get<Question[]>(`/reviews/product/${productId}/questions`).then(setQuestions).catch(() => {}); }, [productId]);
  useEffect(() => {
    if (!user) { setEligibility(null); return; }
    api.get<{ canReview: boolean; purchased: boolean; alreadyReviewed: boolean }>(`/reviews/product/${productId}/eligibility`, { auth: true }).then(setEligibility).catch(() => setEligibility({ canReview: false, purchased: false, alreadyReviewed: false }));
  }, [productId, user]);

  const summary = data?.summary ?? { average: initialAvg, count: initialCount, breakdown: {}, verifiedCount: 0 };
  const reviews = data?.reviews ?? [];
  const total = summary.count || initialCount;

  async function vote(id: string) {
    if (!user) return;
    try { const r = await api.post<{ helpfulCount: number }>(`/reviews/${id}/helpful`, {}, { auth: true }); setVoted((v) => ({ ...v, [id]: r.helpfulCount })); } catch { /* already voted */ }
  }

  return (
    <section id="reviews" className="mt-14 border-t border-line pt-10">
      <h2 className="mb-6 font-display text-2xl font-medium">Ratings &amp; reviews</h2>

      {/* Summary + breakdown */}
      <div className="grid gap-8 rounded-2xl border border-line p-5 sm:grid-cols-[200px_1fr] sm:p-6">
        <div className="flex flex-col items-center justify-center border-b border-line pb-5 text-center sm:border-b-0 sm:border-r sm:pb-0 sm:pr-6">
          <span className="text-4xl font-semibold">{summary.average.toFixed(1)}</span>
          <Stars value={summary.average} size={18} className="mt-1" />
          <span className="mt-1 text-sm text-muted">{total} rating{total === 1 ? "" : "s"}</span>
          {summary.verifiedCount > 0 && <span className="mt-2 inline-flex items-center gap-1 text-xs text-accent"><BadgeCheck className="h-3.5 w-3.5" /> {summary.verifiedCount} verified</span>}
        </div>
        <div className="space-y-1.5">
          {[5, 4, 3, 2, 1].map((n) => {
            const c = summary.breakdown?.[n] ?? 0;
            const pct = total ? Math.round((c / total) * 100) : 0;
            const on = filter.rating === n;
            return (
              <button key={n} onClick={() => setFilter((f) => ({ ...f, rating: on ? undefined : n }))} className={cn("flex w-full items-center gap-3 rounded-lg px-2 py-1 text-sm hover:bg-accent-soft", on && "bg-accent-soft")}>
                <span className="w-10 shrink-0 text-left text-muted">{n} ★</span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-line"><span className="block h-full rounded-full bg-amber-500" style={{ width: `${pct}%` }} /></span>
                <span className="w-8 shrink-0 text-right text-xs text-muted">{c}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Toolbar */}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <button onClick={() => setFilter((f) => ({ ...f, withPhotos: !f.withPhotos }))} className={cn("rounded-full border px-3 py-1.5 text-xs", filter.withPhotos ? "border-accent bg-accent text-accent-foreground" : "border-line hover:bg-accent-soft")}>With photos</button>
        <button onClick={() => setFilter((f) => ({ ...f, verified: !f.verified }))} className={cn("rounded-full border px-3 py-1.5 text-xs", filter.verified ? "border-accent bg-accent text-accent-foreground" : "border-line hover:bg-accent-soft")}>Verified only</button>
        {(filter.rating || filter.withPhotos || filter.verified) && <button onClick={() => setFilter({})} className="text-xs text-accent hover:underline">Clear</button>}
        <div className="ml-auto flex items-center gap-2">
          <div className="relative">
            <select value={sort} onChange={(e) => setSort(e.target.value)} className="h-9 appearance-none rounded-full border border-line bg-card pl-4 pr-9 text-sm outline-none focus:border-accent">
              <option value="recent">Most recent</option>
              <option value="helpful">Most helpful</option>
              <option value="high">Highest rated</option>
              <option value="low">Lowest rated</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          </div>
          <button onClick={() => setWriting((w) => !w)} className="h-9 rounded-full bg-accent px-4 text-sm font-medium text-accent-foreground hover:opacity-90">Write a review</button>
        </div>
      </div>

      {writing && (
        !user ? <SignInPrompt /> :
        eligibility === null ? <Note>Checking if you can review…</Note> :
        eligibility.alreadyReviewed ? <Note>You’ve already reviewed this product. Thank you!</Note> :
        !eligibility.purchased ? <Note>Only customers who purchased this product can write a review.</Note> :
        <WriteReview productId={productId} onDone={(reloadNeeded) => { setWriting(false); setEligibility((e) => e && { ...e, alreadyReviewed: true, canReview: false }); if (reloadNeeded) reload(); }} />
      )}

      {/* Reviews list */}
      <div className="mt-6 divide-y divide-line">
        {reviews.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted">No reviews yet. Be the first to review this product.</p>
        ) : reviews.map((r) => (
          <article key={r.id} className="py-5">
            <div className="flex items-center gap-3">
              {r.avatar ? <img src={r.avatar} alt="" className="h-9 w-9 rounded-full object-cover" /> : <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-soft text-sm font-medium text-accent">{r.author[0]}</span>}
              <div>
                <p className="text-sm font-medium">{r.author}{r.isVerifiedPurchase && <span className="ml-2 inline-flex items-center gap-0.5 text-xs font-normal text-accent"><BadgeCheck className="h-3.5 w-3.5" /> Verified purchase</span>}</p>
                <div className="flex items-center gap-2"><Stars value={r.rating} /> <span className="text-xs text-muted">{fmtDate(r.createdAt)}</span></div>
              </div>
            </div>
            {r.title && <p className="mt-3 text-sm font-medium">{r.title}</p>}
            {r.comment && <p className="mt-1 text-sm leading-relaxed text-muted">{r.comment}</p>}
            {r.media.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {r.media.map((m, i) => <button key={i} onClick={() => setLightbox(r.media.map((u) => ({ url: u })))} className="h-16 w-16 overflow-hidden rounded-lg border border-line"><img src={m} alt="" className="h-full w-full object-cover" /></button>)}
              </div>
            )}
            <button onClick={() => vote(r.id)} disabled={!user} className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-xs text-muted hover:bg-accent-soft disabled:opacity-50">
              <ThumbsUp className="h-3.5 w-3.5" /> Helpful ({voted[r.id] ?? r.helpfulCount})
            </button>
          </article>
        ))}
      </div>

      {/* Q&A */}
      <QaBlock productId={productId} questions={questions} user={!!user} onChange={() => api.get<Question[]>(`/reviews/product/${productId}/questions`).then(setQuestions)} />

      {lightbox && <Lightbox media={lightbox} onClose={() => setLightbox(null)} />}
    </section>
  );
}

function SignInPrompt() {
  return (
    <div className="mt-4 rounded-xl border border-dashed border-line p-5 text-center text-sm text-muted">
      Please <Link href="/account" className="font-medium text-accent hover:underline">sign in</Link> to share your review.
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return <div className="mt-4 rounded-xl border border-dashed border-line p-5 text-center text-sm text-muted">{children}</div>;
}

function WriteReview({ productId, onDone }: { productId: string; onDone: (reload: boolean) => void }) {
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState("");
  const [comment, setComment] = useState("");
  const [media, setMedia] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");

  async function pickPhotos(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true); setError("");
    try {
      for (const f of Array.from(files).slice(0, 6 - media.length)) {
        const r = await api.upload<{ url: string }>("/reviews/upload", f, { auth: true });
        setMedia((m) => [...m, r.url]);
      }
    } catch (e) { setError(e instanceof Error ? e.message : "Upload failed"); }
    finally { setUploading(false); }
  }

  async function submit() {
    if (!rating) { setError("Please select a rating"); return; }
    setSubmitting(true); setError("");
    try {
      const r = await api.post<{ pending: boolean }>("/reviews", { productId, rating, title: title || undefined, comment: comment || undefined, media }, { auth: true });
      if (r.pending) { setNote("Thanks! Your review will appear once approved."); setTimeout(() => onDone(false), 1800); }
      else onDone(true);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not submit"); }
    finally { setSubmitting(false); }
  }

  if (note) return <div className="mt-4 rounded-xl border border-accent/40 bg-accent-soft/30 p-5 text-center text-sm text-accent">{note}</div>;

  return (
    <div className="mt-4 space-y-3 rounded-xl border border-line p-5">
      <div><p className="mb-1 text-sm font-medium">Your rating</p><StarInput value={rating} onChange={setRating} /></div>
      <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="Title (optional)" className="h-10 w-full rounded-lg border border-line bg-canvas px-3 text-sm outline-none focus:border-accent" />
      <textarea value={comment} onChange={(e) => setComment(e.target.value)} maxLength={2000} rows={3} placeholder="Share details of your experience with this product" className="w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm outline-none focus:border-accent" />
      <div className="flex flex-wrap items-center gap-2">
        {media.map((m, i) => (
          <span key={i} className="relative h-16 w-16 overflow-hidden rounded-lg border border-line">
            <img src={m} alt="" className="h-full w-full object-cover" />
            <button onClick={() => setMedia((arr) => arr.filter((_, k) => k !== i))} className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-0.5 text-white"><X className="h-3 w-3" /></button>
          </span>
        ))}
        {media.length < 6 && (
          <label className="flex h-16 w-16 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-line text-muted hover:bg-accent-soft">
            {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
            <input type="file" accept="image/*" multiple hidden onChange={(e) => pickPhotos(e.target.files)} />
          </label>
        )}
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="flex gap-2">
        <button onClick={submit} disabled={submitting} className="h-10 rounded-full bg-accent px-6 text-sm font-medium text-accent-foreground hover:opacity-90 disabled:opacity-50">{submitting ? "Submitting…" : "Submit review"}</button>
        <button onClick={() => onDone(false)} className="h-10 rounded-full border border-line px-5 text-sm hover:bg-accent-soft">Cancel</button>
      </div>
    </div>
  );
}

function QaBlock({ productId, questions, user, onChange }: { productId: string; questions: Question[]; user: boolean; onChange: () => void }) {
  const [asking, setAsking] = useState("");
  const [answerFor, setAnswerFor] = useState<string | null>(null);
  const [answer, setAnswer] = useState("");

  async function ask() { if (asking.trim().length < 3) return; await api.post("/reviews/questions", { productId, body: asking }, { auth: true }); setAsking(""); onChange(); }
  async function sendAnswer(id: string) { if (!answer.trim()) return; await api.post(`/reviews/questions/${id}/answers`, { body: answer }, { auth: true }); setAnswer(""); setAnswerFor(null); onChange(); }

  return (
    <div className="mt-12 border-t border-line pt-8">
      <h3 className="mb-4 font-display text-xl font-medium">Questions &amp; answers</h3>
      {user ? (
        <div className="mb-6 flex gap-2">
          <input value={asking} onChange={(e) => setAsking(e.target.value)} placeholder="Have a question about this product?" className="h-10 flex-1 rounded-full border border-line bg-canvas px-4 text-sm outline-none focus:border-accent" />
          <button onClick={ask} className="h-10 rounded-full bg-accent px-5 text-sm font-medium text-accent-foreground hover:opacity-90">Ask</button>
        </div>
      ) : <p className="mb-6 text-sm text-muted"><Link href="/account" className="font-medium text-accent hover:underline">Sign in</Link> to ask a question.</p>}

      {questions.length === 0 ? <p className="text-sm text-muted">No questions yet.</p> : (
        <ul className="space-y-5">
          {questions.map((q) => (
            <li key={q.id}>
              <p className="text-sm font-medium">Q: {q.body}</p>
              <ul className="mt-2 space-y-1.5 pl-4">
                {q.answers.map((a) => (
                  <li key={a.id} className="text-sm text-muted">A: {a.body} <span className="text-xs">— {a.isSeller ? "Seller" : a.author}</span></li>
                ))}
              </ul>
              {user && (answerFor === q.id ? (
                <div className="mt-2 flex gap-2 pl-4">
                  <input value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Your answer" className="h-9 flex-1 rounded-full border border-line bg-canvas px-3 text-sm outline-none focus:border-accent" />
                  <button onClick={() => sendAnswer(q.id)} className="h-9 rounded-full bg-accent px-4 text-xs font-medium text-accent-foreground">Post</button>
                </div>
              ) : <button onClick={() => setAnswerFor(q.id)} className="mt-1 pl-4 text-xs font-medium text-accent hover:underline">Answer</button>)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
