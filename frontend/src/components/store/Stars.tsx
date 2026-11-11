import { Star } from "lucide-react";

export default function Stars({ rating, count, size = 13 }: { rating: number; count?: number; size?: number }) {
  return (
    <div className="flex items-center gap-1.5" aria-label={`Rated ${rating.toFixed(1)} out of 5`}>
      <div className="flex">
        {[1, 2, 3, 4, 5].map((i) => {
          const fill = Math.max(0, Math.min(1, rating - (i - 1)));
          return (
            <span key={i} className="relative" style={{ width: size, height: size }}>
              <Star className="absolute inset-0 text-oat" style={{ width: size, height: size }} fill="currentColor" strokeWidth={0} />
              <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
                <Star className="text-bronze" style={{ width: size, height: size }} fill="currentColor" strokeWidth={0} />
              </span>
            </span>
          );
        })}
      </div>
      {count !== undefined && <span className="text-[11px] text-mist">({count})</span>}
    </div>
  );
}
