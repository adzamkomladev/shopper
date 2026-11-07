import { useQuery } from "@tanstack/react-query";
import { Star } from "lucide-react";
import { reviewsQuery } from "../../queries/checkout";

/** What shoppers say: the average and the latest published reviews. Nothing shows until there is one. */
export function StoreReviews({ shop }: { shop: string }) {
  const { data } = useQuery(reviewsQuery(shop));
  if (!data || data.count === 0) return null;
  return (
    <section aria-labelledby="store-reviews" className="space-y-4 pt-6">
      <div className="flex flex-wrap items-baseline gap-3">
        <h2 id="store-reviews" className="text-2xl font-black tracking-tight">
          What shoppers say
        </h2>
        <p className="flex items-center gap-1.5 text-muted-foreground">
          <Star aria-hidden className="size-4 fill-primary text-primary" />
          <span className="font-bold text-foreground tabular-nums">{data.average?.toFixed(1)}</span>
          <span>
            from {data.count} {data.count === 1 ? "review" : "reviews"}
          </span>
        </p>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {data.latest.slice(0, 6).map((review) => (
          <li key={review.at + review.authorName} className="rounded-panel border bg-card p-4">
            <p aria-label={`${review.rating} out of 5`} className="text-primary">
              {"★".repeat(review.rating)}
              <span className="text-muted-foreground">{"★".repeat(5 - review.rating)}</span>
            </p>
            {review.comment ? <p className="mt-1 text-pretty">{review.comment}</p> : null}
            <p className="mt-2 text-sm text-muted-foreground">{review.authorName}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
