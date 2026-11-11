"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Plus, Search } from "lucide-react";
import { Badge, Empty, PageHeader, Panel, Spinner, StockBadge } from "@/components/admin/ui";
import { adminFetch } from "@/lib/admin";
import { formatNaira } from "@/lib/format";
import type { Category, ProductPage } from "@/lib/types";

export default function ProductsPage() {
  const [data, setData] = useState<ProductPage | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    adminFetch<Category[]>("/categories").then(setCategories).catch(() => {});
  }, []);

  const load = useCallback(() => {
    const qs = new URLSearchParams({ page: String(page), limit: "20", sort: "name" });
    if (q.trim()) qs.set("q", q.trim());
    if (category) qs.set("category", category);
    adminFetch<ProductPage>(`/products?${qs}`).then(setData).catch(() => {});
  }, [q, category, page]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  const pages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  return (
    <>
      <PageHeader
        title="Products"
        subtitle="Your catalogue of curtains, accessories, bedding, blinds and rugs."
        actions={<Link href="/admin/products/new" className="btn-primary btn-sm"><Plus className="h-4 w-4" /> Add product</Link>}
      />
      <Panel>
        <div className="flex flex-wrap gap-3 border-b border-line p-4">
          <div className="flex min-w-60 flex-1 items-center gap-2 rounded-md border border-line px-3">
            <Search className="h-4 w-4 text-mist" />
            <input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Search name or SKU" className="w-full py-2 text-sm outline-none" />
          </div>
          <select value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }} className="input w-auto">
            <option value="">All categories</option>
            {categories.map((c) => <option key={c.id} value={c.slug}>{c.name}</option>)}
          </select>
        </div>
        {!data ? (
          <Spinner />
        ) : data.items.length === 0 ? (
          <Empty>No products found.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-cream/60 text-left text-xs text-stone">
                <tr>
                  <th className="px-5 py-3 font-medium">Product</th>
                  <th className="px-3 py-3 font-medium">Category</th>
                  <th className="px-3 py-3 font-medium">Price</th>
                  <th className="px-3 py-3 font-medium">Stock</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {data.items.map((p) => (
                  <tr key={p.id} className="hover:bg-cream/50">
                    <td className="px-5 py-3">
                      <Link href={`/admin/products/${p.id}`} className="flex items-center gap-3">
                        <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-md bg-sand">
                          {p.images[0] && <Image src={p.images[0]} alt="" fill sizes="44px" className="object-cover" />}
                        </div>
                        <div>
                          <p className="font-medium hover:text-bronze">{p.name}</p>
                          <p className="text-xs text-mist">{p.sku}</p>
                        </div>
                      </Link>
                    </td>
                    <td className="px-3 py-3 text-stone">{p.category_name || "—"}</td>
                    <td className="px-3 py-3">{formatNaira(p.price)}</td>
                    <td className="px-3 py-3"><StockBadge stock={p.stock} threshold={p.low_stock_threshold} /></td>
                    <td className="px-5 py-3">
                      <div className="flex gap-1.5">
                        {p.is_active ? <Badge value="Active" /> : <Badge value="Hidden" />}
                        {p.is_featured && <Badge value="Featured" />}
                      </div>
                    </td>
                  </tr>
                ))}
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
