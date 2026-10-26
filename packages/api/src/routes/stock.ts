import { Hono, type Context } from "hono";
import {
  adjustStock,
  receiveStock,
  setReorder,
  stockValuation,
  listDocuments,
  listStock,
  readDocument,
  readStockProduct,
  stockBranches,
} from "@shopper/core/stock";
import type { AdjustmentInput, ReceiptInput } from "@shopper/core/schemas";
import type { Queue } from "@shopper/ports";
import type { ShopperDatabase } from "@shopper/db-pg";
import { commandContext } from "./stock/context";
import { branchScope, scopedBody, scopedQuery } from "../middleware/require/branches";
import { takeRoutes } from "./stock/takes";
import { problem } from "../middleware/problem";
import { requirePermission } from "../middleware/require/permission";
import type { ApiAuthentication, ApiEnvironment } from "../types";

/** Stock on hand, a product's movements and stock records for the back office and tills, behind `stock.read`. */
export function stockRoutes(
  database: ShopperDatabase,
  authentication: ApiAuthentication | undefined,
  notifications?: Queue,
) {
  const app = new Hono<ApiEnvironment>();
  const guard = requirePermission(authentication, (request) =>
    request.method === "GET" ? "stock.read" : "stock.write",
  );
  app.use("/stock", guard).use("/stock/*", guard);
  const org = (c: Context<ApiEnvironment>) => c.get("principal").orgId;
  // A till reads its own branch, whatever the query says; a scoped member only theirs.
  const query = (c: Context<ApiEnvironment>) => scopedQuery(c.get("principal"), c.req.query());
  const scope = (c: Context<ApiEnvironment>) => branchScope(c.get("principal"));

  app.get("/stock/branches", async (c) => c.json(await stockBranches(database, org(c), scope(c))));
  app.get("/stock", async (c) => c.json(await listStock(database, org(c), query(c))));
  app.get("/stock/products/:productId", async (c) =>
    c.json(await readStockProduct(database, org(c), c.req.param("productId"), query(c))),
  );
  app.get("/stock/documents", async (c) =>
    c.json(await listDocuments(database, org(c), query(c), scope(c))),
  );
  app.get("/stock/documents/:id", async (c) =>
    c.json(await readDocument(database, org(c), c.req.param("id"), scope(c))),
  );
  app.get("/stock/valuation", async (c) =>
    c.json(await stockValuation(database, org(c), query(c))),
  );
  const record =
    <T>(
      command: (
        ctx: ReturnType<typeof commandContext>,
        body: T,
      ) => Promise<{ id: string; replayed: boolean }>,
    ) =>
    async (c: Context<ApiEnvironment>) => {
      const principal = c.get("principal");
      const body = scopedBody<T>(principal, await c.req.json().catch(() => undefined));
      const branchId = (body as { branchId?: unknown } | undefined)?.branchId;
      const { id, replayed } = await command(
        commandContext(principal, notifications, branchId),
        body,
      );
      return c.json(await readDocument(database, principal.orgId, id), replayed ? 200 : 201);
    };
  app.post(
    "/stock/receipts",
    record<ReceiptInput>((ctx, receipt) =>
      receiveStock(database, ctx, { receipt, now: new Date() }),
    ),
  );
  app.post(
    "/stock/adjustments",
    record<AdjustmentInput>((ctx, adjustment) =>
      adjustStock(database, ctx, { adjustment, now: new Date() }),
    ),
  );
  app.put("/stock/reorder", async (c) => {
    const principal = c.get("principal");
    const reorder = scopedBody(principal, await c.req.json().catch(() => undefined));
    return c.json(
      await setReorder(
        database,
        commandContext(principal, notifications, (reorder as { branchId?: unknown })?.branchId),
        { reorder },
      ),
    );
  });
  app.route("/stock/takes", takeRoutes(database, notifications));
  app.onError(problem);
  return app;
}
