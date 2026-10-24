import { Hono, type Context } from "hono";
import {
  addCreditNote,
  readAgeing,
  readCustomer,
  readStatement,
  recordPayment,
  setCreditLimit,
} from "@shopper/core/customers";
import type { Queue } from "@shopper/ports";
import type { ShopperDatabase } from "@shopper/db-pg";
import { commandContext } from "../stock/context";
import type { ApiEnvironment } from "../../types";

/** Payments, limits, credit notes, statements and ageing of one customer; the guard sits on the customer routes. */
export function customerCreditRoutes(database: ShopperDatabase, notifications?: Queue) {
  const app = new Hono<ApiEnvironment>();
  const org = (c: Context<ApiEnvironment>) => c.get("principal").orgId;
  const run = (c: Context<ApiEnvironment>) => commandContext(c.get("principal"), notifications);
  const target = async (c: Context<ApiEnvironment>) => ({
    id: c.req.param("id")!,
    body: await c.req.json().catch(() => undefined),
  });

  app.post("/customers/:id/payments", async (c) => {
    const { id, replayed } = await recordPayment(database, run(c), await target(c));
    return c.json(await readCustomer(database, org(c), id), replayed ? 200 : 201);
  });
  app.put("/customers/:id/limit", async (c) => {
    const { id } = await setCreditLimit(database, run(c), await target(c));
    return c.json(await readCustomer(database, org(c), id));
  });
  app.post("/customers/:id/credit/notes", async (c) => {
    const { id } = await addCreditNote(database, run(c), await target(c));
    return c.json(await readCustomer(database, org(c), id), 201);
  });
  app.get("/customers/:id/statement", async (c) =>
    c.json(await readStatement(database, org(c), c.req.param("id"), c.req.query())),
  );
  app.get("/customers/:id/ageing", async (c) =>
    c.json(await readAgeing(database, org(c), c.req.param("id"))),
  );
  return app;
}
