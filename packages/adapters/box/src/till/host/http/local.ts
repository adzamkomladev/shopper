import { Hono, type Context, type MiddlewareHandler } from "hono";
import * as v from "valibot";
import {
  hostTime,
  listStockDocuments,
  queueStockDocument,
  registerReport,
  registerReportCsv,
  searchCatalogue,
  TillError,
  validateSession,
} from "@shopper/core/till";
import type { Host } from "../types";
import { auditContext } from "../context";

/**
 * Routes the host answers itself under `/api`, from the signed-in session and the till SQLite, so the
 * back office keeps working offline. Permissions are the session's codes, checked like any till command.
 */
export function localRoutes(host: Host) {
  const { database, config, session } = host;
  const identity = config.identity;
  const app = new Hono();
  const need =
    (permission: string): MiddlewareHandler =>
    async (c, next) => {
      if (!config.session) return c.json({ error: "Sign in on this register first" }, 401);
      try {
        await validateSession(database, config.session, {
          scope: identity,
          permission,
          at: new Date(),
        });
      } catch (caught) {
        return refused(c, caught);
      }
      await next();
    };

  app.get("/auth/get-session", (c) => {
    const user = session.current();
    return c.json(
      user && {
        user: {
          id: user.userId,
          name: user.name,
          ...(user.email ? { email: user.email } : {}),
        },
      },
    );
  });
  app.post("/auth/sign-out", async (c) => {
    await session.signOut();
    await host.publishStatus();
    return c.json({ success: true });
  });
  app.get("/session/permissions", (c) => {
    const user = session.current();
    return user
      ? c.json(user.permissions)
      : c.json({ error: "Sign in on this register first" }, 401);
  });
  app.get("/orgs/current", (c) => c.json({ id: identity.orgId, name: identity.shopName }));

  app.get("/register/report", need("report.read"), async (c) => {
    try {
      return c.json(await registerReport(database, c.req.query()));
    } catch (caught) {
      return refused(c, caught);
    }
  });
  app.get("/register/report.csv", need("report.read"), async (c) => {
    try {
      const report = await registerReport(database, c.req.query());
      return c.body(registerReportCsv(report), 200, {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="register-${report.from}-${report.to}.csv"`,
      });
    } catch (caught) {
      return refused(c, caught);
    }
  });
  app.get("/register/stock", need("stock.read"), async (c) =>
    c.json(await listStockDocuments(database, { orgId: identity.orgId, limit: 100 })),
  );
  app.post("/register/stock", need("stock.write"), async (c) => {
    try {
      const queued = await queueStockDocument(database, auditContext(config), {
        scope: identity,
        session: config.session!,
        at: await hostTime(database, identity, new Date()),
        document: await c.req.json().catch(() => null),
      });
      void host.uploadStock();
      return c.json(queued, 201);
    } catch (caught) {
      return refused(c, caught);
    }
  });
  app.get("/register/products", need("stock.read"), async (c) =>
    c.json(
      await searchCatalogue(database, { orgId: identity.orgId, query: c.req.query("q") ?? "" }),
    ),
  );
  return app;
}

function refused(c: Context, caught: unknown) {
  if (v.isValiError(caught)) return c.json({ error: "Check the details and try again" }, 400);
  if (caught instanceof TillError)
    return c.json({ error: caught.message }, caught.code === "permission" ? 403 : 401);
  throw caught;
}
