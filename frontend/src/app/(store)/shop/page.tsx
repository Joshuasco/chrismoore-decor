import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import InfiniteProducts from "@/components/store/InfiniteProducts";
import SortSelect from "@/components/store/SortSelect";
import { getCategories, getProducts } from "@/lib/api";
import { cn } from "@/lib/format";

type SP = Promise<Record<string, string | string[] | undefined>>;

const PRICE_RANGES = [
  { label: "Under ₦30,000", min: "", max: "3000000" },
  { label: "₦30,000 – ₦70,000", min: "3000000", max: "7000000" },
  { label: "₦70,000 – ₦120,000", min: "7000000", max: "12000000" },
  { label: "Over ₦120,000", min: "12000000", max: "" },
];

export async function generateMetadata({ searchParams }: { searchParams: SP }): Promise<Metadata> {
  const sp = await searchParams;
  const cat = typeof sp.category === "string" ? sp.category : "";
  const name = cat ? cat.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "Shop All";
  return { title: name };
}

export default async function ShopPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const get = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const category = get("category");
  const q = get("q");
  const sort = get("sort");
  const min = get("min");
  const max = get("max");
  const page = Math.max(1, Number(get("page")) || 1);

  const PER_PAGE = 9;
  const [categories, firstTry] = await Promise.all([
    getCategories(),
    getProducts({ category, q, sort, min, max, page, limit: PER_PAGE }),
  ]);
  // A stale ?page= past the end (e.g. an old shared link) shows the last page instead of nothing.
  const lastPage = Math.max(1, Math.ceil(firstTry.total / PER_PAGE));
  const products =
    firstTry.items.length === 0 && firstTry.total > 0 && page > lastPage
      ? await getProducts({ category, q, sort, min, max, page: lastPage, limit: PER_PAGE })
      : firstTry;
  const active = categories.find((c) => c.slug === category);

  const href = (patch: Record<string, string>) => {
    const next = new URLSearchParams();
    const merged = { category, q, sort, min, max, ...patch };
    Object.entries(merged).forEach(([k, v]) => v && next.set(k, v));
    if (!("page" in patch)) next.delete("page");
    const s = next.toString();
    return s ? `/shop?${s}` : "/shop";
  };

  const filters = (
    <div className="space-y-8">
      <div>
        <h3 className="eyebrow mb-3 text-ink">Categories</h3>
        <ul className="space-y-1 text-sm">
          <li>
            <Link href={href({ category: "" })} className={cn("flex justify-between rounded-md px-2 py-1.5 hover:bg-sand", !category && "bg-sand font-medium text-ink")}>
              All products
            </Link>
          </li>
          {categories.map((c) => (
            <li key={c.id}>
              <Link
                href={href({ category: c.slug })}
                className={cn("flex justify-between rounded-md px-2 py-1.5 text-stone hover:bg-sand", category === c.slug && "bg-sand font-medium text-ink")}
              >
                {c.name} <span className="text-xs text-mist">{c.product_count}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <h3 className="eyebrow mb-3 text-ink">Price</h3>
        <ul className="space-y-1 text-sm">
          {PRICE_RANGES.map((r) => {
            const on = r.min === min && r.max === max;
            return (
              <li key={r.label}>
                <Link
                  href={on ? href({ min: "", max: "" }) : href({ min: r.min, max: r.max })}
                  className={cn("flex items-center gap-2 rounded-md px-2 py-1.5 text-stone hover:bg-sand", on && "bg-sand font-medium text-ink")}
                >
                  <span className={cn("h-3.5 w-3.5 rounded-full border", on ? "border-bronze bg-bronze" : "border-oat")} />
                  {r.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );

  return (
    <>
      <section className="border-b border-line bg-cream">
        <div className="container-x py-12 sm:py-16">
          <nav className="text-xs text-mist" aria-label="Breadcrumb">
            <Link href="/" className="hover:text-bronze">Home</Link> / <Link href="/shop" className="hover:text-bronze">Shop</Link>
            {active && <> / <span className="text-stone">{active.name}</span></>}
          </nav>
          <h1 className="heading mt-3 text-4xl sm:text-5xl">{q ? `Results for “${q}”` : active?.name ?? "Shop All"}</h1>
          <p className="mt-3 max-w-xl text-sm text-stone">
            {active?.description || "Curtains & accessories, bed sheets, vertical blinds and rugs — everything to finish your rooms beautifully."}
          </p>
        </div>
      </section>

      <div className="container-x mt-10 grid gap-10 lg:grid-cols-[220px_1fr]">
        <aside className="hidden self-start lg:sticky lg:top-28 lg:block">{filters}</aside>

        <div>
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <details className="group relative lg:hidden">
              <summary className="btn-outline btn-sm cursor-pointer list-none">
                <SlidersHorizontal className="h-4 w-4" /> Filters
              </summary>
              <div className="absolute left-0 top-12 z-20 w-72 rounded-xl bg-white p-5 shadow-lift">{filters}</div>
            </details>
            <p className="text-sm text-stone">
              {products.total} {products.total === 1 ? "product" : "products"}
            </p>
            <Suspense>
              <SortSelect />
            </Suspense>
          </div>

          {(q || min || max) && (
            <div className="mb-6 flex flex-wrap gap-2">
              {q && (
                <Link href={href({ q: "" })} className="flex items-center gap-1 rounded-full bg-sand px-3 py-1 text-xs">
                  “{q}” <X className="h-3 w-3" />
                </Link>
              )}
              {(min || max) && (
                <Link href={href({ min: "", max: "" })} className="flex items-center gap-1 rounded-full bg-sand px-3 py-1 text-xs">
                  Price filter <X className="h-3 w-3" />
                </Link>
              )}
            </div>
          )}

          {products.items.length === 0 ? (
            <div className="rounded-xl border border-dashed border-line p-16 text-center">
              <p className="font-serif text-2xl">No products found</p>
              <p className="mt-2 text-sm text-stone">Try another category or clear your filters.</p>
              <Link href="/shop" className="btn-primary mt-6">View all products</Link>
            </div>
          ) : (
            // Re-mount (reset scroll state) whenever the filters change.
            <InfiniteProducts key={[category, q, sort, min, max].join("|")} initial={products} filters={{ category, q, sort, min, max }} />
          )}
        </div>
      </div>
    </>
  );
}
