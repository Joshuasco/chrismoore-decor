"use client";

import { X } from "lucide-react";
import { useEffect } from "react";
import { cn, STATUS_LABEL } from "@/lib/format";

const BADGE: Record<string, string> = {
  pending: "bg-amber-50 text-amber-800 ring-amber-200",
  confirmed: "bg-sky-50 text-sky-800 ring-sky-200",
  processing: "bg-indigo-50 text-indigo-800 ring-indigo-200",
  shipped: "bg-violet-50 text-violet-800 ring-violet-200",
  delivered: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  cancelled: "bg-stone-100 text-stone-600 ring-stone-200",
  paid: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  unpaid: "bg-amber-50 text-amber-800 ring-amber-200",
  failed: "bg-red-50 text-red-700 ring-red-200",
  refunded: "bg-stone-100 text-stone-600 ring-stone-200",
  whatsapp: "bg-green-50 text-green-800 ring-green-200",
  paystack: "bg-cyan-50 text-cyan-800 ring-cyan-200",
  flutterwave: "bg-orange-50 text-orange-800 ring-orange-200",
  approved: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  rejected: "bg-red-50 text-red-700 ring-red-200",
  draft: "bg-stone-100 text-stone-600 ring-stone-200",
  published: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  scheduled: "bg-sky-50 text-sky-800 ring-sky-200",
  disapproved: "bg-red-50 text-red-700 ring-red-200",
  void: "bg-stone-100 text-stone-600 ring-stone-200",
  overdue: "bg-red-50 text-red-700 ring-red-200",
  admin: "bg-ink text-white ring-ink",
  staff: "bg-sand text-cocoa ring-oat",
};

export function Badge({ value }: { value: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset", BADGE[value] ?? "bg-sand text-cocoa ring-oat")}>
      {STATUS_LABEL[value] ?? value}
    </span>
  );
}

export function StockBadge({ stock, threshold }: { stock: number; threshold: number }) {
  if (stock <= 0) return <span className="inline-flex rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-700 ring-1 ring-inset ring-red-200">Out of stock</span>;
  if (stock <= threshold)
    return <span className="inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800 ring-1 ring-inset ring-amber-200">Low · {stock}</span>;
  return <span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-800 ring-1 ring-inset ring-emerald-200">{stock} in stock</span>;
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-serif text-3xl font-semibold">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-stone">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({ title, action, children, className }: { title?: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-xl border border-line bg-white", className)}>
      {title && (
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <h2 className="text-sm font-semibold">{title}</h2>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4" role="dialog" aria-modal aria-label={title}>
      <div className="absolute inset-0 bg-ink/40" onClick={onClose} />
      <div className={cn("relative max-h-[calc(100svh-2rem)] w-full overflow-y-auto rounded-xl bg-white p-6 shadow-lift", wide ? "max-w-2xl" : "max-w-md")}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-serif text-2xl font-semibold">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="rounded p-1 hover:bg-sand"><X className="h-5 w-5" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="px-5 py-10 text-center text-sm text-stone">{children}</p>;
}

export function Spinner() {
  return (
    <div className="grid place-items-center py-16">
      <span className="h-6 w-6 animate-spin rounded-full border-2 border-oat border-t-bronze" />
    </div>
  );
}
