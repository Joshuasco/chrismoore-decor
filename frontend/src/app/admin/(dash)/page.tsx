"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertTriangle, Banknote, Boxes, Clock, MessageSquareQuote, ShoppingCart, Users } from "lucide-react";
import SalesChart from "@/components/admin/SalesChart";
import { Badge, Empty, PageHeader, Panel, Spinner, StockBadge } from "@/components/admin/ui";
import { adminFetch } from "@/lib/admin";
import { formatDate, formatNaira } from "@/lib/format";
import type { DashboardStats } from "@/lib/types";

export default function Overview() {
  const [s, setS] = useState<DashboardStats | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    adminFetch<DashboardStats>("/stats").then(setS).catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="text-sm text-red-700">{error}</p>;
  if (!s) return <Spinner />;

  const tiles = [
    { label: "Revenue (paid)", value: formatNaira(s.revenue), sub: `${formatNaira(s.revenue_this_month)} this month`, icon: Banknote },
    { label: "Orders", value: s.orders_total.toLocaleString(), sub: `${s.orders_today} today`, icon: ShoppingCart },
    { label: "Open orders", value: s.orders_pending.toLocaleString(), sub: "Pending → processing", icon: Clock, href: "/admin/orders?status=pending" },
    { label: "Stock alerts", value: (s.low_stock + s.out_of_stock).toLocaleString(), sub: `${s.out_of_stock} out · ${s.low_stock} low`, icon: AlertTriangle, href: "/admin/inventory?low=1" },
    { label: "Inventory value", value: formatNaira(s.inventory_value), sub: `${s.products_active} active products`, icon: Boxes },
    { label: "Pending reviews", value: (s.reviews_pending ?? 0).toLocaleString(), sub: "Awaiting approval", icon: MessageSquareQuote, href: "/admin/reviews" },
    { label: "Subscribers", value: s.subscribers.toLocaleString(), sub: "Newsletter", icon: Users, href: "/admin/subscribers" },
  ];
  const channelTotal = Object.values(s.channel_split).reduce((a, b) => a + b, 0) || 1;

  return (
    <>
      <PageHeader title="Overview" subtitle="How the store is doing at a glance." />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 2xl:grid-cols-7">
        {tiles.map(({ label, value, sub, icon: Icon, href }) => {
          const body = (
            <div className="h-full rounded-xl border border-line bg-white p-4 transition hover:border-bronze/50">
              <div className="flex items-center justify-between">
                <p className="text-xs text-stone">{label}</p>
                <Icon className="h-4 w-4 text-bronze" />
              </div>
              <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
              <p className="mt-0.5 text-[11px] text-mist">{sub}</p>
            </div>
          );
          return href ? <Link key={label} href={href}>{body}</Link> : <div key={label}>{body}</div>;
        })}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[2fr_1fr]">
        <Panel title="Paid revenue · last 30 days">
          <SalesChart data={s.sales_by_day} />
        </Panel>
        <Panel title="Orders by channel">
          <ul className="space-y-4 p-5">
            {(["whatsapp", "paystack", "flutterwave"] as const).map((ch) => (
              <li key={ch}>
                <div className="mb-1.5 flex items-center justify-between text-sm">
                  <Badge value={ch} />
                  <span className="font-medium">{s.channel_split[ch] ?? 0}</span>
                </div>
                <div className="h-2 rounded-full bg-sand">
                  <div className="h-2 rounded-full bg-bronze" style={{ width: `${((s.channel_split[ch] ?? 0) / channelTotal) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
          <div className="border-t border-line p-5">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-stone">Top products</p>
            {s.top_products.length === 0 ? (
              <p className="text-sm text-stone">No sales yet.</p>
            ) : (
              <ul className="space-y-3">
                {s.top_products.map((t) => (
                  <li key={t.product_id + t.name} className="flex items-center gap-3 text-sm">
                    <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded bg-sand">
                      {t.image_url && <Image src={t.image_url} alt="" fill sizes="36px" className="object-cover" />}
                    </div>
                    <span className="flex-1 truncate">{t.name}</span>
                    <span className="text-xs text-stone">{t.units} sold</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Panel>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[2fr_1fr]">
        <Panel title="Recent orders" action={<Link href="/admin/orders" className="text-xs text-bronze hover:underline">View all</Link>}>
          {s.recent_orders.length === 0 ? (
            <Empty>No orders yet.</Empty>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <tbody className="divide-y divide-line">
                  {s.recent_orders.map((o) => (
                    <tr key={o.id} className="hover:bg-cream/60">
                      <td className="px-5 py-3">
                        <Link href={`/admin/orders/${o.id}`} className="font-medium hover:text-bronze">{o.reference}</Link>
                        <p className="text-xs text-mist">{formatDate(o.created_at, true)}</p>
                      </td>
                      <td className="px-3 py-3">{o.customer_name}</td>
                      <td className="px-3 py-3"><Badge value={o.channel} /></td>
                      <td className="px-3 py-3"><Badge value={o.status} /></td>
                      <td className="px-5 py-3 text-right font-medium">{formatNaira(o.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
        <Panel title="Low stock" action={<Link href="/admin/inventory" className="text-xs text-bronze hover:underline">Manage</Link>}>
          {s.low_stock_products.length === 0 ? (
            <Empty>All products are well stocked.</Empty>
          ) : (
            <ul className="divide-y divide-line">
              {s.low_stock_products.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                  <Link href={`/admin/products/${p.id}`} className="truncate hover:text-bronze">{p.name}</Link>
                  <StockBadge stock={p.stock} threshold={p.low_stock_threshold} />
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
