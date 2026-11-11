"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Loader2, Minus, Plus, Search } from "lucide-react";
import { Empty, Modal, PageHeader, Panel, Spinner, StockBadge } from "@/components/admin/ui";
import { adminFetch } from "@/lib/admin";
import { cn, formatDate, formatNaira } from "@/lib/format";
import type { InventoryMovement, Product, ProductPage } from "@/lib/types";

const REASONS_IN = ["Restock from supplier", "Customer return", "Stock count correction"];
const REASONS_OUT = ["Damaged / defective", "Offline / showroom sale", "Stock count correction", "Sample / display"];

export default function InventoryPage() {
  const [data, setData] = useState<ProductPage | null>(null);
  const [moves, setMoves] = useState<InventoryMovement[]>([]);
  const [q, setQ] = useState("");
  const [lowOnly, setLowOnly] = useState(() => new URLSearchParams(window.location.search).has("low"));
  const [target, setTarget] = useState<Product | null>(null);
  const [dir, setDir] = useState<1 | -1>(1);
  const [qty, setQty] = useState("1");
  const [reason, setReason] = useState(REASONS_IN[0]);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    const qs = new URLSearchParams({ limit: "100", sort: "stock" });
    if (q.trim()) qs.set("q", q.trim());
    if (lowOnly) qs.set("low_stock", "true");
    adminFetch<ProductPage>(`/products?${qs}`).then(setData).catch(() => {});
    adminFetch<InventoryMovement[]>("/inventory/movements?limit=40").then(setMoves).catch(() => {});
  }, [q, lowOnly]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  const open = (p: Product, d: 1 | -1) => {
    setTarget(p);
    setDir(d);
    setQty("1");
    setReason(d === 1 ? REASONS_IN[0] : REASONS_OUT[0]);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!target) return;
    setSaving(true);
    try {
      const p = await adminFetch<Product>(`/products/${target.id}/stock`, {
        method: "POST",
        body: JSON.stringify({ change: dir * Math.abs(Number(qty)), reason }),
      });
      toast.success(`${p.name}: stock now ${p.stock}`);
      setTarget(null);
      load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const totalUnits = data?.items.reduce((n, p) => n + p.stock, 0) ?? 0;
  const totalValue = data?.items.reduce((n, p) => n + p.stock * p.price, 0) ?? 0;

  return (
    <>
      <PageHeader title="Inventory" subtitle="Track stock levels, restocks and every movement." />
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-line bg-white p-4"><p className="text-xs text-stone">Units on hand</p><p className="mt-1 text-2xl font-semibold">{totalUnits.toLocaleString()}</p></div>
        <div className="rounded-xl border border-line bg-white p-4"><p className="text-xs text-stone">Stock value (retail)</p><p className="mt-1 text-2xl font-semibold">{formatNaira(totalValue)}</p></div>
        <div className="rounded-xl border border-line bg-white p-4"><p className="text-xs text-stone">Needs attention</p><p className="mt-1 text-2xl font-semibold">{data?.items.filter((p) => p.stock <= p.low_stock_threshold).length ?? 0}</p></div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        <Panel>
          <div className="flex flex-wrap items-center gap-3 border-b border-line p-4">
            <div className="flex min-w-60 flex-1 items-center gap-2 rounded-md border border-line px-3">
              <Search className="h-4 w-4 text-mist" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or SKU" className="w-full py-2 text-sm outline-none" />
            </div>
            <label className="flex items-center gap-2 text-sm text-stone">
              <input type="checkbox" checked={lowOnly} onChange={(e) => setLowOnly(e.target.checked)} className="h-4 w-4 accent-[#a8875e]" /> Low stock only
            </label>
          </div>
          {!data ? (
            <Spinner />
          ) : data.items.length === 0 ? (
            <Empty>Nothing to show.</Empty>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] text-sm">
                <thead className="bg-cream/60 text-left text-xs text-stone">
                  <tr>
                    <th className="px-5 py-3 font-medium">Product</th>
                    <th className="px-3 py-3 font-medium">Stock</th>
                    <th className="px-3 py-3 font-medium">Alert at</th>
                    <th className="px-5 py-3 text-right font-medium">Adjust</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {data.items.map((p) => (
                    <tr key={p.id} className={cn("hover:bg-cream/50", !p.is_active && "opacity-60")}>
                      <td className="px-5 py-3">
                        <Link href={`/admin/products/${p.id}`} className="flex items-center gap-3">
                          <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded bg-sand">
                            {p.images[0] && <Image src={p.images[0]} alt="" fill sizes="40px" className="object-cover" />}
                          </div>
                          <div>
                            <p className="font-medium hover:text-bronze">{p.name}</p>
                            <p className="text-xs text-mist">{p.sku}</p>
                          </div>
                        </Link>
                      </td>
                      <td className="px-3 py-3"><StockBadge stock={p.stock} threshold={p.low_stock_threshold} /></td>
                      <td className="px-3 py-3 text-stone">{p.low_stock_threshold}</td>
                      <td className="px-5 py-3">
                        <div className="flex justify-end gap-1.5">
                          <button onClick={() => open(p, -1)} disabled={p.stock === 0} className="grid h-8 w-8 place-items-center rounded-md border border-line hover:border-ink disabled:opacity-40" aria-label={`Remove stock from ${p.name}`}>
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => open(p, 1)} className="grid h-8 w-8 place-items-center rounded-md bg-bronze text-white hover:bg-bronze-dark" aria-label={`Add stock to ${p.name}`}>
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <Panel title="Recent movements">
          {moves.length === 0 ? (
            <Empty>No stock movements yet.</Empty>
          ) : (
            <ul className="max-h-[640px] divide-y divide-line overflow-y-auto">
              {moves.map((m) => (
                <li key={m.id} className="flex items-start justify-between gap-3 px-5 py-3 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{m.product_name}</p>
                    <p className="text-xs text-stone">{m.reason}{m.order_reference && ` · ${m.order_reference}`}</p>
                    <p className="text-[11px] text-mist">{formatDate(m.created_at, true)} · {m.actor}</p>
                  </div>
                  <span className={cn("shrink-0 font-semibold tabular-nums", m.change > 0 ? "text-emerald-700" : "text-red-700")}>
                    {m.change > 0 ? `+${m.change}` : m.change}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Modal open={!!target} onClose={() => setTarget(null)} title={dir === 1 ? "Add stock" : "Remove stock"}>
        {target && (
          <form onSubmit={submit} className="space-y-4">
            <p className="text-sm text-stone">{target.name} · currently <b className="text-ink">{target.stock}</b> in stock</p>
            <div>
              <label className="label" htmlFor="qty">Quantity</label>
              <input id="qty" type="number" min="1" max={dir === -1 ? target.stock : undefined} required className="input" value={qty} onChange={(e) => setQty(e.target.value)} autoFocus />
            </div>
            <div>
              <label className="label" htmlFor="reason">Reason</label>
              <select id="reason" className="input" value={reason} onChange={(e) => setReason(e.target.value)}>
                {(dir === 1 ? REASONS_IN : REASONS_OUT).map((r) => <option key={r}>{r}</option>)}
              </select>
            </div>
            <p className="text-sm">New stock level: <b>{Math.max(0, target.stock + dir * Math.abs(Number(qty) || 0))}</b></p>
            <button className="btn-primary w-full" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />} Confirm
            </button>
          </form>
        )}
      </Modal>
    </>
  );
}
