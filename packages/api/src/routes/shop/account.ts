import { Hono, type Context } from "hono";
import {
  deleteShopAddress,
  listShopAddresses,
  listShopReceipts,
  readShopAccount,
  readShopPoints,
  readShopReceipt,
  saveShopAddress,
  saveShopProfile,
  shopReceiptPdfKey,
  ShopError,
} from "@shopper/core/shop";
import { requireShopper } from "./session";
import type { ShopEnvironment, ShopOptions } from "../../types";

/** How long a receipt PDF link works: long enough to open, too short to pass around. */
const PDF_SECONDS = 60;

/** The signed-in shopper's own account. Everything here is scoped by the session, never by the request. */
export function shopAccountRoutes(options: ShopOptions) {
  const app = new Hono<ShopEnvironment>();
  const db = options.database;
  app.onError((error, c) => {
    if (error instanceof ShopError) return c.json({ error: error.message }, error.status);
    throw error;
  });
  app.use("/shop/account", requireShopper(options.access));
  app.use("/shop/account/*", requireShopper(options.access));
  const body = (c: Context) => c.req.json().catch(() => ({}));

  app.get("/shop/account", async (c) => c.json(await readShopAccount(db, c.get("shopper"))));
  app.patch("/shop/account", async (c) =>
    c.json(await saveShopProfile(db, options.appVersion, c.get("shopper"), await body(c))),
  );
  app.get("/shop/account/points", async (c) => c.json(await readShopPoints(db, c.get("shopper"))));
  app.get("/shop/account/receipts", async (c) =>
    c.json(await listShopReceipts(db, c.get("shopper"))),
  );
  app.get("/shop/account/receipts/:saleId", async (c) =>
    c.json(await readShopReceipt(db, c.get("shopper"), c.req.param("saleId"))),
  );
  app.get("/shop/account/receipts/:saleId/pdf", async (c) => {
    const key = await shopReceiptPdfKey(db, c.get("shopper"), c.req.param("saleId"));
    if (!options.blobs) return c.json({ error: "Receipt PDFs are unavailable" }, 503);
    return c.redirect(
      await options.blobs.createDownload(c.get("shopper").orgId, key, PDF_SECONDS),
      302,
    );
  });
  app.get("/shop/account/addresses", async (c) =>
    c.json(await listShopAddresses(db, c.get("shopper"))),
  );
  app.post("/shop/account/addresses", async (c) =>
    c.json(await saveShopAddress(db, options.appVersion, c.get("shopper"), await body(c)), 201),
  );
  app.patch("/shop/account/addresses/:addressId", async (c) =>
    c.json(
      await saveShopAddress(
        db,
        options.appVersion,
        c.get("shopper"),
        await body(c),
        c.req.param("addressId"),
      ),
    ),
  );
  app.delete("/shop/account/addresses/:addressId", async (c) => {
    await deleteShopAddress(db, options.appVersion, c.get("shopper"), c.req.param("addressId"));
    return c.body(null, 204);
  });
  return app;
}
