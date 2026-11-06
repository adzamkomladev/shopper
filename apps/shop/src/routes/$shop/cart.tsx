import { createFileRoute, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CircleAlert } from "lucide-react";
import { Alert, AlertDescription } from "@shopper/ui/components/alert";
import { Button } from "@shopper/ui/components/button";
import { readStore } from "../../functions/store";
import { productSearch } from "../../schemas/store";
import { cartQuery } from "../../queries/checkout";
import { useCart } from "../../stores/cart";
import { CartPanel } from "../../components/cart/panel";
import { CheckoutFrame } from "../../components/cart/frame";
import { StoreSkeleton } from "../../components/store/skeleton";

/** The basket, priced by the server at the chosen branch. The basket itself lives in this browser. */
export const Route = createFileRoute("/$shop/cart")({
  validateSearch: productSearch,
  loader: async ({ params }) => {
    const info = await readStore({ data: params.shop });
    if (!info) throw notFound();
    return info;
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData ? `Your cart · ${loaderData.name}` : "Your cart" },
      { name: "robots", content: "noindex" },
    ],
  }),
  pendingComponent: StoreSkeleton,
  component: Cart,
});

function Cart() {
  const { shop } = Route.useParams();
  const info = Route.useLoaderData();
  const search = Route.useSearch();
  const branchId = search.branch ?? info.branches[0]?.id ?? "";
  const lines = useCart(shop);
  const quote = useQuery(cartQuery(shop, branchId, lines));
  return (
    <CheckoutFrame
      shop={shop}
      info={info}
      branchId={branchId}
      title="Your cart"
      back={{ to: "/$shop", label: "Keep shopping" }}
    >
      {quote.isError && !quote.data ? (
        <Alert variant="destructive">
          <CircleAlert aria-hidden />
          <AlertDescription className="flex flex-wrap items-center gap-3">
            {quote.error.message}
            <Button variant="outline" size="sm" onClick={() => void quote.refetch()}>
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}
      <CartPanel
        shop={shop}
        branchId={branchId}
        lines={lines}
        quote={quote.data}
        pricing={quote.isFetching}
      />
    </CheckoutFrame>
  );
}
