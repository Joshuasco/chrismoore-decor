"use client";

import Image from "next/image";
import Link from "next/link";
import toast from "react-hot-toast";
import { ShoppingBag } from "lucide-react";
import Stars from "./Stars";
import { useCart } from "@/lib/cart";
import { cn, formatNaira } from "@/lib/format";
import type { Product } from "@/lib/types";

export default function ProductCard({ product, priority = false }: { product: Product; priority?: boolean }) {
  const add = useCart((s) => s.add);
  const soldOut = product.stock <= 0;
  const onSale = product.compare_at_price && product.compare_at_price > product.price;

  const addToCart = () => {
    if (soldOut) return;
    const item = add(product);
    toast.success(
      <span>
        <b className="font-medium">{product.name}</b> added to cart
        {item.color || item.size ? <span className="block text-xs opacity-70">{[item.color, item.size].filter(Boolean).join(" · ")}</span> : null}
      </span>,
    );
  };

  return (
    <article className="group flex flex-col overflow-hidden rounded-xl bg-white shadow-card transition-shadow duration-300 hover:shadow-lift">
      <Link href={`/product/${product.slug}`} className="relative block aspect-[4/3.4] overflow-hidden bg-sand">
        {product.images[0] && (
          <Image
            src={product.images[0]}
            alt={product.name}
            fill
            priority={priority}
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-cover transition-transform duration-700 group-hover:scale-105"
          />
        )}
        {product.images[1] && (
          <Image
            src={product.images[1]}
            alt=""
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-cover opacity-0 transition-opacity duration-500 group-hover:opacity-100"
          />
        )}
        <div className="absolute left-3 top-3 flex flex-col gap-1.5">
          {soldOut ? (
            <span className="rounded bg-ink/85 px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-white">Sold out</span>
          ) : (
            <>
              {product.badge && (
                <span className="rounded bg-bronze px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-white">{product.badge}</span>
              )}
              {onSale && (
                <span className="rounded bg-white px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-bronze-dark">
                  -{Math.round((1 - product.price / product.compare_at_price!) * 100)}%
                </span>
              )}
            </>
          )}
        </div>
      </Link>

      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <p className="text-[10px] uppercase tracking-[0.18em] text-mist">{product.category_name}</p>
        <h3 className="mt-1 font-serif text-[19px] font-semibold leading-snug text-ink sm:text-xl">
          <Link href={`/product/${product.slug}`} className="hover:text-bronze-dark">
            {product.name}
          </Link>
        </h3>
        <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-bronze-dark/90">{product.short_description}</p>
        <div className="mt-2">
          {product.review_count > 0 ? (
            <Stars rating={product.rating} count={product.review_count} />
          ) : (
            <p className="text-[11px] text-mist">No reviews yet</p>
          )}
        </div>
        <div className="mt-auto flex items-end justify-between gap-2 pt-4">
          <div>
            <p className="text-[17px] font-semibold text-ink">{formatNaira(product.price)}</p>
            {onSale && <p className="text-xs text-mist line-through">{formatNaira(product.compare_at_price!)}</p>}
          </div>
          <button
            onClick={addToCart}
            disabled={soldOut}
            aria-label={soldOut ? "Sold out" : `Add ${product.name} to cart`}
            className={cn(
              "grid h-10 w-10 shrink-0 place-items-center rounded-md text-white transition active:scale-95",
              soldOut ? "cursor-not-allowed bg-oat" : "bg-bronze hover:bg-bronze-dark",
            )}
          >
            <ShoppingBag className="h-4 w-4" />
          </button>
        </div>
        <Link href={`/product/${product.slug}`} className="btn-primary btn-sm mt-3 w-full rounded-md">
          View Product
        </Link>
      </div>
    </article>
  );
}
