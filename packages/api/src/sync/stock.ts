import { Hono } from "hono";
import * as v from "valibot";
import { buildInfo } from "@shopper/config";
import { acceptStockDocument, StockError } from "@shopper/core/stock";
import type { ShopperDatabase } from "@shopper/db-pg";
import type { createDeviceService } from "@shopper/auth/devices";
import { stockUpload } from "../schemas/sync/routes";

/**
 * Device-authenticated stock count and receiving upload; one document per request.
 * `rejected` is terminal for the till: it must not retry, only surface the code and message.
 */
export function createStockRoutes(options: {
  database: ShopperDatabase;
  devices: ReturnType<typeof createDeviceService>;
  now?: () => number;
}) {
  const app = new Hono();
  app.post("/sync/stock", async (c) => {
    const principal = await options.devices.resolveUploadPrincipal(c.req.raw);
    if (!principal) return c.json({ error: "Invalid device credential" }, 401);
    const data = v.parse(stockUpload, await c.req.json());
    try {
      const accepted = await acceptStockDocument(
        options.database,
        principal,
        data.document,
        data.proof,
        { appVersion: buildInfo.version, now: options.now },
      );
      return c.json({ requestId: data.requestId, accepted });
    } catch (error) {
      // 23505: two uploads of one id raced past the replay check.
      const pg = error as { code?: string; cause?: { code?: string } };
      const failure =
        (pg?.code ?? pg?.cause?.code) === "23505"
          ? new StockError("CONFLICT", "Stock document identity already exists")
          : error;
      if (failure instanceof StockError)
        return c.json({
          requestId: data.requestId,
          rejected: { code: failure.code, message: failure.message },
        });
      if (v.isValiError(failure))
        return c.json({
          requestId: data.requestId,
          rejected: { code: "INVALID_DOCUMENT", message: "Invalid stock document" },
        });
      throw failure;
    }
  });
  return app;
}
