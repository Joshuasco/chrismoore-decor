"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Plus, Search } from "lucide-react";
import { Badge, Empty, PageHeader, Panel, Spinner } from "@/components/admin/ui";
import { formatDueDate, invoiceState } from "@/components/invoice/InvoiceDocument";
import { adminFetch } from "@/lib/admin";
import { cn, formatDate, formatNaira } from "@/lib/format";
import type { InvoicePage } from "@/lib/types";

const TABS = [
  { id: "", label: "All" },
  { id: "unpaid", label: "Unpaid" },
  { id: "overdue", label: "Overdue" },
  { id: "paid", label: "Paid" },
  { id: "void", label: "Void" },
];

export default function InvoicesPage() {
  const [data, setData] = useState<InvoicePage | null>(null);
  // Admin pages render after AdminShell mounts, so window is available.
  const [status, setStatus] = useState(() => new URLSearchParams(window.location.search).get("status") ?? "");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);

  const load = useCallback(() => {
    const qs = new URLSearchParams({ page: String(page), limit: "20" });
    if (status) qs.set("status", status);
    if (q.trim()) qs.set("q", q.trim());
    adminFetch<InvoicePage>(`/invoices?${qs}`).then(setData).catch(() => {});
  }, [status, q, page]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  const pages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  return (
    <>
      <PageHeader
        title="Invoices"
        subtitle="Bill customers for custom work and share a secure payment link."
        actions={<Link href="/admin/invoices/new" className="btn-primary btn-sm"><Plus className="h-4 w-4" /> New invoice</Link>}
      />
      <div className="no-scrollbar mb-4 flex gap-1 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.id || "all"}
            onClick={() => { setStatus(t.id); setPage(1); }}
            className={cn("whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs", status === t.id ? "bg-ink text-white" : "bg-white text-stone ring-1 ring-line hover:text-ink")}
          >
            {t.label}
          </button>
        ))}
      </div>
      <Panel>
        <div className="border-b border-line p-4">
          <div className="flex items-center gap-2 rounded-md border border-line px-3">
            <Search className="h-4 w-4 text-mist" />
            <input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Search invoice number, customer, phone or email" className="w-full py-2 text-sm outline-none" />
          </div>
        </div>
        {!data ? (
          <Spinner />
        ) : data.items.length === 0 ? (
          <Empty>
            {status || q ? "No invoices match these filters." : <>No invoices yet. <Link href="/admin/invoices/new" className="text-bronze hover:underline">Create your first invoice</Link>.</>}
          </Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-cream/60 text-left text-xs text-stone">
                <tr>
                  <th className="px-5 py-3 font-medium">Invoice</th>
                  <th className="px-3 py-3 font-medium">Customer</th>
                  <th className="px-3 py-3 font-medium">Due</th>
                  <th className="px-3 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {data.items.map((inv) => (
                  <tr key={inv.id} className="hover:bg-cream/50">
                    <td className="px-5 py-3">
                      <Link href={`/admin/invoices/${inv.id}`} className="font-medium hover:text-bronze">{inv.number}</Link>
                      <p className="text-xs text-mist">{formatDate(inv.created_at)}{inv.created_by_name && ` · ${inv.created_by_name}`}</p>
                    </td>
                    <td className="px-3 py-3">
                      <p>{inv.customer_name}</p>
                      <p className="text-xs text-mist">{inv.phone || inv.email}</p>
                    </td>
                    <td className="px-3 py-3 text-stone">{inv.due_date ? formatDueDate(inv.due_date) : "—"}</td>
                    <td className="px-3 py-3"><Badge value={invoiceState(inv)} /></td>
                    <td className="px-5 py-3 text-right font-medium">{formatNaira(inv.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data && pages > 1 && (
          <div className="flex items-center justify-between border-t border-line px-5 py-3 text-sm">
            <span className="text-stone">Page {page} of {pages} · {data.total} invoices</span>
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
