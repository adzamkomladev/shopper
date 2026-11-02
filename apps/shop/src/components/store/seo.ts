import { toDecimal } from "@shopper/money";
import type { StoreInfo, StoreItem } from "../../schemas/store";

type Page = {
  info: StoreInfo & { origin: string };
  shop: string;
  title: string;
  description: string;
  /** The path search engines should index this page under. */
  path: string;
  /** A listing's page: each page past the first is indexed under its own address. */
  page?: number;
  image?: string;
  /** A page that should not be indexed, such as a product the branch cannot sell. */
  noindex?: boolean;
  jsonLd?: Record<string, unknown>;
};

/** Title, description, canonical link, Open Graph and structured data for a store page. */
export function storeHead(page: Page) {
  const url = `${page.info.origin}${page.path}${page.page && page.page > 1 ? `?page=${page.page}` : ""}`;
  return {
    meta: [
      { title: page.title },
      { name: "description", content: page.description },
      { name: "robots", content: page.noindex ? "noindex" : "index, follow" },
      { property: "og:type", content: page.jsonLd ? "product" : "website" },
      { property: "og:site_name", content: page.info.name },
      { property: "og:title", content: page.title },
      { property: "og:description", content: page.description },
      { property: "og:url", content: url },
      ...(page.image
        ? [{ property: "og:image", content: `${page.info.origin}${page.image}` }]
        : []),
    ],
    links: [{ rel: "canonical", href: url }],
    scripts: page.jsonLd
      ? [{ type: "application/ld+json", children: JSON.stringify(page.jsonLd) }]
      : [],
  };
}

/** The schema.org Product for a product page: its price in cedis and whether the branch has it. */
export function productJsonLd(info: StoreInfo & { origin: string }, shop: string, item: StoreItem) {
  const product = item.product;
  const url = `${info.origin}/${shop}/products/${product.id}`;
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    sku: product.sku,
    ...(product.categoryName ? { category: product.categoryName } : {}),
    ...(product.imageAssetId
      ? { image: `${info.origin}/api/shop/${shop}/images/${product.imageAssetId}` }
      : {}),
    url,
    ...(product.price === null
      ? {}
      : {
          offers: {
            "@type": "Offer",
            url,
            priceCurrency: "GHS",
            price: toDecimal(product.price),
            availability: product.available
              ? "https://schema.org/InStock"
              : "https://schema.org/OutOfStock",
            seller: { "@type": "Organization", name: info.name },
          },
        }),
  };
}
