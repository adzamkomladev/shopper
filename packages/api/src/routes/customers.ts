import { Hono, type Context } from "hono";
import * as v from "valibot";
import {
  ageingCsv,
  archiveCustomer,
  createCustomer,
  customerCsv,
  listCustomers,
  mergeCustomers,
  readCustomer,
  unarchiveCustomer,
  updateCustomer,
} from "@shopper/core/customers";
import { customerMerge } from "@shopper/core/schemas";
import type { Queue } from "@shopper/ports";
import type { ShopperDatabase } from "@shopper/db-pg";
import { commandContext } from "./stock/context";
import { customerCreditRoutes } from "./customers/credit";
import { customerStatementRoutes } from "./customers/statements";
import { problem } from "../middleware/problem";
import { requirePermission } from "../middleware/require/permission";
import type { ApiAuthentication, ApiEnvironment, StatementLinks } from "../types";

const managed =
  /\/(?:archive|unarchive|merge|payments|limit|credit\/notes|statements|statement\/links(?:\/[^/]+)?)$/;

/**
 * Customers for the back office: reading needs `customer.read`, editing `customer.write`, and archive, merge,
 * payments, limits and credit notes `customer.manage`.
 */
export function customerRoutes(
  database: ShopperDatabase,
  authentication: ApiAuthentication | undefined,
  notifications?: Queue,
  links?: StatementLinks,
) {
  const app = new Hono<ApiEnvironment>();
  const guard = requirePermission(authentication, (request) => {
    if (request.method === "GET") return "customer.read";
    return managed.test(new URL(request.url).pathname) ? "customer.manage" : "customer.write";
  });
  app.use("/customers", guard).use("/customers/*", guard);
  const org = (c: Context<ApiEnvironment>) => c.get("principal").orgId;
  const run = (c: Context<ApiEnvironment>) => commandContext(c.get("principal"), notifications);
  const body = (c: Context<ApiEnvironment>) => c.req.json().catch(() => undefined);

  app.get("/customers", async (c) => c.json(await listCustomers(database, org(c), c.req.query())));
  // Registered before /customers/:id so "export.csv" is never read as an id.
  app.get("/customers/export.csv", async (c) =>
    c.body(await customerCsv(database, org(c)), 200, {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": 'attachment; filename="customers.csv"',
    }),
  );
  app.get("/customers/ageing.csv", async (c) =>
    c.body(await ageingCsv(database, org(c)), 200, {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": 'attachment; filename="ageing.csv"',
    }),
  );
  app.route("/", customerCreditRoutes(database, notifications));
  app.route("/", customerStatementRoutes(database, notifications, links));
  app.post("/customers", async (c) => {
    const { id, replayed } = await createCustomer(database, run(c), { customer: await body(c) });
    return c.json(await readCustomer(database, org(c), id), replayed ? 200 : 201);
  });
  app.get("/customers/:id", async (c) =>
    c.json(await readCustomer(database, org(c), c.req.param("id"))),
  );
  app.patch("/customers/:id", async (c) => {
    const { id } = await updateCustomer(database, run(c), {
      id: c.req.param("id"),
      patch: await body(c),
    });
    return c.json(await readCustomer(database, org(c), id));
  });
  app.post("/customers/:id/archive", async (c) => {
    const { id } = await archiveCustomer(database, run(c), {
      id: c.req.param("id"),
      now: new Date(),
    });
    return c.json(await readCustomer(database, org(c), id));
  });
  app.post("/customers/:id/unarchive", async (c) => {
    const { id } = await unarchiveCustomer(database, run(c), { id: c.req.param("id") });
    return c.json(await readCustomer(database, org(c), id));
  });
  app.post("/customers/:id/merge", async (c) => {
    const { loserId } = v.parse(customerMerge, (await body(c)) ?? {});
    const { winnerId } = await mergeCustomers(database, run(c), {
      winnerId: c.req.param("id"),
      loserId,
      now: new Date(),
    });
    return c.json(await readCustomer(database, org(c), winnerId));
  });
  app.onError(problem);
  return app;
}
