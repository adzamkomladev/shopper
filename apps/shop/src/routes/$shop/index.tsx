import { createFileRoute, notFound } from "@tanstack/react-router";
import { readStore, readStorePage } from "../../functions/store";
import { storeSearch } from "../../schemas/store";
import { StoreBrowse } from "../../components/store/browse";
import { storeHead } from "../../components/store/seo";
import { StoreSkeleton } from "../../components/store/skeleton";
import { Missing } from "../../components/shop/missing";

/** The shop's online store: rendered on the server so it can be shared and indexed. */
export const Route = createFileRoute("/$shop/")({
  validateSearch: storeSearch,
  loaderDeps: ({ search }) => search,
  loader: async ({ params, deps }) => {
    const [info, result] = await Promise.all([
      readStore({ data: params.shop }),
      readStorePage({
        data: { shop: params.shop, branch: deps.branch, q: deps.q, page: deps.page },
      }),
    ]);
    if (!info || !result) throw notFound();
    return { info, result };
  },
  head: ({ loaderData, params, match }) =>
    loaderData
      ? storeHead({
          info: loaderData.info,
          shop: params.shop,
          title: match.search.q
            ? `“${match.search.q}” at ${loaderData.info.name}`
            : `${loaderData.info.name} · Shop online`,
          description: `Shop ${loaderData.info.name} online: prices and stock at ${loaderData.result.branch.name}, the same as at the till.`,
          path: `/${params.shop}`,
          page: match.search.page,
          // A search result page is for the shopper, not for the index.
          noindex: Boolean(match.search.q),
        })
      : {},
  pendingComponent: StoreSkeleton,
  notFoundComponent: () => (
    <Missing
      title="That branch is not here"
      description="The link names a branch this shop does not have. Open the shop's link again."
    />
  ),
  component: Store,
});

function Store() {
  const { shop } = Route.useParams();
  const { q } = Route.useSearch();
  const data = Route.useLoaderData();
  return <StoreBrowse shop={shop} info={data.info} result={data.result} q={q} />;
}
