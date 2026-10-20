import { Hono, type Context } from "hono";
import {
  listDocuments,
  listStock,
  readDocument,
  readStockProduct,
  stockBranches,
} from "@shopper/core/stock";
import type { ShopperDatabase } from "@shopper/db-pg";
import { problem } from "../middleware/problem";
import { requirePermission } from "../middleware/require/permission";
import type { ApiAuthentication, ApiEnvironment } from "../types";

/** Stock on hand, a product's movements and stock records for the back office and tills, behind `stock.read`. */
export function stockRoutes(
  database: ShopperDatabase,
  authentication: ApiAuthentication | undefined,
) {
  const app = new Hono<ApiEnvironment>();
  const guard = requirePermission(authentication, "stock.read");
  app.use("/stock", guard).use("/stock/*", guard);
  const org = (c: Context<ApiEnvironment>) => c.get("principal").orgId;
  // A till reads its own branch, whatever the query says.
  const query = (c: Context<ApiEnvironment>) => {
    const principal = c.get("principal");
    return principal.deviceId ? { ...c.req.query(), branchId: principal.branchId } : c.req.query();
  };

  app.get("/stock/branches", async (c) =>
    c.json(await stockBranches(database, org(c), c.get("principal").branchId)),
  );
  app.get("/stock", async (c) => c.json(await listStock(database, org(c), query(c))));
  app.get("/stock/products/:productId", async (c) =>
    c.json(await readStockProduct(database, org(c), c.req.param("productId"), query(c))),
  );
  app.get("/stock/documents", async (c) => c.json(await listDocuments(database, org(c), query(c))));
  app.get("/stock/documents/:id", async (c) =>
    c.json(
      await readDocument(
        database,
        org(c),
        c.req.param("id"),
        c.get("principal").deviceId ? c.get("principal").branchId : undefined,
      ),
    ),
  );
  app.onError(problem);
  return app;
}
