import { createFileRoute, getRouteApi, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CircleAlert, Store } from "lucide-react";
import { Alert, AlertDescription } from "@shopper/ui/components/alert";
import { Button } from "@shopper/ui/components/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@shopper/ui/components/empty";
import { readStore } from "../../functions/store";
import { productSearch } from "../../schemas/store";
import { fulfilmentQuery } from "../../queries/checkout";
import { useCart } from "../../stores/cart";
import { CheckoutFrame } from "../../components/cart/frame";
import { CheckoutForm } from "../../components/checkout/form";
import { CheckoutSkeleton } from "../../components/checkout/skeleton";
import { StoreSkeleton } from "../../components/store/skeleton";

const shopRoute = getRouteApi("/$shop");

/** Guest checkout at the chosen branch: how, when, who, then an unpaid order that holds the stock. */
export const Route = createFileRoute("/$shop/checkout")({
  validateSearch: productSearch,
  loader: async ({ params }) => {
    const info = await readStore({ data: params.shop });
    if (!info) throw notFound();
    return info;
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData ? `Checkout · ${loaderData.name}` : "Checkout" },
      { name: "robots", content: "noindex" },
    ],
  }),
  pendingComponent: StoreSkeleton,
  component: Checkout,
});

function Checkout() {
  const { shop } = Route.useParams();
  const info = Route.useLoaderData();
  const siteKey = shopRoute.useLoaderData().turnstileSiteKey;
  const branchId = Route.useSearch().branch ?? info.branches[0]?.id ?? "";
  const lines = useCart(shop);
  const options = useQuery(fulfilmentQuery(shop, branchId));
  const closed = options.data && !options.data.pickup && !options.data.delivery;
  return (
    <CheckoutFrame
      shop={shop}
      info={info}
      branchId={branchId}
      title="Checkout"
      back={{ to: "/$shop/cart", label: "Back to your cart" }}
    >
      {!lines.length ? (
        <Gone
          shop={shop}
          branchId={branchId}
          title="Your cart is empty"
          description="Add what you need from the store, then check out."
        />
      ) : options.isPending ? (
        <CheckoutSkeleton />
      ) : options.isError ? (
        <Alert variant="destructive">
          <CircleAlert aria-hidden />
          <AlertDescription className="flex flex-wrap items-center gap-3">
            {options.error.message}
            <Button variant="outline" size="sm" onClick={() => void options.refetch()}>
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      ) : closed ? (
        <Gone
          shop={shop}
          branchId={branchId}
          title={`${options.data.branch.name} is not taking online orders`}
          description={
            info.branches.length > 1
              ? "Pick another branch at the top to order from there."
              : "Visit the shop, or check back soon."
          }
        />
      ) : (
        <CheckoutForm
          shop={shop}
          branchId={branchId}
          lines={lines}
          options={options.data}
          siteKey={siteKey}
        />
      )}
    </CheckoutFrame>
  );
}

function Gone({
  shop,
  branchId,
  title,
  description,
}: {
  shop: string;
  branchId: string;
  title: string;
  description: string;
}) {
  return (
    <Empty className="rounded-panel border border-dashed bg-card py-16">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Store aria-hidden />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button asChild size="touch" className="rounded-full px-6 font-bold">
          <Link to="/$shop" params={{ shop }} search={{ branch: branchId }}>
            Browse the store
          </Link>
        </Button>
      </EmptyContent>
    </Empty>
  );
}
