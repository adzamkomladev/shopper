import { createFileRoute, notFound, Outlet } from "@tanstack/react-router";
import { readShop } from "../../functions/shop";
import { Missing } from "../../components/shop/missing";

/** Every page of one shop: its name is read on the server; an unknown code is a designed not-found page. */
export const Route = createFileRoute("/$shop")({
  loader: async ({ params }) => {
    const shop = await readShop({ data: params.shop });
    if (!shop) throw notFound();
    return shop;
  },
  head: ({ loaderData }) => ({
    meta: [{ title: loaderData ? `${loaderData.name} · Your receipts` : "Shop not found" }],
  }),
  component: Outlet,
  notFoundComponent: () => (
    <Missing
      title="We could not find that shop"
      description="Check the link, or ask the cashier for the shop's code."
    />
  ),
  errorComponent: ({ reset }) => (
    <Missing
      title="The shop is not answering"
      description="Check your connection, then try again."
      action={{ label: "Try again", onClick: reset }}
    />
  ),
});
