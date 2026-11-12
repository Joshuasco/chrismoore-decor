"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { CheckCircle2, Clock, CreditCard, Loader2, XCircle } from "lucide-react";
import { WhatsAppIcon } from "./WhatsAppFab";
import { apiFetch } from "@/lib/api";
import { CONTACT_DEFAULTS } from "@/lib/contact";
import { DEMO_ENABLED, DEMO_SETTINGS, demoWhatsAppLink, getDemoOrder, isDemoReference } from "@/lib/demo";
import { cn, formatDate, formatNaira, STATUS_LABEL } from "@/lib/format";
import { notifyPhrase } from "@/lib/notify";
import type { Order, StoreSettings } from "@/lib/types";

const STEPS = ["pending", "confirmed", "processing", "shipped", "delivered"];

export default function OrderView({ reference, isNew }: { reference: string; isNew?: boolean }) {
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState("");
  const [settings, setSettings] = useState<StoreSettings>({});
  const [busy, setBusy] = useState<string>("");
  const [waUrl, setWaUrl] = useState("");

  const [demo, setDemo] = useState(false);

  const load = useCallback(() => {
    if (isDemoReference(reference)) {
      // Demo orders live in this browser's storage; resolve async like the API path.
      Promise.resolve(getDemoOrder(reference)).then((o) => {
        if (!o) {
          setError("This demo order was created in another browser or has been cleared.");
          return;
        }
        setDemo(true);
        setOrder(o);
        setWaUrl(demoWhatsAppLink(o, CONTACT_DEFAULTS.whatsapp_number, window.location.href.split("?")[0]));
      });
      return;
    }
    apiFetch<Order>(`/api/orders/${encodeURIComponent(reference)}`)
      .then((o) => {
        setOrder(o);
        // Fetch the chat link up front so the button is a real link (no popup blocking).
        if (o.payment_status !== "paid" && o.status !== "cancelled") {
          apiFetch<{ whatsapp_url: string }>(`/api/orders/${encodeURIComponent(reference)}/whatsapp`)
            .then((r) => setWaUrl(r.whatsapp_url))
            .catch(() => {});
        }
      })
      .catch((e) => setError(e.message));
  }, [reference]);

  useEffect(() => {
    load();
    apiFetch<StoreSettings>("/api/settings")
      .then((s) => {
        setSettings(s);
        // Use the store's configured WhatsApp number for demo orders too.
        setWaUrl((url) => (url && s.whatsapp_number ? url.replace(/wa\.me\/\d+/, `wa.me/${s.whatsapp_number.replace(/\D/g, "")}`) : url));
      })
      .catch(() => DEMO_ENABLED && setSettings(DEMO_SETTINGS));
  }, [load]);

  const pay = async (provider: "paystack" | "flutterwave") => {
    setBusy(provider);
    try {
      const { checkout_url } = await apiFetch<{ checkout_url: string }>(`/api/orders/${reference}/pay`, {
        method: "POST",
        body: JSON.stringify({ provider }),
      });
      window.location.href = checkout_url;
    } catch (e) {
      toast.error((e as Error).message);
      setBusy("");
    }
  };

  if (error) {
    return (
      <div className="container-x flex min-h-[50vh] flex-col items-center justify-center text-center">
        <h1 className="heading text-4xl">Order not found</h1>
        <p className="mt-2 text-sm text-stone">{error}</p>
        <Link href="/shop" className="btn-primary mt-6">Continue shopping</Link>
      </div>
    );
  }
  if (!order) {
    return (
      <div className="container-x grid min-h-[50vh] place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-bronze" />
      </div>
    );
  }

  const paid = order.payment_status === "paid";
  const cancelled = order.status === "cancelled";
  const canPay = !paid && !cancelled;
  const stepIdx = STEPS.indexOf(order.status);

  return (
    <div className="container-x max-w-5xl py-12">
      <div className="text-center">
        <span className={cn("mx-auto grid h-16 w-16 place-items-center rounded-full", cancelled ? "bg-red-50 text-red-700" : paid ? "bg-whatsapp/10 text-whatsapp" : "bg-bronze/10 text-bronze")}>
          {cancelled ? <XCircle className="h-8 w-8" /> : paid ? <CheckCircle2 className="h-8 w-8" /> : <Clock className="h-8 w-8" />}
        </span>
        <p className="eyebrow mt-5">Order {order.reference}</p>
        <h1 className="heading mt-2 text-4xl sm:text-5xl">
          {cancelled ? "This order was cancelled" : paid ? "Thank you — payment received!" : isNew ? "Almost done!" : "Your order"}
        </h1>
        <p className="mx-auto mt-3 max-w-lg text-sm text-stone">
          {cancelled
            ? "Reserved items have been released. Place a new order or chat with us if you need help."
            : paid
              ? `We've received ${formatNaira(order.total)}. We'll be in touch on ${order.phone} about delivery.`
              : "Send your order to us on WhatsApp to confirm delivery, or pay securely online now."}
        </p>
      </div>

      {canPay && (
        <div className="mx-auto mt-8 grid max-w-2xl gap-3 sm:grid-cols-3">
          <a
            href={waUrl || undefined}
            target="_blank"
            rel="noopener noreferrer"
            aria-disabled={!waUrl}
            className={cn("btn-whatsapp py-3.5 sm:col-span-3", !waUrl && "pointer-events-none opacity-60")}
          >
            {waUrl ? <WhatsAppIcon className="h-4 w-4" /> : <Loader2 className="h-4 w-4 animate-spin" />}
            Send order on WhatsApp
          </a>
          {!demo && settings.paystack_enabled === "true" && (
            <button onClick={() => pay("paystack")} disabled={!!busy} className={cn("btn-primary py-3", settings.flutterwave_enabled !== "true" && "sm:col-span-3")}>
              {busy === "paystack" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />} Pay with Paystack
            </button>
          )}
          {!demo && settings.flutterwave_enabled === "true" && (
            <button onClick={() => pay("flutterwave")} disabled={!!busy} className={cn("btn-outline py-3", settings.paystack_enabled === "true" ? "sm:col-span-2" : "sm:col-span-3")}>
              {busy === "flutterwave" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />} Pay with Flutterwave
            </button>
          )}
        </div>
      )}

      {!cancelled && (
        <ol className="mx-auto mt-12 grid max-w-3xl grid-cols-5 gap-2 text-center text-[11px] text-stone">
          {STEPS.map((s, i) => (
            <li key={s}>
              <span className={cn("mx-auto mb-2 block h-1.5 rounded-full", i <= stepIdx ? "bg-bronze" : "bg-oat")} />
              <span className={i <= stepIdx ? "font-medium text-ink" : ""}>{STATUS_LABEL[s]}</span>
            </li>
          ))}
        </ol>
      )}

      <div className="mt-12 grid gap-6 md:grid-cols-[1.4fr_1fr]">
        <section className="card p-6">
          <h2 className="font-serif text-2xl font-semibold">Items</h2>
          <ul className="mt-4 divide-y divide-line">
            {order.items.map((it) => (
              <li key={it.id} className="flex gap-3 py-3">
                <div className="relative h-16 w-14 shrink-0 overflow-hidden rounded-md bg-sand">
                  {it.image_url && <Image src={it.image_url} alt="" fill sizes="56px" className="object-cover" />}
                </div>
                <div className="flex-1 text-sm">
                  <p className="font-medium">{it.product_name}</p>
                  <p className="text-xs text-stone">{[it.color, it.size].filter(Boolean).join(" · ")} · Qty {it.quantity}</p>
                </div>
                <p className="text-sm font-medium">{formatNaira(it.unit_price * it.quantity)}</p>
              </li>
            ))}
          </ul>
          <dl className="mt-4 space-y-2 border-t border-line pt-4 text-sm">
            <div className="flex justify-between"><dt className="text-stone">Subtotal</dt><dd>{formatNaira(order.subtotal)}</dd></div>
            <div className="flex justify-between"><dt className="text-stone">Delivery</dt><dd>{order.shipping_fee ? formatNaira(order.shipping_fee) : "Free"}</dd></div>
            <div className="flex justify-between pt-2 text-base font-semibold"><dt>Total</dt><dd>{formatNaira(order.total)}</dd></div>
          </dl>
        </section>
        <section className="card h-fit space-y-4 p-6 text-sm">
          <h2 className="font-serif text-2xl font-semibold">Details</h2>
          <div>
            <p className="label">Delivery to</p>
            <p>{order.customer_name}</p>
            <p className="text-stone">{order.address}{order.city && `, ${order.city}`}{order.state && `, ${order.state}`}</p>
            <p className="text-stone">{order.phone} · {order.email}</p>
          </div>
          <div className="flex justify-between"><span className="text-stone">Placed</span><span>{formatDate(order.created_at, true)}</span></div>
          <div className="flex justify-between"><span className="text-stone">Payment</span><span className={paid ? "text-whatsapp" : ""}>{STATUS_LABEL[order.payment_status]}</span></div>
          <div className="flex justify-between"><span className="text-stone">Status</span><span>{STATUS_LABEL[order.status]}</span></div>
          {demo ? (
            <p className="rounded-md bg-amber-50 p-3 text-xs text-amber-900">
              Demo order: it&apos;s saved in this browser only. Sending it on WhatsApp shares the details with the store directly.
            </p>
          ) : (
            <p className="rounded-md bg-cream p-3 text-xs text-stone">
              {notifyPhrase(settings)
                ? `We've sent this page's link to you ${notifyPhrase(settings)}. Open it on any device to pay or track your order.`
                : "Save this page link — you can come back to it any time, on any device, to pay or track your order."}
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
