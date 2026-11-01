import { Hono } from "hono";
import { readShopAccount } from "@shopper/core/shop";
import { requireShopper } from "./session";
import type { ShopEnvironment, ShopOptions } from "../../types";

/** The signed-in shopper's own account. Everything here is scoped by the session, never by the request. */
export function shopAccountRoutes(options: ShopOptions) {
  const app = new Hono<ShopEnvironment>();
  app.use("/shop/account", requireShopper(options.access));
  app.use("/shop/account/*", requireShopper(options.access));
  app.get("/shop/account", async (c) =>
    c.json(await readShopAccount(options.database, c.get("shopper"))),
  );
  return app;
}
