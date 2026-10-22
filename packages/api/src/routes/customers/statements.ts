import { Hono, type Context } from "hono";
import {
  createStatementLink,
  listStatementLinks,
  revokeStatementLink,
  sendStatement,
  signStatementToken,
  statementLinkUrl,
} from "@shopper/core/customers";
import type { Queue } from "@shopper/ports";
import type { ShopperDatabase } from "@shopper/db-pg";
import { commandContext } from "../stock/context";
import type { ApiEnvironment, StatementLinks } from "../../types";

/** Sending a customer's statement and managing their links; the guard sits on the customer routes. */
export function customerStatementRoutes(
  database: ShopperDatabase,
  notifications?: Queue,
  links?: StatementLinks,
) {
  const app = new Hono<ApiEnvironment>();
  const run = (c: Context<ApiEnvironment>) => commandContext(c.get("principal"), notifications);
  const target = async (c: Context<ApiEnvironment>) => ({
    id: c.req.param("id")!,
    body: await c.req.json().catch(() => undefined),
  });

  app.post("/customers/:id/statements", async (c) => {
    const { replayed, ...delivery } = await sendStatement(database, run(c), await target(c));
    return c.json(delivery, replayed ? 200 : 201);
  });
  app.get("/customers/:id/statement/links", async (c) =>
    c.json(await listStatementLinks(database, c.get("principal").orgId, c.req.param("id"))),
  );
  app.post("/customers/:id/statement/links", async (c) => {
    if (!links) return c.json({ error: "Statement links are unavailable" }, 503);
    const link = await createStatementLink(database, run(c), await target(c));
    const token = await signStatementToken(links.secret, {
      linkId: link.id,
      orgId: link.orgId,
      customerId: link.customerId,
      from: link.from,
      to: link.to,
      exp: link.expiresAt.getTime(),
    });
    return c.json(
      {
        id: link.id,
        from: link.from,
        to: link.to,
        expiresAt: link.expiresAt.toISOString(),
        token,
        url: statementLinkUrl(links.baseUrl, token),
      },
      201,
    );
  });
  app.delete("/customers/:id/statement/links/:linkId", async (c) => {
    const { id } = await revokeStatementLink(database, run(c), {
      id: c.req.param("id"),
      linkId: c.req.param("linkId"),
    });
    return c.json({ id, revoked: true });
  });
  return app;
}
