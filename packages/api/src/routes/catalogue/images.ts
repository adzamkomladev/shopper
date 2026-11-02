import { Hono, type Context } from "hono";
import {
  AssetError,
  issueProductImageUpload,
  productImageLink,
  setProductImage,
} from "@shopper/assets";
import type { ShopperDatabase } from "@shopper/db-pg";
import type { Blobs } from "@shopper/ports";
import type { ApiEnvironment } from "../../types";

type Ctx = Context<ApiEnvironment>;
type CommandContext = Parameters<typeof setProductImage>[1];

/**
 * A product's photo: a short link to see it, a direct-upload grant, then linking the verified upload (or null to
 * remove it). The parent guard already requires product.read to see it and product.write to change it.
 */
export function productImageRoutes(
  db: ShopperDatabase,
  context: (c: Ctx) => CommandContext,
  body: (c: Ctx) => Promise<unknown>,
  blobs: Blobs | undefined,
) {
  const app = new Hono<ApiEnvironment>();
  const storage = () => {
    if (!blobs) throw new AssetError("Direct uploads are unavailable", 503);
    return blobs;
  };
  app.get("/:id/image", async (c) =>
    c.json({
      url: await productImageLink(db, storage(), c.get("principal").orgId, c.req.param("id")),
    }),
  );
  app.post("/:id/image/uploads", async (c) =>
    c.json(
      await issueProductImageUpload(db, context(c), {
        blobs: storage(),
        productId: c.req.param("id"),
        data: await body(c),
      }),
      201,
    ),
  );
  app.put("/:id/image", async (c) =>
    c.json(
      await setProductImage(db, context(c), {
        blobs: storage(),
        productId: c.req.param("id"),
        data: await body(c),
      }),
    ),
  );
  return app;
}
