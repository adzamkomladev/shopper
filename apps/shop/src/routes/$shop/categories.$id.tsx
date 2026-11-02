import { createFileRoute, notFound } from "@tanstack/react-router";
import { readStore, readStorePage } from "../../functions/store";
import { storeSearch } from "../../schemas/store";
import { StoreBrowse } from "../../components/store/browse";
import { storeHead } from "../../components/store/seo";
import { StoreSkeleton } from "../../components/store/skeleton";
import { Missing } from "../../components/shop/missing";

/** One category of the store, indexed under its own address. */
export const Route = createFileRoute("/$shop/categories/$id")({
  validateSearch: storeSearch,
  loaderDeps: ({ search }) => search,
  loader: async ({ params, deps }) => {
    const [info, result] = await Promise.all([
      readStore({ data: params.shop }),
      readStorePage({
        data: {
          shop: params.shop,
          category: params.id,
          branch: deps.branch,
          q: deps.q,
          page: deps.page,
        },
      }),
    ]);
    const category = info?.categories.find((row) => row.id === params.id.toLowerCase());
    if (!info || !result || !category) throw notFound();
    return { info, result, category };
  },
  head: ({ loaderData, params, match }) =>
    loaderData
      ? storeHead({
          info: loaderData.info,
          shop: params.shop,
          title: `${loaderData.category.name} · ${loaderData.info.name}`,
          description: `${loaderData.category.name} at ${loaderData.info.name}: prices and stock at ${loaderData.result.branch.name}.`,
          path: `/${params.shop}/categories/${loaderData.category.id}`,
          noindex: Boolean(match.search.q),
        })
      : {},
  pendingComponent: StoreSkeleton,
  notFoundComponent: () => (
    <Missing
      title="That category is not here"
      description="It may have moved or have nothing for sale online. Browse the whole store instead."
    />
  ),
  component: Category,
});

function Category() {
  const { shop } = Route.useParams();
  const { q } = Route.useSearch();
  const data = Route.useLoaderData();
  return (
    <StoreBrowse shop={shop} info={data.info} result={data.result} q={q} category={data.category} />
  );
}
