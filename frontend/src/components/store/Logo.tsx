import Link from "next/link";
import { cn } from "@/lib/format";

export default function Logo({ light = false, className }: { light?: boolean; className?: string }) {
  return (
    <Link href="/" className={cn("group flex items-center gap-3", className)} aria-label="Chris Moore Interior Decor — home">
      <svg viewBox="0 0 40 40" className={cn("h-9 w-9 shrink-0", light ? "text-bronze-light" : "text-bronze")} aria-hidden>
        <path d="M6 6h28" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        <path d="M9 7c0 10 3 18 7 27M31 7c0 10-3 18-7 27" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" />
        <path d="M13 7c0 9 2 17 4 27M27 7c0 9-2 17-4 27" stroke="currentColor" strokeWidth="1" fill="none" opacity=".6" strokeLinecap="round" />
        <circle cx="20" cy="20" r="2.2" fill="currentColor" />
      </svg>
      <span className={cn("flex flex-col border-l pl-3 leading-none", light ? "border-white/30" : "border-ink/20")}>
        <span className={cn("font-serif text-[22px] font-semibold tracking-[0.14em]", light ? "text-white" : "text-ink")}>
          CHRIS MOORE
        </span>
        <span className={cn("mt-1 text-[9px] tracking-[0.42em]", light ? "text-white/70" : "text-stone")}>
          INTERIOR DECOR
        </span>
      </span>
    </Link>
  );
}
