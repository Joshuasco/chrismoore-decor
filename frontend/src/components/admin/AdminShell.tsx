"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState } from "react";
import {
  Boxes,
  ExternalLink,
  FileText,
  FolderTree,
  LayoutDashboard,
  Lock,
  LogOut,
  Mail,
  Menu,
  MessageSquareQuote,
  Newspaper,
  Package,
  Settings,
  ShoppingCart,
  UserCog,
  UsersRound,
  X,
} from "lucide-react";
import Logo from "@/components/store/Logo";
import { adminFetch, getToken, setToken } from "@/lib/admin";
import { cn } from "@/lib/format";
import type { Me } from "@/lib/types";

/** `perm` is the service needed; "admin" means admins only; null means everyone. */
type NavItem = { href: string; label: string; icon: typeof LayoutDashboard; perm: string | null };

const NAV: NavItem[] = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard, perm: "dashboard" },
  { href: "/admin/orders", label: "Orders", icon: ShoppingCart, perm: "orders" },
  { href: "/admin/invoices", label: "Invoices", icon: FileText, perm: "invoices" },
  { href: "/admin/products", label: "Products", icon: Package, perm: "products" },
  { href: "/admin/inventory", label: "Inventory", icon: Boxes, perm: "inventory" },
  { href: "/admin/categories", label: "Categories", icon: FolderTree, perm: "products" },
  { href: "/admin/reviews", label: "Reviews", icon: MessageSquareQuote, perm: "reviews" },
  { href: "/admin/blog", label: "Blog", icon: Newspaper, perm: "blog" },
  { href: "/admin/subscribers", label: "Subscribers", icon: Mail, perm: "subscribers" },
  { href: "/admin/settings", label: "Settings", icon: Settings, perm: "settings" },
  { href: "/admin/staff", label: "Staff & roles", icon: UsersRound, perm: "admin" },
  { href: "/admin/account", label: "My account", icon: UserCog, perm: null },
];

export function canAccess(me: Me, perm: string | null) {
  if (perm === null) return true;
  if (me.role === "admin") return true;
  if (perm === "admin") return false;
  return me.permissions.includes(perm);
}

const routeFor = (pathname: string) =>
  NAV.find((n) => (n.href === "/admin" ? pathname === "/admin" : pathname === n.href || pathname.startsWith(n.href + "/")));

const MeContext = createContext<Me | null>(null);

/** The signed-in admin or staff member (available inside the dashboard). */
export function useMe(): Me {
  const me = useContext(MeContext);
  if (!me) throw new Error("useMe must be used inside AdminShell");
  return me;
}

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [open, setOpen] = useState(false);

  // Reload the account on every page change, so a new group, approval
  // change or pending-staff count shows up without signing in again.
  useEffect(() => {
    if (!getToken()) {
      router.replace(`/admin/login?next=${encodeURIComponent(pathname)}`);
      return;
    }
    adminFetch<Me>("/me").then(setMe).catch(() => {});
  }, [pathname, router]);

  const nav = me ? NAV.filter((n) => canAccess(me, n.perm)) : [];
  const route = routeFor(pathname);
  const allowed = !me || !route || canAccess(me, route.perm);
  // Staff without the overview land on the first section they can use.
  const fallback = nav.find((n) => n.href !== "/admin/account")?.href ?? "/admin/account";
  const redirectHome = !!me && pathname === "/admin" && !allowed;

  useEffect(() => {
    if (redirectHome) router.replace(fallback);
  }, [redirectHome, fallback, router]);

  const logout = () => {
    setToken(null);
    router.replace("/admin/login");
  };

  if (!me || redirectHome) {
    return (
      <div className="grid min-h-screen place-items-center bg-cream">
        <span className="h-7 w-7 animate-spin rounded-full border-2 border-oat border-t-bronze" />
      </div>
    );
  }

  const isActive = (href: string) => (href === "/admin" ? pathname === "/admin" : pathname.startsWith(href));
  const pending = me.role === "admin" ? me.pending_staff ?? 0 : 0;

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center px-5">
        <Logo light />
      </div>
      <nav className="mt-4 flex-1 space-y-1 overflow-y-auto px-3" onClick={() => setOpen(false)}>
        {nav.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition",
              isActive(href) ? "bg-white/10 text-white" : "text-white/60 hover:bg-white/5 hover:text-white",
            )}
          >
            <Icon className={cn("h-4 w-4", isActive(href) && "text-bronze-light")} /> {label}
            {href === "/admin/staff" && pending > 0 && (
              <span className="ml-auto rounded-full bg-bronze px-1.5 py-0.5 text-[10px] font-semibold text-white" aria-label={`${pending} awaiting approval`}>
                {pending}
              </span>
            )}
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
    <MeContext.Provider value={me}>
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
            <p className="hidden text-sm text-stone lg:block">Chris Moore Interior Decor · {me.role === "admin" ? "Admin" : "Staff"}</p>
            <Link href="/admin/account" className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-sm font-medium leading-tight">{me.name || "Admin"}</p>
                <p className="text-[11px] text-mist">{me.role === "admin" ? "Administrator" : me.group_name || "Staff · no group yet"}</p>
              </div>
              <span className="grid h-9 w-9 place-items-center rounded-full bg-bronze text-sm font-semibold uppercase text-white">
                {(me.name || me.email)[0]}
              </span>
            </Link>
          </header>
          <main className="px-4 py-8 sm:px-8">
            {allowed ? (
              children
            ) : (
              <div className="mx-auto mt-10 max-w-md rounded-xl border border-line bg-white p-8 text-center">
                <Lock className="mx-auto h-8 w-8 text-bronze" />
                <h1 className="mt-4 font-serif text-2xl font-semibold">No access to {route?.label}</h1>
                <p className="mt-2 text-sm text-stone">
                  {route?.perm === "admin"
                    ? "Only administrators can manage staff and groups."
                    : "Your group doesn't include this section. Ask an administrator to give your group access."}
                </p>
                <Link href={fallback} className="btn-primary btn-sm mt-6">Go to {NAV.find((n) => n.href === fallback)?.label}</Link>
              </div>
            )}
          </main>
        </div>
      </div>
    </MeContext.Provider>
  );
}
