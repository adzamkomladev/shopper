import { Hono, type Context, type MiddlewareHandler } from "hono";
import { dismissSetup, finishSetup, readSetup, skipSetupProducts } from "@shopper/core/onboarding";
import { commandContext } from "./stock/context";
import { problem } from "../middleware/problem";
import { requirePermission } from "../middleware/require/permission";
import type { ApiEnvironment, ApiOptions } from "../types";

/**
 * The setup wizard: where the shop stands, read from the rows each step makes, and the owner's moves through it.
 * Every member may see the progress; changing it takes `store.write`, the first steps' own permission.
 */
export function setupRoutes(options: ApiOptions) {
  const app = new Hono<ApiEnvironment>();
  const database = options.database!;
  const member: MiddlewareHandler<ApiEnvironment> = async (c, next) => {
    const principal = await options.authentication?.resolvePrincipal(c.req.raw);
    if (!principal) return c.json({ error: "Authentication required" }, 401);
    c.set("principal", principal);
    await next();
  };
  const view = (c: Context<ApiEnvironment>) => readSetup(database, c.get("principal").orgId);
  const move =
    (command: typeof finishSetup | typeof skipSetupProducts) =>
    async (c: Context<ApiEnvironment>) => {
      await command(database, commandContext(c.get("principal"), options.notifications), undefined);
      return c.json(await view(c));
    };

  app.get("/setup", member, async (c) => c.json(await view(c)));
  app.use("/setup/*", requirePermission(options.authentication, "store.write"));
  app.post("/setup/products/skip", move(skipSetupProducts));
  app.post("/setup/finish", move(finishSetup));
  app.post("/setup/dismiss", move(dismissSetup));
  app.onError(problem);
  return app;
}
