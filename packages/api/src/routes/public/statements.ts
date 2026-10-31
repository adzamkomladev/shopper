import { Hono } from "hono";
import { CustomerError, readStatementByToken } from "@shopper/core/customers";
import type { ShopperDatabase } from "@shopper/db-pg";
import type { Json, Renderer } from "@shopper/ports";

/**
 * What a customer's link opens, with no session: the token is the whole credential. A bad, expired, revoked or
 * foreign token is an empty 404, so nothing says which it was. Every open counts as a view.
 */
export function publicStatementRoutes(
  database: ShopperDatabase,
  linkSecret: string,
  renderer?: Renderer,
) {
  const app = new Hono();
  // The token is in the URL: keep it out of caches and referrers.
  app.use("/public/statements/*", async (c, next) => {
    await next();
    c.header("Cache-Control", "no-store");
    c.header("Referrer-Policy", "no-referrer");
  });
  app.onError((error, c) => {
    if (error instanceof CustomerError && error.code === "NOT_FOUND") return c.body(null, 404);
    throw error;
  });

  app.get("/public/statements/:token", async (c) =>
    c.json(await readStatementByToken(database, linkSecret, c.req.param("token"))),
  );
  app.get("/public/statements/:token/pdf", async (c) => {
    if (!renderer) return c.body(null, 503);
    const statement = await readStatementByToken(database, linkSecret, c.req.param("token"));
    const { from, to } = statement.period;
    return c.body(new Uint8Array(await renderer.statement(statement as unknown as Json)), 200, {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="statement-${from}-${to}.pdf"`,
    });
  });
  return app;
}
