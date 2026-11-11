"use client";

import Image from "next/image";
import Link from "next/link";
import toast from "react-hot-toast";
import { ArrowRight, Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { cartSubtotal, useCart } from "@/lib/cart";
import { useHydrated } from "@/lib/hooks";
import { formatNaira } from "@/lib/format";

export default function CartPage() {
  const { items, setQuantity, remove } = useCart();
  const hydrated = useHydrated();

  if (!hydrated) return <div className="container-x min-h-[50vh] py-16" />;

  if (items.length === 0) {
    return (
      <div className="container-x flex min-h-[55vh] flex-col items-center justify-center py-16 text-center">
        <span className="grid h-20 w-20 place-items-center rounded-full bg-sand">
          <ShoppingBag className="h-8 w-8 text-bronze" strokeWidth={1.4} />
        </span>
        <h1 className="heading mt-6 text-4xl">Your cart is empty</h1>
        <p className="mt-2 text-sm text-stone">Discover curtains, bedding, blinds and rugs made for your home.</p>
        <Link href="/shop" className="btn-primary mt-8 px-8">Start shopping</Link>
      </div>
    );
  }

  const subtotal = cartSubtotal(items);

  return (
    <div className="container-x py-12">
      <h1 className="heading text-4xl sm:text-5xl">Your Cart</h1>
      <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_380px]">
        <ul className="divide-y divide-line border-y border-line">
          {items.map((it) => (
            <li key={it.key} className="flex gap-4 py-6">
              <Link href={`/product/${it.slug}`} className="relative h-28 w-24 shrink-0 overflow-hidden rounded-lg bg-sand sm:h-32 sm:w-28">
                {it.image && <Image src={it.image} alt={it.name} fill sizes="112px" className="object-cover" />}
              </Link>
              <div className="flex flex-1 flex-col">
                <div className="flex justify-between gap-3">
                  <div>
                    <Link href={`/product/${it.slug}`} className="font-serif text-xl font-semibold hover:text-bronze-dark">{it.name}</Link>
                    <p className="mt-0.5 text-xs text-stone">{[it.color, it.size].filter(Boolean).join(" · ")}</p>
                  </div>
                  <p className="font-semibold">{formatNaira(it.price * it.quantity)}</p>
                </div>
                <div className="mt-auto flex items-center justify-between pt-3">
                  <div className="flex items-center rounded-md border border-line bg-white">
                    <button className="p-2 disabled:opacity-40" onClick={() => setQuantity(it.key, it.quantity - 1)} disabled={it.quantity <= 1} aria-label="Decrease">
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="w-8 text-center text-sm">{it.quantity}</span>
                    <button className="p-2 disabled:opacity-40" onClick={() => setQuantity(it.key, it.quantity + 1)} disabled={it.stock > 0 && it.quantity >= it.stock} aria-label="Increase">
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <button
                    onClick={() => {
                      remove(it.key);
                      toast.success(`${it.name} removed`);
                    }}
                    className="flex items-center gap-1.5 text-xs text-stone hover:text-red-700"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Remove
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>

        <aside className="h-fit rounded-xl bg-cream p-6 lg:sticky lg:top-28">
          <h2 className="font-serif text-2xl font-semibold">Order Summary</h2>
          <dl className="mt-5 space-y-3 text-sm">
            <div className="flex justify-between"><dt className="text-stone">Subtotal</dt><dd>{formatNaira(subtotal)}</dd></div>
            <div className="flex justify-between"><dt className="text-stone">Delivery</dt><dd className="text-stone">Calculated at checkout</dd></div>
          </dl>
          <div className="mt-5 flex justify-between border-t border-line pt-5 text-lg font-semibold">
            <span>Total</span><span>{formatNaira(subtotal)}</span>
          </div>
          <Link href="/checkout" className="btn-primary mt-6 w-full py-3.5">
            Proceed to checkout <ArrowRight className="h-4 w-4" />
          </Link>
          <Link href="/shop" className="mt-3 block text-center text-xs uppercase tracking-[0.18em] text-bronze hover:text-bronze-dark">
            Continue shopping
          </Link>
        </aside>
      </div>
    </div>
  );
}
