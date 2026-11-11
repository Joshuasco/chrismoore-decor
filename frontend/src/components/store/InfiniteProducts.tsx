"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUp, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import ProductCard from "./ProductCard";
import { getProducts } from "@/lib/api";
import { cn } from "@/lib/format";
import type { Product, ProductPage } from "@/lib/types";

type Filters = { category: string; q: string; sort: string; min: string; max: string };

/** Pages within this distance of the loaded range are fetched in-between; farther jumps restart the list. */
const BRIDGE = 3;
/** How far above the viewport's top the "current page" line sits (fraction of viewport height). */
const ACTIVE_LINE = 0.35;

export default function InfiniteProducts({ initial, filters }: { initial: ProductPage; filters: Filters }) {
  const { limit, total } = initial;
  const pageCount = Math.max(1, Math.ceil(total / limit));

  // Loaded pages always form a contiguous range [first, last].
  const [pages, setPages] = useState<Record<number, Product[]>>({ [initial.page]: initial.items });
  const [first, setFirst] = useState(initial.page);
  const [last, setLast] = useState(initial.page);
  const [active, setActive] = useState(initial.page);
  const [loading, setLoading] = useState<"next" | "prev" | "jump" | null>(null);
  const [error, setError] = useState("");
  // Page to scroll to once it has rendered (set before loading it).
  const pendingScroll = useRef<number | null>(null);

  const busy = useRef(false);
  const sentinel = useRef<HTMLDivElement>(null);
  // Latest loaded range for observers/scroll handlers created in earlier renders.
  const rangeRef = useRef({ first, last });
  useEffect(() => {
    rangeRef.current = { first, last };
  }, [first, last]);

  const fetchPage = useCallback(
    async (n: number) => {
      const res = await getProducts({ ...filters, page: n, limit });
      return res.items;
    },
    [filters, limit],
  );

  /** Fetch several pages in parallel and merge them into state. */
  const load = useCallback(
    async (nums: number[], mode: "next" | "prev" | "jump", reset = false) => {
      if (busy.current || nums.length === 0) return false;
      busy.current = true;
      setLoading(mode);
      setError("");
      try {
        const results = await Promise.all(nums.map(fetchPage));
        const fetched = Object.fromEntries(nums.map((n, i) => [n, results[i]]));
        setPages((cur) => (reset ? fetched : { ...cur, ...fetched }));
        const lo = Math.min(...nums);
        const hi = Math.max(...nums);
        setFirst((f) => (reset ? lo : Math.min(f, lo)));
        setLast((l) => (reset ? hi : Math.max(l, hi)));
        return true;
      } catch (e) {
        setError((e as Error).message || "Couldn't load more products.");
        return false;
      } finally {
        busy.current = false;
        setLoading(null);
      }
    },
    [fetchPage],
  );

  // Infinite scroll: load the next page as the sentinel approaches the viewport.
  useEffect(() => {
    const el = sentinel.current;
    if (!el || last >= pageCount) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !busy.current) load([rangeRef.current.last + 1], "next");
      },
      { rootMargin: "0px 0px 600px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [last, pageCount, load]);

  // Track which page is at the top of the screen; mirror it in the URL.
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const line = window.innerHeight * ACTIVE_LINE;
      let current = rangeRef.current.first;
      for (let n = rangeRef.current.first; n <= rangeRef.current.last; n++) {
        const anchor = document.getElementById(`page-${n}`);
        if (anchor && anchor.getBoundingClientRect().top <= line) current = n;
      }
      // At the very bottom, the last page is the active one even if its first row never reached the line.
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) current = rangeRef.current.last;
      setActive((a) => (a === current ? a : current));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [first, last]);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (active > 1) url.searchParams.set("page", String(active));
    else url.searchParams.delete("page");
    if (url.href !== window.location.href) window.history.replaceState(window.history.state, "", url);
  }, [active]);

  const scrollToPage = (n: number) =>
    document.getElementById(`page-${n}`)?.scrollIntoView({ behavior: "smooth", block: "start" });

  // Scroll to a freshly loaded page once it is in the DOM.
  useEffect(() => {
    const n = pendingScroll.current;
    if (n !== null && pages[n]) {
      pendingScroll.current = null;
      scrollToPage(n);
    }
  }, [pages]);

  const goTo = async (n: number) => {
    if (n < 1 || n > pageCount || busy.current) return;
    setActive(n);
    if (n >= first && n <= last) {
      scrollToPage(n);
      return;
    }
    pendingScroll.current = n;
    let ok: boolean;
    if (n > last && n - last <= BRIDGE) {
      ok = await load(range(last + 1, n), "next");
    } else if (n < first && first - n <= BRIDGE) {
      ok = await load(range(n, first - 1), "prev");
    } else {
      // Far jump: restart the list at that page; earlier pages load on demand.
      ok = await load([n], "jump", true);
    }
    if (!ok) pendingScroll.current = null;
  };

  const loadedCount = Object.values(pages).reduce((n, items) => n + items.length, 0);
  const shownFrom = (first - 1) * limit + 1;
  const shownTo = Math.min(total, (first - 1) * limit + loadedCount);
  const ordered = Array.from({ length: last - first + 1 }, (_, i) => first + i);

  return (
    <div>
      {first > 1 && (
        <div className="mb-6 flex justify-center">
          <button onClick={() => goTo(first - 1)} disabled={!!loading} className="btn-outline btn-sm">
            {loading === "prev" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
            Show previous products (page {first - 1})
          </button>
        </div>
      )}

      <div className={cn("grid grid-cols-2 gap-3 transition-opacity sm:gap-6 xl:grid-cols-3", loading === "jump" && "opacity-40")}>
        {ordered.flatMap((n) =>
          (pages[n] ?? []).map((p, i) => (
            <div key={p.id} id={i === 0 ? `page-${n}` : undefined} data-page={n} className="scroll-mt-28">
              <ProductCard product={p} priority={n === initial.page && i < 3} />
            </div>
          )),
        )}
        {loading === "next" &&
          Array.from({ length: Math.min(limit, total - shownTo) || 3 }, (_, i) => (
            <div key={`sk-${i}`} className="animate-pulse overflow-hidden rounded-xl bg-white shadow-card" aria-hidden>
              <div className="aspect-[4/3.4] bg-sand" />
              <div className="space-y-2 p-5">
                <div className="h-3 w-1/3 rounded bg-sand" />
                <div className="h-5 w-3/4 rounded bg-sand" />
                <div className="h-3 w-full rounded bg-sand" />
                <div className="h-9 rounded bg-sand" />
              </div>
            </div>
          ))}
      </div>

      {/* Infinite-scroll trigger */}
      <div ref={sentinel} aria-hidden className="h-px" />

      <p className="sr-only" aria-live="polite">
        Showing products {shownFrom} to {shownTo} of {total}. Page {active} of {pageCount}.
      </p>

      {error && (
        <div className="mt-8 flex flex-col items-center gap-3 text-center">
          <p className="text-sm text-red-700">{error}</p>
          <button className="btn-outline btn-sm" onClick={() => load([last + 1], "next")}>Try again</button>
        </div>
      )}

      {last >= pageCount && !loading && (
        <p className="mt-12 text-center text-sm text-stone">
          You&apos;ve seen all {total} {total === 1 ? "product" : "products"}.
        </p>
      )}

      {pageCount > 1 && (
        <nav
          aria-label="Pagination"
          className="sticky bottom-4 z-20 mx-auto mt-10 flex w-fit max-w-full items-center gap-1 rounded-full border border-line bg-white/95 p-1.5 shadow-lift backdrop-blur"
        >
          <button
            onClick={() => goTo(active - 1)}
            disabled={active <= 1 || !!loading}
            className="grid h-9 w-9 place-items-center rounded-full text-stone hover:bg-sand disabled:opacity-30"
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          {pageList(active, pageCount).map((n, i) =>
            n === null ? (
              <span key={`gap-${i}`} className="px-1 text-sm text-mist">…</span>
            ) : (
              <button
                key={n}
                onClick={() => goTo(n)}
                disabled={!!loading}
                aria-current={n === active ? "page" : undefined}
                aria-label={`Page ${n}`}
                className={cn(
                  "grid h-9 min-w-9 place-items-center rounded-full px-2 text-sm transition-colors duration-300",
                  n === active ? "bg-bronze text-white shadow-sm" : "text-cocoa hover:bg-sand",
                  n >= first && n <= last && n !== active && "font-medium",
                )}
              >
                {loading && n === active && loading !== "next" ? <Loader2 className="h-4 w-4 animate-spin" /> : n}
              </button>
            ),
          )}
          <button
            onClick={() => goTo(active + 1)}
            disabled={active >= pageCount || !!loading}
            className="grid h-9 w-9 place-items-center rounded-full text-stone hover:bg-sand disabled:opacity-30"
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </nav>
      )}
    </div>
  );
}

function range(a: number, b: number) {
  return Array.from({ length: b - a + 1 }, (_, i) => a + i);
}

/** 1 … 4 5 6 … 12 — always shows first, last and neighbours of the active page. */
function pageList(active: number, count: number): (number | null)[] {
  if (count <= 7) return range(1, count);
  const set = new Set([1, count, active - 1, active, active + 1].filter((n) => n >= 1 && n <= count));
  const sorted = [...set].sort((a, b) => a - b);
  const out: (number | null)[] = [];
  sorted.forEach((n, i) => {
    if (i > 0 && n - sorted[i - 1] > 1) out.push(null);
    out.push(n);
  });
  return out;
}
