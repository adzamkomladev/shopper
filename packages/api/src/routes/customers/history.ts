import { Hono } from "hono";
import { listCustomerSales, listStatementDeliveries } from "@shopper/core/customers";
import type { ShopperDatabase } from "@shopper/db-pg";
import type { ApiEnvironment } from "../../types";

/** What a customer bought and which statements they were sent; the guard sits on the customer routes. */
export function customerHistoryRoutes(database: ShopperDatabase) {
  const app = new Hono<ApiEnvironment>();

  app.get("/customers/:id/sales", async (c) =>
    c.json(await listCustomerSales(database, c.get("principal").orgId, c.req.param("id"))),
  );
  app.get("/customers/:id/statements", async (c) =>
    c.json(await listStatementDeliveries(database, c.get("principal").orgId, c.req.param("id"))),
  );
  return app;
}
