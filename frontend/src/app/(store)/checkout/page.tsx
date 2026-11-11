"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { CreditCard, Loader2, Lock } from "lucide-react";
import { WhatsAppIcon } from "@/components/store/WhatsAppFab";
import { ApiError, apiFetch } from "@/lib/api";
import { createDemoOrder, DEMO_ENABLED, DEMO_SETTINGS, isDemoId } from "@/lib/demo";
import { cartSubtotal, useCart } from "@/lib/cart";
import { useHydrated } from "@/lib/hooks";
import { cn, formatNaira, NIGERIAN_STATES } from "@/lib/format";
import type { Channel, Order, StoreSettings } from "@/lib/types";

type CheckoutResponse = { order: Order; whatsapp_url?: string; checkout_url?: string; payment_error?: string };

export default function CheckoutPage() {
  const router = useRouter();
  const { items, clear } = useCart();
  const hydrated = useHydrated();
  const [settings, setSettings] = useState<StoreSettings>({});
  const [channel, setChannel] = useState<Channel>("whatsapp");
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ customer_name: "", email: "", phone: "", address: "", city: "", state: "Lagos", notes: "" });

  useEffect(() => {
    apiFetch<StoreSettings>("/api/settings")
      .then(setSettings)
      .catch(() => DEMO_ENABLED && setSettings(DEMO_SETTINGS));
  }, []);

  // Demo products can't be sent to the real API: those carts are simulated locally.
  const demoCart = DEMO_ENABLED && items.some((i) => isDemoId(i.productId));
  const subtotal = cartSubtotal(items);
  const fee = Number(settings.shipping_fee || 0);
  const freeOver = Number(settings.free_shipping_threshold || 0);
  const shipping = freeOver > 0 && subtotal >= freeOver ? 0 : fee;

  const channels: { id: Channel; title: string; text: string; enabled: boolean }[] = [
    { id: "whatsapp", title: "Order on WhatsApp", text: "Confirm details with our team on WhatsApp, then pay by transfer or a secure link.", enabled: true },
    { id: "paystack", title: "Pay with Paystack", text: "Card, bank transfer or USSD.", enabled: !demoCart && settings.paystack_enabled === "true" },
    { id: "flutterwave", title: "Pay with Flutterwave", text: "Card, bank transfer, USSD or mobile money.", enabled: !demoCart && settings.flutterwave_enabled === "true" },
  ];

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) return;
    setSubmitting(true);
    const payload = {
      ...form,
      items: items.map((i) => ({ product_id: i.productId, quantity: i.quantity, color: i.color, size: i.size })),
    };
    const simulate = () => {
      const order = createDemoOrder(payload, settings);
      clear();
      toast.success(`Order ${order.reference} created!`);
      router.push(`/order/${order.reference}?new=1`);
    };
    if (demoCart) {
      try {
        simulate();
      } catch (err) {
        toast.error((err as Error).message);
        setSubmitting(false);
      }
      return;
    }
    try {
      const res = await apiFetch<CheckoutResponse>("/api/orders", {
        method: "POST",
        body: JSON.stringify({ ...payload, channel }),
      });
      clear();
      if (res.checkout_url) {
        toast.success("Redirecting to secure payment…");
        window.location.href = res.checkout_url;
        return;
      }
      if (res.payment_error) toast.error(res.payment_error, { duration: 6000 });
      else toast.success(`Order ${res.order.reference} created!`);
      router.push(`/order/${res.order.reference}${channel === "whatsapp" ? "?new=1" : ""}`);
    } catch (err) {
      // API unreachable: still let the shopper complete the order over WhatsApp.
      if (DEMO_ENABLED && err instanceof ApiError && err.status === 0 && channel === "whatsapp") {
        try {
          simulate();
          return;
        } catch {}
      }
      toast.error((err as Error).message, { duration: 6000 });
      setSubmitting(false);
    }
  };

  if (!hydrated) return <div className="container-x min-h-[50vh] py-16" />;
  if (items.length === 0) {
    return (
      <div className="container-x flex min-h-[50vh] flex-col items-center justify-center text-center">
        <h1 className="heading text-4xl">Nothing to check out yet</h1>
        <Link href="/shop" className="btn-primary mt-6">Browse products</Link>
      </div>
    );
  }

  return (
    <div className="container-x py-12">
      <h1 className="heading text-4xl sm:text-5xl">Checkout</h1>
      <form onSubmit={submit} className="mt-10 grid gap-10 lg:grid-cols-[1fr_400px]">
        <div className="space-y-10">
          <section>
            <h2 className="font-serif text-2xl font-semibold">Delivery details</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="label" htmlFor="name">Full name</label>
                <input id="name" required className="input" value={form.customer_name} onChange={set("customer_name")} autoComplete="name" />
              </div>
              <div>
                <label className="label" htmlFor="email">Email</label>
                <input id="email" type="email" required className="input" value={form.email} onChange={set("email")} autoComplete="email" />
              </div>
              <div>
                <label className="label" htmlFor="phone">Phone (WhatsApp)</label>
                <input id="phone" type="tel" required className="input" value={form.phone} onChange={set("phone")} placeholder="0803 000 0000" autoComplete="tel" />
              </div>
              <div className="sm:col-span-2">
                <label className="label" htmlFor="address">Delivery address</label>
                <input id="address" required className="input" value={form.address} onChange={set("address")} autoComplete="street-address" />
              </div>
              <div>
                <label className="label" htmlFor="city">City</label>
                <input id="city" className="input" value={form.city} onChange={set("city")} autoComplete="address-level2" />
              </div>
              <div>
                <label className="label" htmlFor="state">State</label>
                <select id="state" className="input" value={form.state} onChange={set("state")}>
                  {NIGERIAN_STATES.map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="label" htmlFor="notes">Order notes (window sizes, colours, delivery instructions)</label>
                <textarea id="notes" rows={3} className="input" value={form.notes} onChange={set("notes")} />
              </div>
            </div>
          </section>

          <section>
            <h2 className="font-serif text-2xl font-semibold">How would you like to complete your order?</h2>
            <div className="mt-5 grid gap-3">
              {channels.map((c) => (
                <label
                  key={c.id}
                  className={cn(
                    "flex cursor-pointer items-start gap-4 rounded-xl border bg-white p-5 transition",
                    !c.enabled && "cursor-not-allowed opacity-50",
                    channel === c.id ? "border-bronze ring-2 ring-bronze/20" : "border-line hover:border-bronze/60",
                  )}
                >
                  <input type="radio" name="channel" value={c.id} checked={channel === c.id} disabled={!c.enabled} onChange={() => setChannel(c.id)} className="mt-1 accent-[#a8875e]" />
                  <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-full", c.id === "whatsapp" ? "bg-whatsapp/10 text-whatsapp" : "bg-bronze/10 text-bronze")}>
                    {c.id === "whatsapp" ? <WhatsAppIcon className="h-5 w-5" /> : <CreditCard className="h-5 w-5" />}
                  </span>
                  <span>
                    <span className="block font-medium">{c.title}</span>
                    <span className="text-sm text-stone">
                      {c.enabled ? c.text : demoCart ? "Available once the online store is connected" : "Currently unavailable"}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </section>
        </div>

        <aside className="h-fit rounded-xl bg-cream p-6 lg:sticky lg:top-28">
          <h2 className="font-serif text-2xl font-semibold">Your order</h2>
          <ul className="mt-5 space-y-4">
            {items.map((it) => (
              <li key={it.key} className="flex gap-3">
                <div className="relative h-16 w-14 shrink-0 overflow-hidden rounded-md bg-sand">
                  {it.image && <Image src={it.image} alt="" fill sizes="56px" className="object-cover" />}
                  <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-ink px-1 text-[10px] text-white">{it.quantity}</span>
                </div>
                <div className="flex-1 text-sm">
                  <p className="font-medium leading-snug">{it.name}</p>
                  <p className="text-xs text-stone">{[it.color, it.size].filter(Boolean).join(" · ")}</p>
                </div>
                <p className="text-sm font-medium">{formatNaira(it.price * it.quantity)}</p>
              </li>
            ))}
          </ul>
          <dl className="mt-6 space-y-2.5 border-t border-line pt-5 text-sm">
            <div className="flex justify-between"><dt className="text-stone">Subtotal</dt><dd>{formatNaira(subtotal)}</dd></div>
            <div className="flex justify-between">
              <dt className="text-stone">Delivery</dt>
              <dd>{shipping === 0 ? "Free" : formatNaira(shipping)}</dd>
            </div>
            {freeOver > 0 && shipping > 0 && (
              <p className="text-xs text-bronze-dark">Add {formatNaira(freeOver - subtotal)} more for free delivery.</p>
            )}
          </dl>
          <div className="mt-5 flex justify-between border-t border-line pt-5 text-lg font-semibold">
            <span>Total</span><span>{formatNaira(subtotal + shipping)}</span>
          </div>
          <button type="submit" disabled={submitting} className={cn("mt-6 w-full py-3.5", channel === "whatsapp" ? "btn-whatsapp" : "btn-primary")}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : channel === "whatsapp" ? <WhatsAppIcon className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
            {submitting ? "Placing order…" : channel === "whatsapp" ? "Place order via WhatsApp" : `Pay ${formatNaira(subtotal + shipping)}`}
          </button>
          <p className="mt-3 text-center text-xs text-mist">Prices and stock are confirmed when you place your order.</p>
        </aside>
      </form>
    </div>
  );
}
