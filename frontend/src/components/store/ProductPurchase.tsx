"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";
import { Minus, Plus, ShoppingBag } from "lucide-react";
import { WhatsAppIcon } from "./WhatsAppFab";
import { useCart } from "@/lib/cart";
import { cn, formatNaira } from "@/lib/format";
import type { Product } from "@/lib/types";

export default function ProductPurchase({ product, whatsappNumber }: { product: Product; whatsappNumber?: string }) {
  const add = useCart((s) => s.add);
  const router = useRouter();
  const [color, setColor] = useState(product.colors[0] ?? "");
  const [size, setSize] = useState(product.sizes[0] ?? "");
  const [qty, setQty] = useState(1);
  const soldOut = product.stock <= 0;
  const low = !soldOut && product.stock <= product.low_stock_threshold;

  const addToCart = (goToCart = false) => {
    add(product, { quantity: qty, color, size });
    if (goToCart) {
      router.push("/checkout");
      return;
    }
    toast.success(
      (t) => (
        <span className="flex items-center gap-3">
          <span>Added to cart</span>
          <Link href="/cart" onClick={() => toast.dismiss(t.id)} className="rounded bg-bronze px-2.5 py-1 text-xs font-medium">
            View cart
          </Link>
        </span>
      ),
    );
  };

  const waText = encodeURIComponent(
    `Hello Chris Moore Interior Decor! I'm interested in:\n\n${qty} × ${product.name}${color ? ` (${[color, size].filter(Boolean).join(", ")})` : ""}\nSKU: ${product.sku}\nPrice: ${formatNaira(product.price)} each\n\nIs it available?`,
  );

  return (
    <div className="space-y-6">
      {product.colors.length > 0 && (
        <fieldset>
          <legend className="label">
            Colour: <span className="font-normal text-stone">{color}</span>
          </legend>
          <div className="flex flex-wrap gap-2">
            {product.colors.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                aria-pressed={c === color}
                className={cn(
                  "rounded-md border px-4 py-2 text-sm transition",
                  c === color ? "border-bronze bg-bronze/10 text-ink" : "border-line bg-white text-stone hover:border-bronze",
                )}
              >
                {c}
              </button>
            ))}
          </div>
        </fieldset>
      )}
      {product.sizes.length > 0 && (
        <fieldset>
          <legend className="label">
            Size: <span className="font-normal text-stone">{size}</span>
          </legend>
          <div className="flex flex-wrap gap-2">
            {product.sizes.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSize(s)}
                aria-pressed={s === size}
                className={cn(
                  "rounded-md border px-4 py-2 text-sm transition",
                  s === size ? "border-bronze bg-bronze/10 text-ink" : "border-line bg-white text-stone hover:border-bronze",
                )}
              >
                {s}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      <div className="flex items-center gap-4">
        <div className="flex items-center rounded-md border border-line bg-white">
          <button type="button" className="p-3 text-stone hover:text-ink disabled:opacity-40" onClick={() => setQty((q) => Math.max(1, q - 1))} disabled={qty <= 1} aria-label="Decrease quantity">
            <Minus className="h-4 w-4" />
          </button>
          <span className="w-10 text-center text-sm font-medium" aria-live="polite">{qty}</span>
          <button
            type="button"
            className="p-3 text-stone hover:text-ink disabled:opacity-40"
            onClick={() => setQty((q) => Math.min(product.stock, q + 1))}
            disabled={qty >= product.stock}
            aria-label="Increase quantity"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
        <p className={cn("text-sm", soldOut ? "text-red-700" : low ? "text-bronze-dark" : "text-whatsapp")}>
          {soldOut ? "Out of stock" : low ? `Only ${product.stock} left` : "In stock, ready to ship"}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <button className="btn-primary py-3.5" onClick={() => addToCart()} disabled={soldOut}>
          <ShoppingBag className="h-4 w-4" /> Add to cart
        </button>
        <button className="btn-dark py-3.5" onClick={() => addToCart(true)} disabled={soldOut}>
          Buy now
        </button>
      </div>
      {whatsappNumber && (
        <a
          href={`https://wa.me/${whatsappNumber.replace(/\D/g, "")}?text=${waText}`}
          target="_blank"
          rel="noopener noreferrer"
          className="btn w-full border border-whatsapp py-3.5 text-whatsapp hover:bg-whatsapp hover:text-white"
        >
          <WhatsAppIcon className="h-4 w-4" /> Ask or order on WhatsApp
        </a>
      )}
    </div>
  );
}
