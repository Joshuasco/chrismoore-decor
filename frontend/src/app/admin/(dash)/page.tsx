"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertTriangle, Banknote, Boxes, Clock, FileText, MessageSquareQuote, ShoppingCart, Users } from "lucide-react";
import { canAccess, useMe } from "@/components/admin/AdminShell";
import SalesChart from "@/components/admin/SalesChart";
import { formatDueDate, invoiceState } from "@/components/invoice/InvoiceDocument";
import { Badge, Empty, PageHeader, Panel, Spinner, StockBadge } from "@/components/admin/ui";
import { adminFetch } from "@/lib/admin";
import { formatDate, formatNaira } from "@/lib/format";
import type { DashboardStats } from "@/lib/types";

export default function Overview() {
  const me = useMe();
  const [s, setS] = useState<DashboardStats | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    adminFetch<DashboardStats>("/stats").then(setS).catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="text-sm text-red-700">{error}</p>;
  if (!s) return <Spinner />;

  const invoicesAllowed = canAccess(me, "invoices");
  // Only link to sections this user can open.
  const link = (href: string, perm: string) => (canAccess(me, perm) ? href : undefined);
  const tiles = [
    {
      label: "Revenue (paid)",
      value: formatNaira(s.revenue),
      sub: `${formatNaira(s.revenue_this_month)} this month${s.invoice_revenue ? ` · ${formatNaira(s.invoice_revenue)} from invoices` : ""}`,
      icon: Banknote,
    },
    { label: "Orders", value: s.orders_total.toLocaleString(), sub: `${s.orders_today} today`, icon: ShoppingCart },
    { label: "Open orders", value: s.orders_pending.toLocaleString(), sub: "Pending → processing", icon: Clock, href: link("/admin/orders?status=pending", "orders") },
    {
      label: "Unpaid invoices",
      value: formatNaira(s.invoices_outstanding),
      sub: `${s.invoices_unpaid} unpaid${s.invoices_overdue ? ` · ${s.invoices_overdue} overdue` : ""}`,
      icon: FileText,
      href: link("/admin/invoices?status=unpaid", "invoices"),
      alert: s.invoices_overdue > 0,
    },
    { label: "Stock alerts", value: (s.low_stock + s.out_of_stock).toLocaleString(), sub: `${s.out_of_stock} out · ${s.low_stock} low`, icon: AlertTriangle, href: link("/admin/inventory?low=1", "inventory") },
    { label: "Inventory value", value: formatNaira(s.inventory_value), sub: `${s.products_active} active products`, icon: Boxes },
    { label: "Pending reviews", value: (s.reviews_pending ?? 0).toLocaleString(), sub: "Awaiting approval", icon: MessageSquareQuote, href: link("/admin/reviews", "reviews") },
    { label: "Subscribers", value: s.subscribers.toLocaleString(), sub: "Newsletter", icon: Users, href: link("/admin/subscribers", "subscribers") },
  ];
  const channelTotal = Object.values(s.channel_split).reduce((a, b) => a + b, 0) || 1;

  return (
    <>
      <PageHeader title="Overview" subtitle="How the store is doing at a glance." />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {tiles.map(({ label, value, sub, icon: Icon, href, alert }) => {
          const body = (
            <div className="h-full rounded-xl border border-line bg-white p-4 transition hover:border-bronze/50">
              <div className="flex items-center justify-between">
                <p className="text-xs text-stone">{label}</p>
                <Icon className="h-4 w-4 text-bronze" />
              </div>
              <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
              <p className={alert ? "mt-0.5 text-[11px] font-medium text-red-700" : "mt-0.5 text-[11px] text-mist"}>{sub}</p>
            </div>
          );
          return href ? <Link key={label} href={href}>{body}</Link> : <div key={label}>{body}</div>;
        })}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[2fr_1fr]">
        <Panel title="Paid revenue · last 30 days (orders + invoices)">
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

      <div className="mt-6 grid gap-6 xl:grid-cols-[2fr_1fr]">
        <Panel
          title="Recent invoices"
          action={invoicesAllowed ? <Link href="/admin/invoices" className="text-xs text-bronze hover:underline">View all</Link> : undefined}
        >
          {s.recent_invoices.length === 0 ? (
            <Empty>
              No invoices yet.{" "}
              {invoicesAllowed && <Link href="/admin/invoices/new" className="text-bronze hover:underline">Create one</Link>}
            </Empty>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <tbody className="divide-y divide-line">
                  {s.recent_invoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-cream/60">
                      <td className="px-5 py-3">
                        {invoicesAllowed ? (
                          <Link href={`/admin/invoices/${inv.id}`} className="font-medium hover:text-bronze">{inv.number}</Link>
                        ) : (
                          <span className="font-medium">{inv.number}</span>
                        )}
                        <p className="text-xs text-mist">{formatDate(inv.created_at)}</p>
                      </td>
                      <td className="px-3 py-3">{inv.customer_name}</td>
                      <td className="px-3 py-3 text-xs text-stone">{inv.due_date ? `Due ${formatDueDate(inv.due_date)}` : ""}</td>
                      <td className="px-3 py-3"><Badge value={invoiceState(inv)} /></td>
                      <td className="px-5 py-3 text-right font-medium">{formatNaira(inv.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
        <Panel title="Money owed on invoices">
          <dl className="space-y-4 p-5 text-sm">
            <div>
              <dt className="text-xs text-stone">Outstanding ({s.invoices_unpaid} unpaid)</dt>
              <dd className="mt-1 text-2xl font-semibold tracking-tight">{formatNaira(s.invoices_outstanding)}</dd>
            </div>
            <div>
              <dt className="text-xs text-stone">Overdue ({s.invoices_overdue})</dt>
              <dd className={s.invoices_overdue ? "mt-1 text-2xl font-semibold tracking-tight text-red-700" : "mt-1 text-2xl font-semibold tracking-tight"}>
                {formatNaira(s.invoices_overdue_amount)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-stone">Collected from invoices (all time)</dt>
              <dd className="mt-1 text-2xl font-semibold tracking-tight">{formatNaira(s.invoice_revenue)}</dd>
            </div>
          </dl>
          {invoicesAllowed && s.invoices_overdue > 0 && (
            <div className="border-t border-line px-5 py-3">
              <Link href="/admin/invoices?status=overdue" className="text-xs text-bronze hover:underline">Follow up on overdue invoices →</Link>
            </div>
          )}
        </Panel>
      </div>
    </>
  );
}
