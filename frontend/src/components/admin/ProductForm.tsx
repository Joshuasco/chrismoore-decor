"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { ImagePlus, Loader2, Trash2, X } from "lucide-react";
import { Panel } from "./ui";
import { adminFetch } from "@/lib/admin";
import type { Category, Product } from "@/lib/types";

type FormState = {
  name: string;
  slug: string;
  sku: string;
  category_id: string;
  short_description: string;
  description: string;
  price: string; // naira
  compare_at_price: string; // naira
  stock: string;
  low_stock_threshold: string;
  images: string[];
  colors: string;
  sizes: string;
  material: string;
  badge: string;
  is_featured: boolean;
  is_active: boolean;
};

const toForm = (p?: Product): FormState => ({
  name: p?.name ?? "",
  slug: p?.slug ?? "",
  sku: p?.sku ?? "",
  category_id: p?.category_id ?? "",
  short_description: p?.short_description ?? "",
  description: p?.description ?? "",
  price: p ? String(p.price / 100) : "",
  compare_at_price: p?.compare_at_price ? String(p.compare_at_price / 100) : "",
  stock: p ? String(p.stock) : "0",
  low_stock_threshold: p ? String(p.low_stock_threshold) : "5",
  images: p?.images ?? [],
  colors: p?.colors.join(", ") ?? "",
  sizes: p?.sizes.join(", ") ?? "",
  material: p?.material ?? "",
  badge: p?.badge ?? "",
  is_featured: p?.is_featured ?? false,
  is_active: p?.is_active ?? true,
});

const list = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);
const kobo = (naira: string) => Math.round(Number(naira || 0) * 100);

