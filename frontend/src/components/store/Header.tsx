"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, Menu, Newspaper, Search, ShoppingBag, X } from "lucide-react";
import Logo from "./Logo";
import { cartCount, useCart } from "@/lib/cart";
import { useHydrated } from "@/lib/hooks";
import { cn } from "@/lib/format";
import type { Category } from "@/lib/types";

export default function Header({ categories }: { categories: Category[] }) {
  const pathname = usePathname();
  const router = useRouter();
  const items = useCart((s) => s.items);
  const hydrated = useHydrated();
  const count = hydrated ? cartCount(items) : 0;
  const [open, setOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [q, setQ] = useState("");
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
  }, [open]);

  const nav = [
    { href: "/blog", label: "Blog" },
    { href: "/about", label: "About Us" },
    { href: "/contact", label: "Contact" },
  ];

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchOpen(false);
    setOpen(false);
    router.push(`/shop?q=${encodeURIComponent(q.trim())}`);
  };

  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b bg-linen/95 backdrop-blur transition-shadow",
        scrolled ? "border-line shadow-[0_6px_20px_-14px_rgba(31,27,23,0.35)]" : "border-transparent",
      )}
    >
      <div className="container-x flex h-[72px] items-center justify-between gap-4">
        <button className="-ml-2 p-2 lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu">
          <Menu className="h-5 w-5" />
        </button>

        <Logo />

        <nav className="hidden items-center gap-8 text-[13px] font-medium text-cocoa lg:flex" aria-label="Main">
          <Link
            href="/shop"
            aria-current={pathname === "/shop" ? "page" : undefined}
            className={cn("py-6 hover:text-bronze", (pathname === "/shop" || pathname.startsWith("/product/")) && "text-bronze")}
          >
            Shop
          </Link>
          <CategoriesMenu categories={categories} />
          {nav.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              aria-current={pathname.startsWith(n.href) ? "page" : undefined}
              className={cn("py-6 hover:text-bronze", !n.href.includes("?") && pathname.startsWith(n.href) && "text-bronze")}
            >
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-1">
          <Link
            href="/blog"
            className={cn(
              "flex items-center gap-1.5 rounded-full px-3 py-2 text-[13px] font-medium hover:bg-sand lg:hidden",
              pathname.startsWith("/blog") ? "text-bronze" : "text-cocoa",
            )}
          >
            <Newspaper className="h-[18px] w-[18px]" />
            <span className="hidden sm:inline">Blog</span>
            <span className="sr-only sm:hidden">Blog</span>
          </Link>
          <button className="rounded-full p-2.5 hover:bg-sand" onClick={() => setSearchOpen((v) => !v)} aria-label="Search">
            <Search className="h-[18px] w-[18px]" />
          </button>
          <Link href="/cart" className="relative rounded-full p-2.5 hover:bg-sand" aria-label={`Cart, ${count} items`}>
            <ShoppingBag className="h-[18px] w-[18px]" />
            <span
              className={cn(
                "absolute right-0.5 top-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-bronze px-1 text-[10px] font-semibold text-white transition",
                count === 0 && "scale-0",
              )}
            >
              {count}
            </span>
          </Link>
        </div>
      </div>

      {searchOpen && (
        <div className="border-t border-line bg-linen">
          <form onSubmit={submitSearch} className="container-x flex items-center gap-3 py-3">
            <Search className="h-4 w-4 text-mist" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search curtains, sheets, blinds, rugs…"
              className="w-full bg-transparent py-2 text-sm outline-none placeholder:text-mist"
            />
            <button className="btn-primary btn-sm">Search</button>
          </form>
        </div>
      )}

      {/* Mobile drawer */}
      <div className={cn("fixed inset-0 z-50 lg:hidden", open ? "visible" : "invisible")}>
        <div className={cn("absolute inset-0 bg-ink/40 transition-opacity", open ? "opacity-100" : "opacity-0")} onClick={() => setOpen(false)} />
        <aside
          className={cn(
            "absolute inset-y-0 left-0 flex w-[86%] max-w-sm flex-col bg-linen shadow-lift transition-transform duration-300",
            open ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <div className="flex h-[72px] items-center justify-between border-b border-line px-5">
            <Logo />
            <button onClick={() => setOpen(false)} className="p-2" aria-label="Close menu">
              <X className="h-5 w-5" />
            </button>
          </div>
          <form onSubmit={submitSearch} className="m-5 flex items-center gap-2 rounded-md border border-line bg-white px-3">
            <Search className="h-4 w-4 text-mist" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products" className="w-full py-2.5 text-sm outline-none" />
          </form>
          <nav className="flex-1 overflow-y-auto px-5 pb-8" onClick={() => setOpen(false)}>
            <p className="eyebrow mb-2">Shop by category</p>
            <Link href="/shop" className="block border-b border-line py-3 font-serif text-xl">All Products</Link>
            {categories.map((c) => (
              <Link key={c.id} href={`/shop?category=${c.slug}`} className="flex items-center justify-between border-b border-line py-3 font-serif text-xl">
                {c.name} <span className="font-sans text-xs text-mist">{c.product_count}</span>
              </Link>
            ))}
            <Link href="/blog" className="mt-6 flex items-center justify-between border-y border-line py-3 font-serif text-xl">
              Blog & Guides <Newspaper className="h-4 w-4 text-bronze" />
            </Link>
            <p className="eyebrow mb-2 mt-8">Company</p>
            <Link href="/about" className="block py-2 text-sm">About Us</Link>
            <Link href="/contact" className="block py-2 text-sm">Contact</Link>
            <Link href="/cart" className="block py-2 text-sm">Cart ({count})</Link>
          </nav>
        </aside>
      </div>
    </header>
  );
}

/** "Categories" dropdown: opens on hover or click, closes on Escape, outside click or mouse leave. */
function CategoriesMenu({ categories }: { categories: Category[] }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    };
    const onClick = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  const show = () => {
    clearTimeout(closeTimer.current);
    setOpen(true);
  };
  // Short delay so moving the pointer from the button to the panel doesn't close it.
  const hide = () => {
    closeTimer.current = setTimeout(() => setOpen(false), 120);
  };

  return (
    <div
      ref={root}
      className="relative"
      onMouseEnter={show}
      onMouseLeave={hide}
      onBlur={(e) => !root.current?.contains(e.relatedTarget as Node) && setOpen(false)}
    >
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls="categories-menu"
        onClick={() => setOpen((v) => !v)}
        className={cn("flex items-center gap-1 py-6 hover:text-bronze", open && "text-bronze")}
      >
        Categories <ChevronDown className={cn("h-3.5 w-3.5 transition", open && "rotate-180")} />
      </button>
      <div
        id="categories-menu"
        className={cn(
          "absolute left-1/2 top-full z-50 w-[520px] -translate-x-1/2 rounded-xl bg-white p-5 shadow-lift transition-all duration-200",
          open ? "visible translate-y-0 opacity-100" : "invisible translate-y-2 opacity-0",
        )}
      >
        <p className="eyebrow mb-3">Shop by category</p>
        <ul className="grid grid-cols-2 gap-2">
          {categories.map((c) => (
            <li key={c.id}>
              <Link
                href={`/shop?category=${c.slug}`}
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 rounded-lg p-2 hover:bg-cream focus-visible:bg-cream focus-visible:outline-none"
              >
                <span
                  className="h-12 w-12 shrink-0 rounded-md bg-sand bg-cover bg-center"
                  style={{ backgroundImage: c.image_url ? `url(${c.image_url.replace("w=1200", "w=160")})` : undefined }}
                />
                <span>
                  <span className="block text-sm text-ink">{c.name}</span>
                  <span className="text-xs font-normal text-mist">{c.product_count} items</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
        <Link
          href="/shop"
          onClick={() => setOpen(false)}
          className="mt-3 block rounded-lg bg-cream px-3 py-2.5 text-center text-xs uppercase tracking-[0.18em] text-bronze hover:bg-sand"
        >
          View all products
        </Link>
      </div>
    </div>
  );
}
