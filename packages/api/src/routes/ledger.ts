import { Hono, type Context } from "hono";
import {
  accountLines,
  balanceSheet,
  createAccount,
  listAccounts,
  listJournal,
  postManualJournal,
  profitLoss,
  reverseJournal,
  setLedgerLock,
  statementTables,
  trialBalance,
  updateAccount,
} from "@shopper/core/ledger";
import { reportCsv } from "@shopper/core/reports";
import type { ShopperDatabase } from "@shopper/db-pg";
import { commandContext } from "./stock/context";
import { problem } from "../middleware/problem";
import { requirePermission } from "../middleware/require/permission";
import type { ApiAuthentication, ApiEnvironment } from "../types";

/**
 * The general ledger: the chart with balances, the journal, an account's lines, the statements (each also as CSV),
 * manual journals and reversals (ledger.write) and the lock date (ledger.lock). Reading needs ledger.read.
 */
export function ledgerRoutes(
  database: ShopperDatabase,
  authentication: ApiAuthentication | undefined,
) {
  const app = new Hono<ApiEnvironment>();
  app.use(
    "/ledger/*",
    requirePermission(authentication, (request) => {
      if (request.method === "GET") return "ledger.read";
      return new URL(request.url).pathname.endsWith("/ledger/lock")
        ? "ledger.lock"
        : "ledger.write";
    }),
  );
  const org = (c: Context<ApiEnvironment>) => c.get("principal").orgId;
  const context = (c: Context<ApiEnvironment>) => commandContext(c.get("principal"));
  const body = (c: Context<ApiEnvironment>) => c.req.json().catch(() => undefined);

  app.get("/ledger/accounts", async (c) => c.json(await listAccounts(database, org(c))));
  app.post("/ledger/accounts", async (c) =>
    c.json(await createAccount(database, context(c), { account: await body(c) }), 201),
  );
  app.patch("/ledger/accounts/:id", async (c) =>
    c.json(
      await updateAccount(database, context(c), { id: c.req.param("id"), patch: await body(c) }),
    ),
  );
  app.get("/ledger/accounts/:id/lines", async (c) =>
    c.json(await accountLines(database, org(c), c.req.param("id"), c.req.query())),
  );
  app.get("/ledger/journal", async (c) =>
    c.json(await listJournal(database, org(c), c.req.query())),
  );
  app.post("/ledger/journal", async (c) =>
    c.json(await postManualJournal(database, context(c), { journal: await body(c) }), 201),
  );
  app.post("/ledger/journal/:id/reverse", async (c) =>
    c.json(
      await reverseJournal(database, context(c), {
        entryId: c.req.param("id"),
        body: await body(c),
      }),
      201,
    ),
  );
  app.get("/ledger/reports/trial", async (c) =>
    c.json(await trialBalance(database, org(c), c.req.query())),
  );
  app.get("/ledger/reports/profit", async (c) =>
    c.json(await profitLoss(database, org(c), c.req.query())),
  );
  app.get("/ledger/reports/balance", async (c) =>
    c.json(await balanceSheet(database, org(c), c.req.query())),
  );
  for (const [name, tabulate] of Object.entries(statementTables))
    app.get(`/ledger/reports/${name}.csv`, async (c) => {
      const table = await tabulate(database, org(c), c.req.query());
      return c.body(reportCsv(table), 200, {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="${table.name}.csv"`,
      });
    });
  app.put("/ledger/lock", async (c) =>
    c.json(await setLedgerLock(database, context(c), { body: await body(c) })),
  );
  app.onError(problem);
  return app;
}
