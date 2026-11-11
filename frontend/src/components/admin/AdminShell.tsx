"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Boxes, ExternalLink, MessageSquareQuote, Newspaper, FolderTree, LayoutDashboard, LogOut, Mail, Menu, Package, Settings, ShoppingCart, X } from "lucide-react";
import Logo from "@/components/store/Logo";
import { adminFetch, getToken, setToken } from "@/lib/admin";
import { cn } from "@/lib/format";

type Me = { id: string; email: string; name: string; role: string };

const NAV = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/orders", label: "Orders", icon: ShoppingCart },
  { href: "/admin/products", label: "Products", icon: Package },
  { href: "/admin/inventory", label: "Inventory", icon: Boxes },
  { href: "/admin/categories", label: "Categories", icon: FolderTree },
  { href: "/admin/reviews", label: "Reviews", icon: MessageSquareQuote },
  { href: "/admin/blog", label: "Blog", icon: Newspaper },
  { href: "/admin/subscribers", label: "Subscribers", icon: Mail },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      router.replace(`/admin/login?next=${encodeURIComponent(pathname)}`);
      return;
    }
    adminFetch<Me>("/me").then(setMe).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const logout = () => {
    setToken(null);
    router.replace("/admin/login");
  };

  if (!me) {
    return (
      <div className="grid min-h-screen place-items-center bg-cream">
        <span className="h-7 w-7 animate-spin rounded-full border-2 border-oat border-t-bronze" />
      </div>
    );
  }

  const isActive = (href: string) => (href === "/admin" ? pathname === "/admin" : pathname.startsWith(href));

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center px-5">
        <Logo light />
      </div>
      <nav className="mt-4 flex-1 space-y-1 px-3" onClick={() => setOpen(false)}>
        {NAV.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition",
              isActive(href) ? "bg-white/10 text-white" : "text-white/60 hover:bg-white/5 hover:text-white",
            )}
          >
            <Icon className={cn("h-4 w-4", isActive(href) && "text-bronze-light")} /> {label}
          </Link>
        ))}
      </nav>
      <div className="space-y-1 border-t border-white/10 p-3">
        <Link href="/" target="_blank" className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-white/60 hover:text-white">
          <ExternalLink className="h-4 w-4" /> View store
        </Link>
        <button onClick={logout} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-white/60 hover:text-white">
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f7f4ef]">
      <aside className="fixed inset-y-0 left-0 hidden w-60 bg-ink lg:block">{sidebar}</aside>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-ink/50" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 bg-ink">
            <button onClick={() => setOpen(false)} className="absolute right-3 top-4 p-1 text-white/70" aria-label="Close menu"><X className="h-5 w-5" /></button>
            {sidebar}
          </aside>
        </div>
      )}
      <div className="lg:pl-60">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-line bg-white/90 px-4 backdrop-blur sm:px-8">
          <button onClick={() => setOpen(true)} className="-ml-1 p-1 lg:hidden" aria-label="Open menu"><Menu className="h-5 w-5" /></button>
          <p className="hidden text-sm text-stone lg:block">Chris Moore Interior Decor · Admin</p>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-medium leading-tight">{me.name || "Admin"}</p>
              <p className="text-[11px] text-mist">{me.email}</p>
            </div>
            <span className="grid h-9 w-9 place-items-center rounded-full bg-bronze text-sm font-semibold uppercase text-white">
              {(me.name || me.email)[0]}
            </span>
          </div>
        </header>
        <main className="px-4 py-8 sm:px-8">{children}</main>
      </div>
    </div>
  );
}
