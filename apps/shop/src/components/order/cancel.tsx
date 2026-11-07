import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@shopper/ui/components/button";
import { shopFetch, ShopApiError } from "../../queries/api";
import { placedOrder, type PlacedOrder } from "../../schemas/checkout";

/** An order that has not been paid can be given up: its items go back on the shelf at once. */
export function CancelOrder({
  shop,
  order,
  orderKey,
}: {
  shop: string;
  order: PlacedOrder;
  orderKey: string;
}) {
  const queryClient = useQueryClient();
  const cancel = useMutation({
    mutationFn: () =>
      shopFetch(`/${shop}/orders/${order.id}/cancel`, placedOrder, { body: { key: orderKey } }),
    onSuccess: (updated) => queryClient.setQueryData([shop, "orders", order.id], updated),
  });
  return (
    <div className="space-y-2">
      <Button variant="outline" disabled={cancel.isPending} onClick={() => cancel.mutate()}>
        {cancel.isPending ? "Cancelling…" : "Cancel this order"}
      </Button>
      {cancel.error ? (
        <p role="alert" className="text-sm text-destructive">
          {cancel.error instanceof ShopApiError
            ? cancel.error.message
            : "Could not cancel. Try again."}
        </p>
      ) : null}
    </div>
  );
}
