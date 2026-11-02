import * as v from "valibot";
import { money } from "@shopper/money";
import { shopCodeParam } from "./shop";

const amount = v.pipe(v.number(), v.safeInteger(), v.transform(money));
const named = v.object({ id: v.string(), name: v.string() });
// A hand-edited address falls back to the defaults instead of failing the page.
const branch = v.fallback(v.optional(v.pipe(v.string(), v.uuid())), undefined);

/** What the store's address bar may carry: the branch to shop at, a search and the page. */
export const storeSearch = v.object({
  branch,
  q: v.fallback(v.optional(v.pipe(v.string(), v.trim(), v.maxLength(100))), undefined),
  page: v.fallback(
    v.optional(v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(1000))),
    undefined,
  ),
});
/** A category address; anything else names no category, so the page is not found. */
export const categoryParam = v.pipe(v.string(), v.uuid());
/** A product page names only the branch. */
export const productSearch = v.object({ branch });

/** What the store pages ask the server for: a page of products, or one product, at a branch. */
export const storePageInput = v.object({
  shop: shopCodeParam,
  branch: v.optional(v.string()),
  category: v.optional(v.string()),
  q: v.optional(v.string()),
  page: v.optional(v.number()),
});
export const storeItemInput = v.object({
  shop: shopCodeParam,
  id: v.string(),
  branch: v.optional(v.string()),
});

export const storeInfo = v.object({
  name: v.string(),
  branches: v.array(named),
  categories: v.array(named),
});

const storeProduct = v.object({
  id: v.string(),
  sku: v.string(),
  name: v.string(),
  baseUnit: v.string(),
  categoryId: v.nullable(v.string()),
  imageAssetId: v.nullable(v.string()),
  price: amount,
});
export const storePage = v.object({
  branch: named,
  page: v.number(),
  pages: v.number(),
  total: v.number(),
  products: v.array(storeProduct),
});
export const storeItem = v.object({
  branch: named,
  product: v.object({
    ...v.omit(storeProduct, ["price"]).entries,
    categoryName: v.nullable(v.string()),
    price: v.nullable(amount),
    available: v.boolean(),
  }),
});
export const storeSitemap = v.object({
  products: v.array(v.object({ id: v.string() })),
  categories: v.array(named),
});

export type StoreInfo = v.InferOutput<typeof storeInfo>;
export type StorePage = v.InferOutput<typeof storePage>;
export type StoreProduct = v.InferOutput<typeof storeProduct>;
export type StoreItem = v.InferOutput<typeof storeItem>;
