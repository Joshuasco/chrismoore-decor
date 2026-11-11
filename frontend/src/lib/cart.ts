"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Product } from "./types";

export type CartItem = {
  key: string;
  productId: string;
  slug: string;
  name: string;
  image: string;
  price: number;
  quantity: number;
  stock: number;
  color: string;
  size: string;
};

type CartState = {
  items: CartItem[];
  add: (p: Product, opts?: { quantity?: number; color?: string; size?: string }) => CartItem;
  setQuantity: (key: string, quantity: number) => void;
  remove: (key: string) => void;
  clear: () => void;
};

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      add: (p, opts = {}) => {
        const color = opts.color ?? p.colors[0] ?? "";
        const size = opts.size ?? p.sizes[0] ?? "";
        const key = `${p.id}|${color}|${size}`;
        const qty = Math.max(1, opts.quantity ?? 1);
        const existing = get().items.find((i) => i.key === key);
        const item: CartItem = existing
          ? { ...existing, quantity: Math.min(existing.quantity + qty, p.stock), stock: p.stock, price: p.price }
          : {
              key,
              productId: p.id,
              slug: p.slug,
              name: p.name,
              image: p.images[0] ?? "",
              price: p.price,
              quantity: Math.min(qty, p.stock),
              stock: p.stock,
              color,
              size,
            };
        set({ items: existing ? get().items.map((i) => (i.key === key ? item : i)) : [...get().items, item] });
        return item;
      },
      setQuantity: (key, quantity) =>
        set({
          items: get().items.map((i) =>
            i.key === key ? { ...i, quantity: Math.max(1, Math.min(quantity, i.stock || quantity)) } : i,
          ),
        }),
      remove: (key) => set({ items: get().items.filter((i) => i.key !== key) }),
      clear: () => set({ items: [] }),
    }),
    { name: "cmd-cart", version: 1 },
  ),
);

export const cartCount = (items: CartItem[]) => items.reduce((n, i) => n + i.quantity, 0);
export const cartSubtotal = (items: CartItem[]) => items.reduce((n, i) => n + i.price * i.quantity, 0);
