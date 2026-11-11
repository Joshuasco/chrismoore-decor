"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Search } from "lucide-react";
import { Badge, Empty, PageHeader, Panel, Spinner } from "@/components/admin/ui";
import { adminFetch } from "@/lib/admin";
import { cn, formatDate, formatNaira } from "@/lib/format";
import type { OrderPage } from "@/lib/types";

const STATUS_TABS = ["", "pending", "confirmed", "processing", "shipped", "delivered", "cancelled"];

export default function OrdersPage() {
  const [data, setData] = useState<OrderPage | null>(null);
  // Admin pages render only after AdminShell has mounted, so window is available here.
  const [status, setStatus] = useState(() => new URLSearchParams(window.location.search).get("status") ?? "");
  const [payment, setPayment] = useState("");
  const [channel, setChannel] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);

  const load = useCallback(() => {
    const qs = new URLSearchParams({ page: String(page), limit: "20" });
    if (status) qs.set("status", status);
    if (payment) qs.set("payment_status", payment);
    if (channel) qs.set("channel", channel);
    if (q.trim()) qs.set("q", q.trim());
    adminFetch<OrderPage>(`/orders?${qs}`).then(setData).catch(() => {});
  }, [status, payment, channel, q, page]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  const pages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  return (
    <>
      <PageHeader title="Orders" subtitle="WhatsApp and online orders in one queue." />
      <div className="no-scrollbar mb-4 flex gap-1 overflow-x-auto">
        {STATUS_TABS.map((s) => (
          <button
            key={s || "all"}
            onClick={() => { setStatus(s); setPage(1); }}
            className={cn("whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs capitalize", status === s ? "bg-ink text-white" : "bg-white text-stone ring-1 ring-line hover:text-ink")}
          >
            {s || "All"}
          </button>
        ))}
      </div>
      <Panel>
        <div className="flex flex-wrap gap-3 border-b border-line p-4">
          <div className="flex min-w-60 flex-1 items-center gap-2 rounded-md border border-line px-3">
            <Search className="h-4 w-4 text-mist" />
            <input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Search reference, name, phone, email" className="w-full py-2 text-sm outline-none" />
          </div>
          <select value={payment} onChange={(e) => { setPayment(e.target.value); setPage(1); }} className="input w-auto">
            <option value="">All payments</option>
            <option value="unpaid">Unpaid</option>
            <option value="paid">Paid</option>
            <option value="failed">Failed</option>
            <option value="refunded">Refunded</option>
          </select>
          <select value={channel} onChange={(e) => { setChannel(e.target.value); setPage(1); }} className="input w-auto">
            <option value="">All channels</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="paystack">Paystack</option>
            <option value="flutterwave">Flutterwave</option>
          </select>
        </div>
        {!data ? (
          <Spinner />
        ) : data.items.length === 0 ? (
          <Empty>No orders match these filters.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-cream/60 text-left text-xs text-stone">
                <tr>
                  <th className="px-5 py-3 font-medium">Order</th>
                  <th className="px-3 py-3 font-medium">Customer</th>
                  <th className="px-3 py-3 font-medium">Items</th>
                  <th className="px-3 py-3 font-medium">Channel</th>
                  <th className="px-3 py-3 font-medium">Payment</th>
                  <th className="px-3 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {data.items.map((o) => (
                  <tr key={o.id} className="hover:bg-cream/50">
                    <td className="px-5 py-3">
                      <Link href={`/admin/orders/${o.id}`} className="font-medium hover:text-bronze">{o.reference}</Link>
                      <p className="text-xs text-mist">{formatDate(o.created_at, true)}</p>
                    </td>
                    <td className="px-3 py-3">
                      <p>{o.customer_name}</p>
                      <p className="text-xs text-mist">{o.phone}</p>
                    </td>
                    <td className="px-3 py-3">{o.item_count}</td>
                    <td className="px-3 py-3"><Badge value={o.channel} /></td>
                    <td className="px-3 py-3"><Badge value={o.payment_status} /></td>
                    <td className="px-3 py-3"><Badge value={o.status} /></td>
                    <td className="px-5 py-3 text-right font-medium">{formatNaira(o.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data && pages > 1 && (
          <div className="flex items-center justify-between border-t border-line px-5 py-3 text-sm">
            <span className="text-stone">Page {page} of {pages} · {data.total} orders</span>
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
