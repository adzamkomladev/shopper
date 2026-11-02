import { Hono, type Context } from "hono";
import { findOrgBySlug } from "@shopper/core/orgs";
import {
  listStoreBranches,
  listStoreCategories,
  listStoreProductIds,
  listStoreProducts,
  readStoreProduct,
  storeImageKey,
  StoreError,
} from "@shopper/core/storefront";
import type { ShopOptions } from "../../types";

/**
 * The public store of one shop: its branches and categories, a page of products at a branch, one product, and the
 * ids for its sitemap. Anyone may read it; the code names the shop and nothing else is taken from the request.
 */
export function shopStoreRoutes(options: ShopOptions) {
  const app = new Hono();
  app.onError((error, c) => {
    if (error instanceof StoreError) return c.json({ error: error.message }, error.status);
    throw error;
  });
  const shopOf = async (c: Context) => {
    const found = await findOrgBySlug(options.database, c.req.param("code") ?? "");
    if (!found || (options.orgId && found.id !== options.orgId.toLowerCase()))
      throw new StoreError("We could not find that shop");
    return found;
  };
  // Prices and stock move through the day: a minute at the edge, never longer.
  const cached = (c: Context) => c.header("Cache-Control", "public, max-age=60");

  app.get("/shop/:code/store", async (c) => {
    const found = await shopOf(c);
    cached(c);
    return c.json({
      name: found.name,
      branches: await listStoreBranches(options.database, found.id),
      categories: await listStoreCategories(options.database, found.id),
    });
  });
  app.get("/shop/:code/products", async (c) => {
    const found = await shopOf(c);
    cached(c);
    return c.json(await listStoreProducts(options.database, found.id, c.req.query()));
  });
  app.get("/shop/:code/products/:id", async (c) => {
    const found = await shopOf(c);
    const product = await readStoreProduct(
      options.database,
      found.id,
      c.req.param("id"),
      c.req.query(),
    );
    if (!product) throw new StoreError("We could not find that product");
    cached(c);
    return c.json(product);
  });
  // A photo redirects to a five-minute download; the redirect itself is cached for less than that.
  app.get("/shop/:code/images/:assetId", async (c) => {
    const found = await shopOf(c);
    const key = await storeImageKey(options.database, found.id, c.req.param("assetId"));
    if (!key || !options.blobs) throw new StoreError("We could not find that photo");
    c.header("Cache-Control", "public, max-age=240");
    return c.redirect(await options.blobs.createDownload(found.id, key, 300), 302);
  });
  app.get("/shop/:code/sitemap", async (c) => {
    const found = await shopOf(c);
    cached(c);
    return c.json({
      products: await listStoreProductIds(options.database, found.id),
      categories: await listStoreCategories(options.database, found.id),
    });
  });
  return app;
}
