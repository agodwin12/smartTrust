import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

type RatingStarsProps = {
  rating: number;
  count?: number;
  className?: string;
  size?: "sm" | "md";
};

export function RatingStars({ rating, count, className, size = "sm" }: RatingStarsProps) {
  const rounded = Math.round(rating * 2) / 2;
  const starSize = size === "sm" ? "size-3.5" : "size-4";

  return (
    <div className={cn("flex items-center gap-1.5", className)} aria-label={`${rating.toFixed(1)} / 5`}>
      <div className="flex items-center gap-0.5">
        {Array.from({ length: 5 }, (_, i) => {
          const filled = i + 1 <= rounded;
          const half = !filled && i + 0.5 === rounded;
          return (
            <span key={i} className={cn("relative inline-flex", starSize)}>
              <Star className={cn(starSize, "text-border")} fill="currentColor" strokeWidth={0} />
              {(filled || half) && (
                <span className="absolute inset-0 overflow-hidden" style={{ width: half ? "50%" : "100%" }}>
                  <Star className={cn(starSize, "text-brand-orange")} fill="currentColor" strokeWidth={0} />
                </span>
              )}
            </span>
          );
        })}
      </div>
      <span className="text-xs font-semibold text-foreground">{rating.toFixed(1)}</span>
      {typeof count === "number" && <span className="text-xs text-foreground-muted">({count})</span>}
    </div>
  );
}
