import { Hono, type Context, type MiddlewareHandler } from "hono";
import * as v from "valibot";
import { createKyc, kycCaseId } from "@shopper/auth/kyc";
import { commandContext } from "./stock/context";
import { problem } from "../middleware/problem";
import { requirePermission } from "../middleware/require/permission";
import type { ApiEnvironment, ApiOptions } from "../types";

type Call = Context<ApiEnvironment>;

/**
 * KYC cases and the org's KYC settings. A case is opened and worked by whoever its purpose needs (the commands
 * check: customer.manage for credit, role.write for a role), a decision needs `kyc.approve`, and the queue and
 * settings need `customer.manage`.
 */
export function kycRoutes(options: ApiOptions) {
  const app = new Hono<ApiEnvironment>();
  const kyc = createKyc({
    database: options.database!,
    launcher: options.kyc,
    linkSecret: options.linkSecret,
  });
  const permission = (request: Request) => {
    if (new URL(request.url).pathname.endsWith("/decision")) return "kyc.approve";
    return request.method === "GET" ? "customer.manage" : undefined;
  };
  const guard: MiddlewareHandler<ApiEnvironment> = async (c, next) => {
    const code = permission(c.req.raw);
    if (code) return requirePermission(options.authentication, code)(c, next);
    const principal = await options.authentication?.resolvePrincipal(c.req.raw);
    if (!principal) return c.json({ error: "Authentication required" }, 401);
    c.set("principal", principal);
    return next();
  };
  app.use("/kyc", guard).use("/kyc/*", guard);
  app.use("/settings/kyc", requirePermission(options.authentication, "customer.manage"));
  const run = (c: Call) => commandContext(c.get("principal"));
  const id = (c: Call) => v.parse(kycCaseId, c.req.param("id"));
  const body = (c: Call) => c.req.json().catch(() => undefined);

  app.post("/kyc", async (c) => c.json(await kyc.open(run(c), await body(c)), 201));
  app.get("/kyc", async (c) => c.json(await kyc.list(run(c), c.req.query())));
  app.get("/kyc/:id", async (c) => c.json(await kyc.read(run(c), id(c))));
  app.post("/kyc/:id/resend", async (c) => c.json(await kyc.resend(run(c), id(c))));
  app.post("/kyc/:id/verify", async (c) => c.json(await kyc.verify(run(c), id(c), await body(c))));
  app.post("/kyc/:id/id", async (c) => c.json(await kyc.recordId(run(c), id(c), await body(c))));
  app.post("/kyc/:id/skip-id", async (c) => c.json(await kyc.skipId(run(c), id(c))));
  app.post("/kyc/:id/decision", async (c) =>
    c.json(await kyc.decide(run(c), id(c), await body(c))),
  );
  app.get("/settings/kyc", async (c) => c.json(await kyc.settings(run(c))));
  app.put("/settings/kyc", async (c) => c.json(await kyc.setSettings(run(c), await body(c))));
  app.onError(problem);
  return app;
}
