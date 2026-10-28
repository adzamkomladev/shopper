import { Hono, type Context } from "hono";
import { AssetError, issueKybUpload } from "@shopper/assets";
import { readKyb, saveKyb, submitKyb } from "@shopper/core/kyb";
import { commandContext } from "./stock/context";
import { problem } from "../middleware/problem";
import { requirePermission } from "../middleware/require/permission";
import type { ApiEnvironment, ApiOptions } from "../types";

/**
 * The owner's business verification for payouts (`org.kyb.submit`): the draft, document upload grants, the
 * Paystack banks a payout can settle to, and the submission. Cloud only: the box takes no payouts.
 */
export function kybRoutes(options: ApiOptions & { kyb: NonNullable<ApiOptions["kyb"]> }) {
  const app = new Hono<ApiEnvironment>();
  const database = options.database!;
  app.use("/kyb", requirePermission(options.authentication, "org.kyb.submit"));
  app.use("/kyb/*", requirePermission(options.authentication, "org.kyb.submit"));
  const run = (c: Context<ApiEnvironment>) =>
    commandContext(c.get("principal"), options.notifications);
  const view = (c: Context<ApiEnvironment>) => readKyb(database, c.get("principal").orgId);

  app.get("/kyb", async (c) => c.json(await view(c)));
  app.put("/kyb", async (c) => {
    await saveKyb(database, run(c), { body: await c.req.json().catch(() => undefined) });
    return c.json(await view(c));
  });
  app.get("/kyb/banks", async (c) => c.json(await options.kyb.banks()));
  app.post("/kyb/documents", async (c) => {
    if (!options.blobs) throw new AssetError("Direct uploads are unavailable", 503);
    const grant = await issueKybUpload(database, run(c), {
      blobs: options.blobs,
      data: await c.req.json().catch(() => undefined),
    });
    return c.json(grant, 201);
  });
  app.post("/kyb/submit", async (c) => {
    await submitKyb(database, run(c), undefined);
    return c.json(await view(c), 202);
  });
  app.onError(problem);
  return app;
}
