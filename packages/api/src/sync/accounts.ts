import { Hono, type Context } from "hono";
import * as v from "valibot";
import { buildInfo } from "@shopper/config";
import {
  accountSummary,
  createHold,
  CustomerError,
  releaseHold,
  tillActor,
} from "@shopper/core/customers";
import { customerId, holdInput, holdRelease } from "@shopper/core/schemas";
import { SaleError } from "@shopper/core/sales";
import type { ShopperDatabase } from "@shopper/db-pg";
import type { createDeviceService } from "@shopper/auth/devices";
import { holdReleaseUpload, holdUpload } from "../schemas/sync/customers";

const customerStatus: Record<string, 404 | 409> = { NOT_FOUND: 404 };
const saleStatus: Record<string, 401 | 403> = {
  INVALID_SESSION: 401,
  PERMISSION_DENIED: 403,
  SCOPE: 403,
};

/**
 * Credit on the till, online only: read what a customer may spend, take a hold before the sale completes (its id
 * is the tender id) and release it when the tender goes. Device credential plus cashier session with `sale.create`.
 */
export function createAccountRoutes(options: {
  database: ShopperDatabase;
  devices: ReturnType<typeof createDeviceService>;
}) {
  const app = new Hono();
  const { database } = options;
  const device = (c: Context) => options.devices.resolveUploadPrincipal(c.req.raw);

  app.post("/sync/customers/holds", async (c) => {
    const principal = await device(c);
    if (!principal) return c.json({ error: "Invalid device credential" }, 401);
    const data = v.parse(holdUpload, await c.req.json());
    return answer(c, async () => {
      const hold = v.parse(holdInput, data.hold);
      const actor = await tillActor(database, principal, hold, data.proof, buildInfo.version);
      const done = await createHold(database, actor.context, {
        ...actor,
        principal,
        sessionId: hold.sessionId,
        hold,
      });
      return c.json({ requestId: data.requestId, hold: done.hold }, done.replayed ? 200 : 201);
    });
  });
  app.post("/sync/customers/holds/:id/release", async (c) => {
    const principal = await device(c);
    if (!principal) return c.json({ error: "Invalid device credential" }, 401);
    const data = v.parse(holdReleaseUpload, await c.req.json());
    return answer(c, async () => {
      const id = v.parse(customerId, c.req.param("id"));
      const release = v.parse(holdRelease, data.release);
      const actor = await tillActor(database, principal, release, data.proof, buildInfo.version);
      const done = await releaseHold(database, actor.context, {
        ...actor,
        principal,
        sessionId: release.sessionId,
        id,
      });
      return c.json({ requestId: data.requestId, hold: done.hold });
    });
  });
  app.get("/sync/customers/:id/account", async (c) => {
    const principal = await device(c);
    if (!principal) return c.json({ error: "Invalid device credential" }, 401);
    return answer(c, async () =>
      c.json(await accountSummary(database, principal.orgId, c.req.param("id"))),
    );
  });
  return app;
}

/** Refusals keep their code (and the credit still available) so the till can explain them. */
async function answer(c: Context, reply: () => Promise<Response>) {
  try {
    return await reply();
  } catch (error) {
    // 23505: a hold id another org already used, or two creates of one id racing past the replay check.
    const pg = error as { code?: string; cause?: { code?: string } };
    if ((pg?.code ?? pg?.cause?.code) === "23505")
      return c.json({ error: "Hold identity already exists", code: "CONFLICT" }, 409);
    if (error instanceof CustomerError)
      return c.json(
        { error: error.message, code: error.code, ...error.detail },
        customerStatus[error.code] ?? 409,
      );
    if (error instanceof SaleError)
      return c.json({ error: error.message, code: error.code }, saleStatus[error.code] ?? 409);
    if (v.isValiError(error)) return c.json({ error: "Invalid account request" }, 400);
    throw error;
  }
}