export default function ProductForm({ product }: { product?: Product }) {
  const router = useRouter();
  const [f, setF] = useState<FormState>(() => toForm(product));
  const [categories, setCategories] = useState<Category[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    adminFetch<Category[]>("/categories").then(setCategories).catch(() => {});
  }, []);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((s) => ({ ...s, [k]: v }));
  const input = (k: keyof FormState) => ({
    value: f[k] as string,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => set(k, e.target.value as never),
  });

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append("file", file);
        const { url } = await adminFetch<{ url: string }>("/uploads", { method: "POST", body: fd });
        setF((s) => ({ ...s, images: [...s.images, url] }));
      }
      toast.success("Image uploaded");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const addUrl = () => {
    try {
      if (new URL(imageUrl.trim()).protocol !== "https:") throw new Error();
    } catch {
      toast.error("Enter a valid image URL starting with https://");
      return;
    }
    set("images", [...f.images, imageUrl.trim()]);
    setImageUrl("");
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const body = {
      name: f.name,
      slug: f.slug,
      sku: f.sku,
      category_id: f.category_id || null,
      short_description: f.short_description,
      description: f.description,
      price: kobo(f.price),
      compare_at_price: f.compare_at_price ? kobo(f.compare_at_price) : null,
      stock: Number(f.stock || 0),
      low_stock_threshold: Number(f.low_stock_threshold || 5),
      images: f.images,
      colors: list(f.colors),
      sizes: list(f.sizes),
      material: f.material,
      badge: f.badge,
      is_featured: f.is_featured,
      is_active: f.is_active,
    };
    try {
      const saved = await adminFetch<Product>(product ? `/products/${product.id}` : "/products", {
        method: product ? "PUT" : "POST",
        body: JSON.stringify(body),
      });
      toast.success(product ? "Product saved" : "Product created");
      if (!product) router.replace(`/admin/products/${saved.id}`);
      else setF(toForm(saved));
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!product || !confirm(`Delete “${product.name}”? Past orders keep their line items.`)) return;
    try {
      await adminFetch(`/products/${product.id}`, { method: "DELETE" });
      toast.success("Product deleted");
      router.replace("/admin/products");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <form onSubmit={save} className="grid gap-6 xl:grid-cols-[2fr_1fr]">
      <div className="space-y-6">
        <Panel title="Details">
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="label" htmlFor="name">Name</label>
              <input id="name" required className="input" {...input("name")} />
            </div>
            <div>
              <label className="label" htmlFor="sku">SKU</label>
              <input id="sku" required className="input" {...input("sku")} placeholder="CUR-010" />
            </div>
            <div>
              <label className="label" htmlFor="slug">URL slug (optional)</label>
              <input id="slug" className="input" {...input("slug")} placeholder="auto from name" />
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="short">Short description</label>
              <input id="short" className="input" {...input("short_description")} maxLength={160} />
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="desc">Full description</label>
              <textarea id="desc" rows={5} className="input" {...input("description")} />
            </div>
          </div>
        </Panel>

        <Panel title="Images">
          <div className="p-5">
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
              {f.images.map((src, i) => (
                <div key={src + i} className="group relative aspect-square overflow-hidden rounded-lg bg-sand">
                  <Image src={src} alt="" fill sizes="120px" className="object-cover" />
                  {i === 0 && <span className="absolute left-1.5 top-1.5 rounded bg-ink/80 px-1.5 py-0.5 text-[10px] text-white">Main</span>}
                  <button
                    type="button"
                    onClick={() => set("images", f.images.filter((_, j) => j !== i))}
                    className="absolute right-1.5 top-1.5 rounded bg-white/90 p-1 opacity-0 transition group-hover:opacity-100"
                    aria-label="Remove image"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="grid aspect-square place-items-center rounded-lg border-2 border-dashed border-oat text-stone hover:border-bronze hover:text-bronze"
              >
                {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <span className="flex flex-col items-center gap-1 text-xs"><ImagePlus className="h-5 w-5" /> Upload</span>}
              </button>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple hidden onChange={(e) => upload(e.target.files)} />
            </div>
            <div className="mt-4 flex gap-2">
              <input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} className="input" placeholder="…or paste an image URL" />
              <button type="button" onClick={addUrl} className="btn-outline btn-sm">Add</button>
            </div>
          </div>
        </Panel>

        <Panel title="Options">
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="colors">Colours (comma separated)</label>
              <input id="colors" className="input" {...input("colors")} placeholder="Ivory, Sand, Taupe" />
            </div>
            <div>
              <label className="label" htmlFor="sizes">Sizes (comma separated)</label>
              <input id="sizes" className="input" {...input("sizes")} placeholder="140 x 230 cm, 140 x 260 cm" />
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="material">Material</label>
              <input id="material" className="input" {...input("material")} />
            </div>
          </div>
        </Panel>
      </div>

      <div className="space-y-6">
        <Panel title="Pricing & stock">
          <div className="grid gap-4 p-5">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label" htmlFor="price">Price (₦)</label>
                <input id="price" type="number" min="0" step="0.01" required className="input" {...input("price")} />
              </div>
              <div>
                <label className="label" htmlFor="compare">Compare-at (₦)</label>
                <input id="compare" type="number" min="0" step="0.01" className="input" {...input("compare_at_price")} />
              </div>
              <div>
                <label className="label" htmlFor="stock">Stock</label>
                <input id="stock" type="number" min="0" required className="input" {...input("stock")} />
              </div>
              <div>
                <label className="label" htmlFor="low">Low-stock alert at</label>
                <input id="low" type="number" min="1" className="input" {...input("low_stock_threshold")} />
              </div>
            </div>
            {product && <p className="text-xs text-mist">Stock edits here are logged as a manual adjustment. Use Inventory for restocks with a reason.</p>}
          </div>
        </Panel>
        <Panel title="Organisation">
          <div className="grid gap-4 p-5">
            <div>
              <label className="label" htmlFor="cat">Category</label>
              <select id="cat" className="input" {...input("category_id")}>
                <option value="">— None —</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="badge">Badge</label>
              <input id="badge" className="input" {...input("badge")} placeholder="Best Seller, New, Sale…" />
            </div>
            {product && (
              <p className="rounded-md bg-cream px-3 py-2 text-xs text-stone">
                Rating {product.review_count > 0 ? `${product.rating.toFixed(1)} from ${product.review_count} approved reviews` : "— no approved reviews yet"}.
                Ratings are calculated from customer reviews (Admin → Reviews).
              </p>
            )}
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={f.is_active} onChange={(e) => set("is_active", e.target.checked)} className="h-4 w-4 accent-[#a8875e]" /> Visible in store
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={f.is_featured} onChange={(e) => set("is_featured", e.target.checked)} className="h-4 w-4 accent-[#a8875e]" /> Feature on home page
            </label>
          </div>
        </Panel>
        <div className="flex gap-3">
          <button className="btn-primary flex-1" disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} {product ? "Save changes" : "Create product"}
          </button>
          {product && (
            <button type="button" onClick={remove} className="btn border border-red-200 text-red-700 hover:bg-red-50" aria-label="Delete product">
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </form>
  );
}
