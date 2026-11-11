"use client";

import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { BadgeCheck, Loader2, PenLine, Star, X } from "lucide-react";
import Stars from "./Stars";
import { getReviews, submitReview } from "@/lib/api";
import { getLocalDemoReviews, isDemoId } from "@/lib/demo";
import { cn, formatDate } from "@/lib/format";
import type { Review, ReviewPage } from "@/lib/types";

type Props = { productId: string; slug: string; productName: string; initial: ReviewPage };

const SORTS = [
  { value: "", label: "Most recent" },
  { value: "highest", label: "Highest rated" },
  { value: "lowest", label: "Lowest rated" },
];

export default function ProductReviews({ productId, slug, productName, initial }: Props) {
  const [data, setData] = useState(initial);
  const [rating, setRating] = useState(0);
  const [sort, setSort] = useState("");
  const [loading, setLoading] = useState<"list" | "more" | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [mine, setMine] = useState<Review[]>([]); // demo-mode reviews written in this browser
  const listRef = useRef<HTMLDivElement>(null);
  const { summary } = data;

  useEffect(() => {
    if (isDemoId(productId)) Promise.resolve(getLocalDemoReviews(slug)).then(setMine);
  }, [productId, slug]);

  const reload = async (next: { rating?: number; sort?: string }) => {
    const r = next.rating ?? rating;
    const s = next.sort ?? sort;
    setRating(r);
    setSort(s);
    setLoading("list");
    try {
      setData(await getReviews(slug, productId, { rating: r || undefined, sort: s, page: 1, limit: initial.limit }));
    } finally {
      setLoading(null);
    }
  };

  const loadMore = async () => {
    setLoading("more");
    try {
      const next = await getReviews(slug, productId, { rating: rating || undefined, sort, page: data.page + 1, limit: data.limit });
      setData((d) => ({ ...next, items: [...d.items, ...next.items] }));
    } finally {
      setLoading(null);
    }
  };

  const filterBy = (stars: number) => {
    reload({ rating: rating === stars ? 0 : stars });
    listRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  const max = Math.max(1, ...Object.values(summary.breakdown));

  return (
    <section id="reviews" className="container-x mt-24 scroll-mt-28" aria-labelledby="reviews-heading">
      <p className="eyebrow">Customer reviews</p>
      <h2 id="reviews-heading" className="heading mt-2 text-3xl sm:text-4xl">What our customers say</h2>

      <div className="mt-8 grid gap-8 lg:grid-cols-[340px_1fr] lg:gap-12">
        {/* Summary */}
        <aside className="h-fit rounded-2xl bg-cream p-6 lg:sticky lg:top-28">
          {summary.count > 0 ? (
            <>
              <div className="flex items-end gap-3">
                <p className="font-serif text-6xl font-semibold leading-none">{summary.average.toFixed(1)}</p>
                <div className="pb-1">
                  <Stars rating={summary.average} size={16} />
                  <p className="mt-1 text-xs text-stone">
                    Based on {summary.count} {summary.count === 1 ? "review" : "reviews"}
                  </p>
                </div>
              </div>
              <ul className="mt-6 space-y-2">
                {[5, 4, 3, 2, 1].map((stars) => {
                  const n = summary.breakdown[String(stars)] ?? 0;
                  return (
                    <li key={stars}>
                      <button
                        onClick={() => filterBy(stars)}
                        disabled={n === 0}
                        aria-pressed={rating === stars}
                        aria-label={`Show ${stars}-star reviews (${n})`}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-md px-2 py-1 text-sm transition disabled:cursor-default disabled:opacity-50",
                          rating === stars ? "bg-white shadow-sm" : "enabled:hover:bg-white/70",
                        )}
                      >
                        <span className="flex w-8 items-center gap-0.5 text-cocoa">
                          {stars} <Star className="h-3 w-3 fill-bronze text-bronze" />
                        </span>
                        <span className="h-2 flex-1 overflow-hidden rounded-full bg-oat/70">
                          <span className="block h-full rounded-full bg-bronze" style={{ width: `${(n / max) * 100}%` }} />
                        </span>
                        <span className="w-6 text-right text-xs text-stone">{n}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          ) : (
            <div>
              <Stars rating={0} size={18} />
              <p className="mt-3 font-serif text-2xl font-semibold">No reviews yet</p>
              <p className="mt-1 text-sm text-stone">Bought {productName}? Be the first to share your thoughts.</p>
            </div>
          )}
          <button onClick={() => setFormOpen((v) => !v)} className="btn-primary mt-6 w-full">
            <PenLine className="h-4 w-4" /> {formOpen ? "Close the form" : "Write a review"}
          </button>
        </aside>

        {/* List */}
        <div ref={listRef} className="scroll-mt-28">
          {formOpen && (
            <ReviewForm
              slug={slug}
              productId={productId}
              productName={productName}
              onClose={() => setFormOpen(false)}
              onDemoSaved={(r) => setMine((m) => [r, ...m])}
            />
          )}

          {summary.count > 0 && (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm text-stone">
                {data.total} {data.total === 1 ? "review" : "reviews"}
                {rating > 0 && (
                  <button onClick={() => reload({ rating: 0 })} className="flex items-center gap-1 rounded-full bg-sand px-3 py-1 text-xs text-ink">
                    {rating} star <X className="h-3 w-3" />
                  </button>
                )}
                {loading === "list" && <Loader2 className="h-4 w-4 animate-spin text-bronze" />}
              </div>
              <label className="flex items-center gap-2 text-sm text-stone">
                <span className="hidden sm:inline">Sort by</span>
                <select
                  value={sort}
                  onChange={(e) => reload({ sort: e.target.value })}
                  className="rounded-md border border-line bg-white px-3 py-2 text-sm text-ink focus:border-bronze focus:outline-none"
                >
                  {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </label>
            </div>
          )}

          <ul className={cn("space-y-4 transition-opacity", loading === "list" && "opacity-50")}>
            {mine.map((r) => (
              <ReviewCard key={r.id} review={r} pendingNote="Only visible to you — demo review saved in this browser" />
            ))}
            {data.items.map((r) => (
              <ReviewCard key={r.id} review={r} />
            ))}
          </ul>

          {data.items.length < data.total && (
            <button onClick={loadMore} disabled={!!loading} className="btn-outline mt-6 w-full sm:w-auto">
              {loading === "more" && <Loader2 className="h-4 w-4 animate-spin" />} Show more reviews ({data.total - data.items.length} more)
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

function ReviewCard({ review: r, pendingNote }: { review: Review; pendingNote?: string }) {
  return (
    <li className={cn("rounded-xl border bg-white p-5 sm:p-6", pendingNote ? "border-amber-200" : "border-line")}>
      {pendingNote && <p className="mb-3 rounded bg-amber-50 px-2.5 py-1 text-xs text-amber-900">{pendingNote}</p>}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Stars rating={r.rating} size={15} />
        <time dateTime={r.created_at} className="text-xs text-mist">{formatDate(r.created_at)}</time>
      </div>
      {r.title && <h3 className="mt-3 font-serif text-xl font-semibold">{r.title}</h3>}
      <p className="mt-2 text-[15px] leading-relaxed text-cocoa">{r.body}</p>
      <p className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <span className="flex items-center gap-2 font-medium">
          <span className="grid h-7 w-7 place-items-center rounded-full bg-sand text-xs uppercase text-bronze-dark">{r.name[0]}</span>
          {r.name}
        </span>
        {r.verified && (
          <span className="flex items-center gap-1 text-xs text-whatsapp">
            <BadgeCheck className="h-4 w-4" /> Verified buyer
          </span>
        )}
      </p>
    </li>
  );
}

function ReviewForm({
  slug,
  productId,
  productName,
  onClose,
  onDemoSaved,
}: {
  slug: string;
  productId: string;
  productName: string;
  onClose: () => void;
  onDemoSaved: (r: Review) => void;
}) {
  const [f, setF] = useState({ name: "", email: "", title: "", body: "", website: "" });
  const [stars, setStars] = useState(0);
  const [hover, setHover] = useState(0);
  const [sending, setSending] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF((s) => ({ ...s, [k]: e.target.value }));
  const labels = ["", "Poor", "Fair", "Good", "Very good", "Excellent"];

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stars) {
      toast.error("Please choose a star rating");
      return;
    }
    setSending(true);
    try {
      const res = await submitReview(slug, productId, { ...f, rating: stars });
      toast.success(res.message, { duration: 5000 });
      if (res.demo) {
        onDemoSaved({
          id: `local-${Date.now()}`,
          product_id: productId,
          name: f.name.trim(),
          rating: stars,
          title: f.title.trim(),
          body: f.body.trim(),
          verified: false,
          created_at: new Date().toISOString(),
        });
      }
      onClose();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSending(false);
    }
  };

  return (
    <form onSubmit={submit} className="mb-8 rounded-2xl border border-line bg-white p-6" aria-label={`Review ${productName}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-serif text-2xl font-semibold">Review {productName}</h3>
          <p className="mt-1 text-sm text-stone">Reviews are checked by our team before they appear.</p>
        </div>
        <button type="button" onClick={onClose} className="rounded p-1 hover:bg-sand" aria-label="Close review form">
          <X className="h-5 w-5" />
        </button>
      </div>

      <fieldset className="mt-5">
        <legend className="label">Your rating</legend>
        <div className="flex items-center gap-3" onMouseLeave={() => setHover(0)}>
          <div className="flex" role="radiogroup" aria-label="Star rating">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={stars === n}
                aria-label={`${n} star${n > 1 ? "s" : ""} — ${labels[n]}`}
                onMouseEnter={() => setHover(n)}
                onFocus={() => setHover(n)}
                onBlur={() => setHover(0)}
                onClick={() => setStars(n)}
                className="p-0.5"
              >
                <Star className={cn("h-7 w-7 transition", n <= (hover || stars) ? "fill-bronze text-bronze" : "text-oat")} strokeWidth={1.5} />
              </button>
            ))}
          </div>
          <span className="text-sm text-stone">{labels[hover || stars]}</span>
        </div>
      </fieldset>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="rv-name">Name</label>
          <input id="rv-name" required minLength={2} maxLength={60} className="input" value={f.name} onChange={set("name")} autoComplete="name" placeholder="e.g. Adaeze O." />
        </div>
        <div>
          <label className="label" htmlFor="rv-email">Email <span className="font-normal text-mist">(not published)</span></label>
          <input id="rv-email" type="email" required className="input" value={f.email} onChange={set("email")} autoComplete="email" />
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="rv-title">Review title <span className="font-normal text-mist">(optional)</span></label>
          <input id="rv-title" maxLength={120} className="input" value={f.title} onChange={set("title")} placeholder="Sum it up in a few words" />
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="rv-body">Your review</label>
          <textarea
            id="rv-body"
            required
            minLength={10}
            maxLength={2000}
            rows={5}
            className="input"
            value={f.body}
            onChange={set("body")}
            placeholder="How was the quality, fit and delivery?"
          />
          <p className="mt-1 text-right text-xs text-mist">{f.body.length}/2000</p>
        </div>
        {/* Honeypot for spam bots — hidden from people and screen readers */}
        <input type="text" name="website" value={f.website} onChange={set("website")} tabIndex={-1} autoComplete="off" aria-hidden className="absolute -left-[9999px] h-0 w-0 opacity-0" />
      </div>
      <button className="btn-primary mt-5" disabled={sending}>
        {sending && <Loader2 className="h-4 w-4 animate-spin" />} Submit review
      </button>
    </form>
  );
}
