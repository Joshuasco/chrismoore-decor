"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { BadgeCheck, Check, ExternalLink, Search, Trash2, X } from "lucide-react";
import { Badge, Empty, PageHeader, Panel, Spinner } from "@/components/admin/ui";
import Stars from "@/components/store/Stars";
import { adminFetch } from "@/lib/admin";
import { cn, formatDate } from "@/lib/format";
import type { Review, ReviewPage } from "@/lib/types";

const TABS = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "", label: "All" },
];

export default function AdminReviewsPage() {
  const [data, setData] = useState<ReviewPage | null>(null);
  const [status, setStatus] = useState("pending");
  const [rating, setRating] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState("");

  const load = useCallback(() => {
    const qs = new URLSearchParams({ page: String(page), limit: "20" });
    if (status) qs.set("status", status);
    if (rating) qs.set("rating", rating);
    if (q.trim()) qs.set("q", q.trim());
    adminFetch<ReviewPage>(`/reviews?${qs}`).then(setData).catch(() => {});
  }, [status, rating, q, page]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  const setReviewStatus = async (r: Review, next: "approved" | "rejected") => {
    setBusy(r.id);
    try {
      await adminFetch(`/reviews/${r.id}`, { method: "PATCH", body: JSON.stringify({ status: next }) });
      toast.success(next === "approved" ? "Review approved — it's now live and counted in the rating" : "Review rejected");
      load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy("");
    }
  };

  const remove = async (r: Review) => {
    if (!confirm(`Delete the review by ${r.name}? This can't be undone.`)) return;
    setBusy(r.id);
    try {
      await adminFetch(`/reviews/${r.id}`, { method: "DELETE" });
      toast.success("Review deleted");
      load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy("");
    }
  };

  const pages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  return (
    <>
      <PageHeader title="Reviews" subtitle="Approve customer reviews before they go live. Product ratings are calculated from approved reviews." />
      <div className="mb-4 flex flex-wrap gap-1">
        {TABS.map((t) => (
          <button
            key={t.value || "all"}
            onClick={() => { setStatus(t.value); setPage(1); }}
            className={cn("rounded-full px-3.5 py-1.5 text-xs", status === t.value ? "bg-ink text-white" : "bg-white text-stone ring-1 ring-line hover:text-ink")}
          >
            {t.label}
          </button>
        ))}
      </div>
      <Panel>
        <div className="flex flex-wrap gap-3 border-b border-line p-4">
          <div className="flex min-w-60 flex-1 items-center gap-2 rounded-md border border-line px-3">
            <Search className="h-4 w-4 text-mist" />
            <input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Search reviewer, email, product or text" className="w-full py-2 text-sm outline-none" />
          </div>
          <select value={rating} onChange={(e) => { setRating(e.target.value); setPage(1); }} className="input w-auto">
            <option value="">All ratings</option>
            {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} star{n > 1 ? "s" : ""}</option>)}
          </select>
        </div>
        {!data ? (
          <Spinner />
        ) : data.items.length === 0 ? (
          <Empty>{status === "pending" ? "No reviews waiting for approval." : "No reviews match these filters."}</Empty>
        ) : (
          <ul className="divide-y divide-line">
            {data.items.map((r) => (
              <li key={r.id} className={cn("flex flex-col gap-4 p-5 sm:flex-row", busy === r.id && "opacity-50")}>
                <Link href={`/admin/products/${r.product_id}`} className="flex shrink-0 items-center gap-3 sm:w-52 sm:items-start">
                  <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md bg-sand">
                    {r.product_image && <Image src={r.product_image} alt="" fill sizes="48px" className="object-cover" />}
                  </div>
                  <p className="text-sm font-medium leading-snug hover:text-bronze">{r.product_name}</p>
                </Link>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Stars rating={r.rating} size={14} />
                    {r.status && <Badge value={r.status} />}
                    {r.verified && <span className="flex items-center gap-1 text-xs text-emerald-700"><BadgeCheck className="h-3.5 w-3.5" /> Verified buyer</span>}
                  </div>
                  {r.title && <p className="mt-2 font-medium">{r.title}</p>}
                  <p className="mt-1 whitespace-pre-line text-sm text-cocoa">{r.body}</p>
                  <p className="mt-2 text-xs text-mist">
                    {r.name}{r.email && <> · <a href={`mailto:${r.email}`} className="hover:text-bronze">{r.email}</a></>} · {formatDate(r.created_at, true)}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1.5 sm:flex-col">
                  {r.status !== "approved" && (
                    <button onClick={() => setReviewStatus(r, "approved")} disabled={!!busy} className="btn-primary btn-sm">
                      <Check className="h-4 w-4" /> Approve
                    </button>
                  )}
                  {r.status !== "rejected" && (
                    <button onClick={() => setReviewStatus(r, "rejected")} disabled={!!busy} className="btn-outline btn-sm">
                      <X className="h-4 w-4" /> Reject
                    </button>
                  )}
                  <div className="flex gap-1.5">
                    {r.product_slug && (
                      <Link href={`/product/${r.product_slug}#reviews`} target="_blank" className="rounded p-2 hover:bg-sand" aria-label="View on product page">
                        <ExternalLink className="h-4 w-4" />
                      </Link>
                    )}
                    <button onClick={() => remove(r)} disabled={!!busy} className="rounded p-2 text-red-700 hover:bg-red-50" aria-label={`Delete review by ${r.name}`}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
        {data && pages > 1 && (
          <div className="flex items-center justify-between border-t border-line px-5 py-3 text-sm">
            <span className="text-stone">Page {page} of {pages} · {data.total} reviews</span>
            <div className="flex gap-2">
              <button className="btn-outline btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
              <button className="btn-outline btn-sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next</button>
            </div>
          </div>
        )}
      </Panel>
    </>
  );
}
