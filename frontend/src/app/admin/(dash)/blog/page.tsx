"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { ExternalLink, Plus, Search, Star, Trash2 } from "lucide-react";
import { Badge, Empty, PageHeader, Panel, Spinner } from "@/components/admin/ui";
import { adminFetch } from "@/lib/admin";
import { cn, formatDate } from "@/lib/format";
import type { BlogPage, BlogPost } from "@/lib/types";

const TABS = [
  { value: "", label: "All" },
  { value: "published", label: "Published" },
  { value: "scheduled", label: "Scheduled" },
  { value: "draft", label: "Drafts" },
];

const stateOf = (p: BlogPost) =>
  p.status === "draft" ? "draft" : p.published_at && new Date(p.published_at) > new Date() ? "scheduled" : "published";

export default function AdminBlogPage() {
  const [data, setData] = useState<BlogPage | null>(null);
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);

  const load = useCallback(() => {
    const qs = new URLSearchParams({ page: String(page), limit: "20" });
    if (status) qs.set("status", status);
    if (q.trim()) qs.set("q", q.trim());
    adminFetch<BlogPage>(`/blog?${qs}`).then(setData).catch(() => {});
  }, [status, q, page]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  const remove = async (p: BlogPost) => {
    if (!confirm(`Delete “${p.title}”? This can't be undone.`)) return;
    try {
      await adminFetch(`/blog/${p.id}`, { method: "DELETE" });
      toast.success("Post deleted");
      load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const pages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  return (
    <>
      <PageHeader
        title="Blog"
        subtitle="Write guides and inspiration that bring shoppers to the store."
        actions={<Link href="/admin/blog/new" className="btn-primary btn-sm"><Plus className="h-4 w-4" /> New post</Link>}
      />
      <div className="mb-4 flex gap-1">
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
        <div className="border-b border-line p-4">
          <div className="flex items-center gap-2 rounded-md border border-line px-3">
            <Search className="h-4 w-4 text-mist" />
            <input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Search posts" className="w-full py-2 text-sm outline-none" />
          </div>
        </div>
        {!data ? (
          <Spinner />
        ) : data.items.length === 0 ? (
          <Empty>
            No posts yet. <Link href="/admin/blog/new" className="text-bronze hover:underline">Write your first article</Link>.
          </Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-cream/60 text-left text-xs text-stone">
                <tr>
                  <th className="px-5 py-3 font-medium">Post</th>
                  <th className="px-3 py-3 font-medium">Category</th>
                  <th className="px-3 py-3 font-medium">Status</th>
                  <th className="px-3 py-3 font-medium">Publish date</th>
                  <th className="px-5 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {data.items.map((p) => {
                  const state = stateOf(p);
                  return (
                    <tr key={p.id} className="hover:bg-cream/50">
                      <td className="px-5 py-3">
                        <Link href={`/admin/blog/${p.id}`} className="flex items-center gap-3">
                          <div className="relative h-11 w-16 shrink-0 overflow-hidden rounded bg-sand">
                            {p.cover_image && <Image src={p.cover_image} alt="" fill sizes="64px" className="object-cover" />}
                          </div>
                          <div className="min-w-0">
                            <p className="flex items-center gap-1.5 font-medium hover:text-bronze">
                              {p.is_featured && <Star className="h-3.5 w-3.5 shrink-0 fill-bronze text-bronze" aria-label="Featured" />}
                              <span className="truncate">{p.title}</span>
                            </p>
                            <p className="text-xs text-mist">{p.reading_minutes} min read · updated {formatDate(p.updated_at)}</p>
                          </div>
                        </Link>
                      </td>
                      <td className="px-3 py-3 text-stone">{p.category}</td>
                      <td className="px-3 py-3"><Badge value={state} /></td>
                      <td className="px-3 py-3 text-stone">{p.published_at ? formatDate(p.published_at, true) : "—"}</td>
                      <td className="px-5 py-3">
                        <div className="flex justify-end gap-1">
                          {state === "published" && (
                            <Link href={`/blog/${p.slug}`} target="_blank" className="rounded p-2 hover:bg-sand" aria-label={`View ${p.title}`}>
                              <ExternalLink className="h-4 w-4" />
                            </Link>
                          )}
                          <button onClick={() => remove(p)} className="rounded p-2 text-red-700 hover:bg-red-50" aria-label={`Delete ${p.title}`}>
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {data && pages > 1 && (
          <div className="flex items-center justify-between border-t border-line px-5 py-3 text-sm">
            <span className="text-stone">Page {page} of {pages}</span>
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
