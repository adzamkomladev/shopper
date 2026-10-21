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
import { commandContext, forceBranch, onlyBranch } from "./stock/context";
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
  // A till reads its own branch, whatever the query says.
  const query = (c: Context<ApiEnvironment>) => {
    const branchId = onlyBranch(c.get("principal"));
    return branchId ? { ...c.req.query(), branchId } : c.req.query();
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
    c.json(await readDocument(database, org(c), c.req.param("id"), onlyBranch(c.get("principal")))),
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
      const body = forceBranch<T>(principal, await c.req.json().catch(() => undefined));
      const { id, replayed } = await command(commandContext(principal, notifications), body);
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
    const reorder = forceBranch(principal, await c.req.json().catch(() => undefined));
    return c.json(
      await setReorder(database, commandContext(principal, notifications), { reorder }),
    );
  });
  app.route("/stock/takes", takeRoutes(database, notifications));
  app.onError(problem);
  return app;
}
