"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { ArrowLeft, Copy, ExternalLink, Loader2, RefreshCw } from "lucide-react";
import { Badge, PageHeader, Panel, Spinner } from "@/components/admin/ui";
import { WhatsAppIcon } from "@/components/store/WhatsAppFab";
import { adminFetch } from "@/lib/admin";
import { formatDate, formatNaira, STATUS_LABEL } from "@/lib/format";
import CustomerMessages from "@/components/admin/CustomerMessages";
import type { Order, OrderNotification } from "@/lib/types";

type Detail = {
  order: Order;
  whatsapp_url: string;
  order_url: string;
  notifications?: OrderNotification[];
  notify_channels?: string[];
};
const STATUSES = ["pending", "confirmed", "processing", "shipped", "delivered", "cancelled"];
const PAYMENTS = ["unpaid", "paid", "failed", "refunded"];

export default function OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const [d, setD] = useState<Detail | null>(null);
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    adminFetch<Detail>(`/orders/${id}`).then(setD).catch((e) => toast.error(e.message));
  }, [id]);

  if (!d) return <Spinner />;
  const o = d.order;

  // Status changes message the customer in the background; refresh the
  // message list once those sends have had a moment to finish.
  const refreshMessages = () => {
    window.setTimeout(() => {
      adminFetch<Detail>(`/orders/${id}`)
        .then((fresh) => setD((cur) => (cur ? { ...cur, notifications: fresh.notifications } : fresh)))
        .catch(() => {});
    }, 4000);
  };

  const update = async (patch: { status?: string; payment_status?: string }) => {
    if (patch.status === "cancelled" && !confirm("Cancel this order? Reserved stock will be returned to inventory. This can't be undone.")) return;
    setSaving(true);
    try {
      const updated = await adminFetch<Order>(`/orders/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
      setD({ ...d, order: updated });
      toast.success("Order updated");
      if (d.notify_channels?.length) refreshMessages();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const verify = async () => {
    setVerifying(true);
    try {
      const r = await adminFetch<{ verified: boolean; order: Order }>(`/orders/${id}/verify-payment`, { method: "POST" });
      setD({ ...d, order: r.order });
      if (r.verified && d.notify_channels?.length) refreshMessages();
      if (r.verified) toast.success("Payment confirmed with provider");
      else toast("Provider reports the payment is not completed yet", { icon: "⏳" });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setVerifying(false);
    }
  };

  return (
    <>
      <Link href="/admin/orders" className="mb-4 inline-flex items-center gap-1.5 text-sm text-stone hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Orders
      </Link>
      <PageHeader
        title={`Order ${o.reference}`}
        subtitle={`Placed ${formatDate(o.created_at, true)} via ${STATUS_LABEL[o.channel]}`}
        actions={
          <>
            <a href={d.whatsapp_url} target="_blank" rel="noopener noreferrer" className="btn-whatsapp btn-sm">
              <WhatsAppIcon className="h-4 w-4" /> Message customer
            </a>
            <button
              className="btn-outline btn-sm"
              onClick={() => navigator.clipboard.writeText(d.order_url).then(() => toast.success("Payment link copied"))}
            >
              <Copy className="h-4 w-4" /> Copy payment link
            </button>
            <a href={d.order_url} target="_blank" rel="noopener noreferrer" className="btn-outline btn-sm">
              <ExternalLink className="h-4 w-4" /> Customer view
            </a>
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        <Panel title={`Items (${o.item_count})`}>
          <ul className="divide-y divide-line">
            {o.items.map((it) => (
              <li key={it.id} className="flex items-center gap-4 px-5 py-4">
                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md bg-sand">
                  {it.image_url && <Image src={it.image_url} alt="" fill sizes="56px" className="object-cover" />}
                </div>
                <div className="flex-1 text-sm">
                  {it.product_id ? (
                    <Link href={`/admin/products/${it.product_id}`} className="font-medium hover:text-bronze">{it.product_name}</Link>
                  ) : (
                    <p className="font-medium">{it.product_name}</p>
                  )}
                  <p className="text-xs text-stone">SKU {it.sku}{it.color && ` · ${it.color}`}{it.size && ` · ${it.size}`}</p>
                </div>
                <p className="text-sm text-stone">{it.quantity} × {formatNaira(it.unit_price)}</p>
                <p className="w-28 text-right text-sm font-medium">{formatNaira(it.quantity * it.unit_price)}</p>
              </li>
            ))}
          </ul>
          <dl className="space-y-2 border-t border-line px-5 py-4 text-sm">
            <div className="flex justify-between"><dt className="text-stone">Subtotal</dt><dd>{formatNaira(o.subtotal)}</dd></div>
            <div className="flex justify-between"><dt className="text-stone">Delivery</dt><dd>{formatNaira(o.shipping_fee)}</dd></div>
            <div className="flex justify-between text-base font-semibold"><dt>Total</dt><dd>{formatNaira(o.total)}</dd></div>
          </dl>
        </Panel>

        <div className="space-y-6">
          <Panel title="Status">
            <div className="space-y-4 p-5">
              <div className="flex gap-2"><Badge value={o.status} /><Badge value={o.payment_status} />{saving && <Loader2 className="h-4 w-4 animate-spin text-bronze" />}</div>
              <div>
                <label className="label" htmlFor="status">Fulfilment status</label>
                <select id="status" className="input" value={o.status} disabled={saving || o.status === "cancelled"} onChange={(e) => update({ status: e.target.value })}>
                  {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="payment">Payment status</label>
                <select id="payment" className="input" value={o.payment_status} disabled={saving} onChange={(e) => update({ payment_status: e.target.value })}>
                  {PAYMENTS.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                </select>
                <p className="mt-1.5 text-xs text-mist">Mark WhatsApp orders as paid once a bank transfer is confirmed.</p>
              </div>
              {o.payment_provider && (
                <button onClick={verify} disabled={verifying} className="btn-outline btn-sm w-full">
                  {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Re-check {STATUS_LABEL[o.payment_provider]} payment
                </button>
              )}
              {o.paid_at && <p className="text-xs text-stone">Paid {formatDate(o.paid_at, true)}</p>}
            </div>
          </Panel>
          <Panel title="Customer">
            <div className="space-y-1 p-5 text-sm">
              <p className="font-medium">{o.customer_name}</p>
              <p><a href={`tel:${o.phone}`} className="text-bronze hover:underline">{o.phone}</a></p>
              <p><a href={`mailto:${o.email}`} className="text-bronze hover:underline">{o.email}</a></p>
              <p className="pt-3 text-stone">{o.address}{o.city && `, ${o.city}`}{o.state && `, ${o.state}`}</p>
              {o.notes && <p className="mt-3 rounded-md bg-cream p-3 text-stone"><span className="font-medium text-ink">Notes: </span>{o.notes}</p>}
            </div>
          </Panel>
          <Panel title="Customer messages">
            <CustomerMessages
              key={o.id}
              order={o}
              channels={d.notify_channels ?? []}
              notifications={d.notifications ?? []}
              onChange={(notifications) => setD((cur) => (cur ? { ...cur, notifications } : cur))}
            />
          </Panel>
        </div>
      </div>
    </>
  );
}
