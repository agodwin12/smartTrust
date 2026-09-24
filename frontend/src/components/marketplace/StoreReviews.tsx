import { Star } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { apiFetch } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Paginated, Review } from "@/types";
import { Container } from "@/components/layout/Container";
import { RatingStars } from "@/components/marketplace/RatingStars";

async function fetchReviews(slug: string): Promise<Paginated<Review>> {
  try {
    return await apiFetch<Paginated<Review>>(`stores/${encodeURIComponent(slug)}/reviews`, {
      params: { pageSize: 10 },
      next: { revalidate: 60 },
    });
  } catch {
    return { items: [], total: 0, page: 1, pageSize: 10 };
  }
}

/** Public reviews on a store page — every review is tied to a completed escrow order. */
export async function StoreReviews({ slug, rating }: { slug: string; rating?: number }) {
  const [t, locale, reviews] = await Promise.all([getTranslations("reviews"), getLocale(), fetchReviews(slug)]);

  return (
    <section className="border-t border-border bg-surface py-12">
      <Container>
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl sm:text-3xl">{t("title")}</h2>
            <p className="mt-1 text-sm text-foreground-secondary">{t("count", { count: reviews.total })}</p>
          </div>
          {typeof rating === "number" && reviews.total > 0 && <RatingStars rating={rating} count={reviews.total} size="md" />}
        </div>
        {reviews.items.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-foreground-secondary">{t("none")}</p>
        ) : (
          <ul className="grid gap-4 md:grid-cols-2">
            {reviews.items.map((review) => (
              <li key={review.id} className="rounded-2xl border border-border bg-background p-5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex gap-0.5">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star key={n} className={cn("size-4", n <= review.rating ? "fill-brand-orange text-brand-orange" : "text-border")} />
                    ))}
                  </div>
                  <span className="text-xs text-foreground-muted">{formatDate(review.createdAt, locale)}</span>
                </div>
                {review.comment && <p className="mt-3 text-sm leading-relaxed text-foreground">{review.comment}</p>}
                <p className="mt-3 text-xs text-foreground-muted">
                  <span className="font-semibold text-foreground-secondary">{review.buyerName}</span> · {t("verified")}
                  {review.product && <> · {t("for", { product: review.product.title })}</>}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Container>
    </section>
  );
}
