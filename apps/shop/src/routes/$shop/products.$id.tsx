import { createFileRoute, notFound } from "@tanstack/react-router";
import { readStore, readStoreItem } from "../../functions/store";
import { productSearch } from "../../schemas/store";
import { ProductPage } from "../../components/store/product";
import { productJsonLd, storeHead } from "../../components/store/seo";
import { StoreSkeleton } from "../../components/store/skeleton";
import { Missing } from "../../components/shop/missing";
import { formatGHS } from "@shopper/money";

/** A product's own page: what it costs at the selected branch and whether that branch has it. */
export const Route = createFileRoute("/$shop/products/$id")({
  validateSearch: productSearch,
  loaderDeps: ({ search }) => search,
  loader: async ({ params, deps }) => {
    const [info, item] = await Promise.all([
      readStore({ data: params.shop }),
      readStoreItem({ data: { shop: params.shop, id: params.id, branch: deps.branch } }),
    ]);
    if (!info || !item) throw notFound();
    return { info, item };
  },
  head: ({ loaderData, params }) => {
    if (!loaderData) return {};
    const product = loaderData.item.product;
    const price = product.price === null ? null : formatGHS(product.price);
    return storeHead({
      info: loaderData.info,
      shop: params.shop,
      title: `${product.name} · ${loaderData.info.name}`,
      description:
        product.available && price
          ? `${product.name} for ${price} at ${loaderData.info.name}, ${loaderData.item.branch.name}.`
          : `${product.name} at ${loaderData.info.name}. Not available at ${loaderData.item.branch.name} right now.`,
      path: `/${params.shop}/products/${product.id}`,
      image: product.imageAssetId
        ? `/api/shop/${params.shop}/images/${product.imageAssetId}`
        : undefined,
      noindex: !product.available,
      jsonLd: productJsonLd(loaderData.info, params.shop, loaderData.item),
    });
  },
  pendingComponent: StoreSkeleton,
  notFoundComponent: () => (
    <Missing
      title="That product is not in the store"
      description="It may no longer be sold online. Browse the store for what is."
    />
  ),
  component: Product,
});

function Product() {
  const { shop } = Route.useParams();
  const data = Route.useLoaderData();
  return <ProductPage shop={shop} info={data.info} item={data.item} />;
}
