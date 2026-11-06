import { createFileRoute, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CircleAlert } from "lucide-react";
import { Alert, AlertDescription } from "@shopper/ui/components/alert";
import { Button } from "@shopper/ui/components/button";
import { Skeleton } from "@shopper/ui/components/skeleton";
import { readStore } from "../../functions/store";
import { orderSearch } from "../../schemas/checkout";
import { orderQuery } from "../../queries/checkout";
import { ShopApiError } from "../../queries/api";
import { CheckoutFrame } from "../../components/cart/frame";
import { OrderConfirmation } from "../../components/order/confirmation";
import { Missing } from "../../components/shop/missing";
import { StoreSkeleton } from "../../components/store/skeleton";

/** An order, read with the checkout key in its address; without the key there is nothing to see. */
export const Route = createFileRoute("/$shop/orders/$id")({
  validateSearch: orderSearch,
  loader: async ({ params }) => {
    const info = await readStore({ data: params.shop });
    if (!info) throw notFound();
    return info;
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData ? `Your order · ${loaderData.name}` : "Your order" },
      { name: "robots", content: "noindex" },
    ],
  }),
  pendingComponent: StoreSkeleton,
  component: Order,
});

function Order() {
  const { shop, id } = Route.useParams();
  const info = Route.useLoaderData();
  const key = Route.useSearch().t ?? "";
  const order = useQuery({ ...orderQuery(shop, id, key), enabled: !!key, retry: false });
  if (!key || (order.error instanceof ShopApiError && order.error.status === 404))
    return (
      <Missing
        title="We could not find that order"
        description="Open the link from the page you placed it on, in the same browser."
      />
    );
  const branchId = order.data?.branch.id ?? info.branches[0]?.id ?? "";
  return (
    <CheckoutFrame
      shop={shop}
      info={info}
      branchId={branchId}
      title="Thank you"
      back={{ to: "/$shop", label: "Back to the store" }}
    >
      {order.data ? (
        <OrderConfirmation order={order.data} />
      ) : order.isError ? (
        <Alert variant="destructive">
          <CircleAlert aria-hidden />
          <AlertDescription className="flex flex-wrap items-center gap-3">
            {order.error.message}
            <Button variant="outline" size="sm" onClick={() => void order.refetch()}>
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      ) : (
        <div
          aria-busy="true"
          aria-label="Loading your order"
          className="grid gap-6 lg:grid-cols-[1fr_22rem]"
        >
          <div className="space-y-6">
            <Skeleton className="h-32 rounded-panel" />
            <Skeleton className="h-24 rounded-panel" />
            <Skeleton className="h-48 rounded-panel" />
          </div>
          <Skeleton className="h-64 rounded-panel" />
        </div>
      )}
    </CheckoutFrame>
  );
}
