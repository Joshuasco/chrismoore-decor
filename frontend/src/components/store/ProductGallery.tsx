"use client";

import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/format";

/**
 * Fixed 4:5 frame for every product, capped at the viewport height (minus the
 * sticky header) so the whole image stays visible while the gallery is pinned.
 */
const FRAME = "relative aspect-[4/5] max-h-[calc(100svh-8rem)] overflow-hidden rounded-2xl bg-sand";

export default function ProductGallery({ images, name }: { images: string[]; name: string }) {
  const [active, setActive] = useState(0);
  if (images.length === 0) return <div className={cn(FRAME, "w-full")} />;
  return (
    <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-start">
      {images.length > 1 && (
        <div className="no-scrollbar flex gap-3 overflow-x-auto sm:max-h-[calc(100svh-8rem)] sm:w-20 sm:shrink-0 sm:flex-col sm:overflow-y-auto sm:overflow-x-visible">
          {images.map((src, i) => (
            <button
              key={src + i}
              onClick={() => setActive(i)}
              aria-label={`Show image ${i + 1}`}
              className={cn(
                "relative aspect-square w-20 shrink-0 overflow-hidden rounded-lg border-2 bg-sand transition",
                i === active ? "border-bronze" : "border-transparent opacity-70 hover:opacity-100",
              )}
            >
              <Image src={src} alt="" fill sizes="80px" className="object-cover" />
            </button>
          ))}
        </div>
      )}
      <div className={cn(FRAME, "w-full flex-1")}>
        {/* object-cover crops to the frame instead of stretching, so photos are never distorted */}
        <Image src={images[active]} alt={name} fill priority sizes="(max-width: 1024px) 100vw, 50vw" className="object-cover" />
      </div>
    </div>
  );
}
