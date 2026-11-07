import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Star } from "lucide-react";
import { Alert, AlertDescription } from "@shopper/ui/components/alert";
import { Button } from "@shopper/ui/components/button";
import { Textarea } from "@shopper/ui/components/textarea";
import { shopFetch, ShopApiError } from "../../queries/api";
import { reviewSent, type PlacedOrder } from "../../schemas/checkout";

const stars = [1, 2, 3, 4, 5];

/** Asks a shopper who has their order how it went: one to five stars (keys 1 to 5) and a few words. */
export function ReviewPanel({
  shop,
  order,
  orderKey,
}: {
  shop: string;
  order: PlacedOrder;
  orderKey: string;
}) {
  const queryClient = useQueryClient();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const send = useMutation({
    mutationFn: () =>
      shopFetch(`/${shop}/orders/${order.id}/review`, reviewSent, {
        body: { key: orderKey, rating, comment },
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [shop, "orders", order.id] }),
  });
  if (order.review)
    return (
      <section aria-labelledby="order-review" className="rounded-panel border bg-card p-5">
        <h2 id="order-review" className="text-lg font-bold">
          Thank you for your review
        </h2>
        <p className="mt-1 text-muted-foreground">
          {"★".repeat(order.review.rating)}
          {"☆".repeat(5 - order.review.rating)}
          {order.review.status === "flagged"
            ? " · The shop is checking it before it is shown."
            : ""}
        </p>
      </section>
    );
  const refusal = send.error instanceof ShopApiError ? send.error.message : send.error?.message;
  return (
    <form
      aria-labelledby="order-review"
      className="space-y-4 rounded-panel border bg-card p-5"
      onSubmit={(event) => {
        event.preventDefault();
        if (rating) send.mutate();
      }}
    >
      <h2 id="order-review" className="text-lg font-bold">
        How was your order?
      </h2>
      <div
        role="radiogroup"
        aria-label="Rating"
        className="flex gap-1"
        onKeyDown={(event) => {
          if (/^[1-5]$/.test(event.key)) setRating(Number(event.key));
        }}
      >
        {stars.map((value) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={rating === value}
            aria-label={`${value} ${value === 1 ? "star" : "stars"}`}
            onClick={() => setRating(value)}
            className="rounded-md p-1 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <Star
              aria-hidden
              className={`size-8 ${value <= rating ? "fill-primary text-primary" : "text-muted-foreground"}`}
            />
          </button>
        ))}
      </div>
      <Textarea
        aria-label="Your review"
        placeholder="Tell others about it (optional)"
        maxLength={500}
        value={comment}
        onChange={(event) => setComment(event.target.value)}
      />
      {refusal ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{refusal}</AlertDescription>
        </Alert>
      ) : null}
      <Button type="submit" disabled={!rating || send.isPending}>
        {send.isPending ? "Sending…" : "Send review"}
      </Button>
    </form>
  );
}
