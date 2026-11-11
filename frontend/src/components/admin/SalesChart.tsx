"use client";

import { useState } from "react";
import { formatNaira } from "@/lib/format";

type Point = { day: string; revenue: number; orders: number };

function niceMax(v: number) {
  if (v <= 0) return 100000; // ₦1,000 in kobo, so an empty chart still has an axis
  const pow = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / pow;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * pow;
}

const short = (kobo: number) => {
  const n = kobo / 100;
  if (n >= 1_000_000) return `₦${(n / 1_000_000).toFixed(n % 1_000_000 ? 1 : 0)}m`;
  if (n >= 1000) return `₦${Math.round(n / 1000)}k`;
  return `₦${n}`;
};

/** Daily paid revenue, last 30 days. Single series → no legend; title names it. */
export default function SalesChart({ data }: { data: Point[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = niceMax(Math.max(...data.map((d) => d.revenue), 0));
  const ticks = [max, max / 2, 0];
  const fmtDay = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-NG", { day: "numeric", month: "short" });

  return (
    <div className="px-5 pb-5 pt-4">
      <div className="relative flex h-56 gap-3">
        <div className="flex w-12 flex-col justify-between text-right text-[10px] text-mist">
          {ticks.map((t) => <span key={t} className="-translate-y-1/2 first:translate-y-0 last:translate-y-0">{short(t)}</span>)}
        </div>
        <div className="relative flex-1">
          {ticks.map((t, i) => (
            <div key={t} className="absolute inset-x-0 border-t border-dashed border-line" style={{ top: `${(i / (ticks.length - 1)) * 100}%` }} />
          ))}
          <div className="absolute inset-0 flex items-end gap-[2px]" onMouseLeave={() => setHover(null)}>
            {data.map((d, i) => (
              <div
                key={d.day}
                className="group relative flex h-full flex-1 items-end"
                onMouseEnter={() => setHover(i)}
                onFocus={() => setHover(i)}
                tabIndex={0}
                aria-label={`${fmtDay(d.day)}: ${formatNaira(d.revenue)} from ${d.orders} orders`}
              >
                <div
                  className="w-full rounded-t-[4px] bg-bronze transition-opacity"
                  style={{
                    height: `${(d.revenue / max) * 100}%`,
                    minHeight: d.revenue > 0 ? 2 : 0,
                    opacity: hover === null || hover === i ? 1 : 0.45,
                  }}
                />
              </div>
            ))}
          </div>
          {hover !== null && (
            <div
              className="pointer-events-none absolute -top-2 z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md bg-ink px-3 py-2 text-xs text-white shadow-lift"
              style={{ left: `${((hover + 0.5) / data.length) * 100}%` }}
            >
              <p className="text-white/60">{fmtDay(data[hover].day)}</p>
              <p className="font-semibold">{formatNaira(data[hover].revenue)}</p>
              <p className="text-white/60">{data[hover].orders} order{data[hover].orders === 1 ? "" : "s"}</p>
            </div>
          )}
        </div>
      </div>
      <div className="ml-[60px] mt-2 flex justify-between text-[10px] text-mist">
        <span>{data[0] && fmtDay(data[0].day)}</span>
        <span>{data[Math.floor(data.length / 2)] && fmtDay(data[Math.floor(data.length / 2)].day)}</span>
        <span>{data.at(-1) && fmtDay(data.at(-1)!.day)}</span>
      </div>
    </div>
  );
}
