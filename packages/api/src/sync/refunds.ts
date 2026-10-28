import { Hono } from "hono";
import * as v from "valibot";
import { acceptRefund, lookupSale, RefundError } from "@shopper/core/refunds";
import type { Lane, Queue } from "@shopper/ports";
import { enqueueFiscal } from "./fiscal";
import type { ShopperDatabase } from "@shopper/db-pg";
import type { createDeviceService } from "@shopper/auth/devices";
import { refundUpload, saleLookup } from "../schemas/sync/refunds";
import { adoptSession } from "./offline";

/**
 * Device-authenticated refund upload (one per request) and receipt lookup of any register's sale in the store.
 * `rejected` is terminal for the till: it must not retry, only surface the code and message.
 */
export function createRefundRoutes(options: {
  database: ShopperDatabase;
  devices: ReturnType<typeof createDeviceService>;
  notifications?: Queue;
  lane?: Lane;
  now?: () => number;
}) {
  const app = new Hono();
  app.post("/sync/refunds", async (c) => {
    const principal = await options.devices.resolveUploadPrincipal(c.req.raw);
    if (!principal) return c.json({ error: "Invalid device credential" }, 401);
    const data = v.parse(refundUpload, await c.req.json());
    await adoptSession(options.database, principal, data);
    try {
      const { fiscalDocId, ...accepted } = await acceptRefund(
        options.database,
        principal,
        data.refund,
        data.proof,
        options.now,
        options.notifications,
      );
      await enqueueFiscal(options.lane, principal, fiscalDocId);
      return c.json({ requestId: data.requestId, accepted });
    } catch (error) {
      // 23505: two uploads of one id raced past the replay check.
      const pg = error as { code?: string; cause?: { code?: string } };
      const failure =
        (pg?.code ?? pg?.cause?.code) === "23505"
          ? new RefundError("CONFLICT", "Refund identity already exists")
          : error;
      if (failure instanceof RefundError)
        return c.json({
          requestId: data.requestId,
          rejected: { code: failure.code, message: failure.message },
        });
      if (v.isValiError(failure) || failure instanceof RangeError)
        return c.json({
          requestId: data.requestId,
          rejected: { code: "INVALID_EVENT", message: "Invalid refund" },
        });
      throw failure;
    }
  });
  app.get("/sync/sales/lookup", async (c) => {
    const principal = await options.devices.resolveUploadPrincipal(c.req.raw);
    if (!principal) return c.json({ error: "Invalid device credential" }, 401);
    const { receipt } = v.parse(saleLookup, { receipt: c.req.query("receipt") });
    const found = await lookupSale(options.database, principal, receipt);
    return found ? c.json(found) : c.json({ error: "Sale not found" }, 404);
  });
  return app;
}
