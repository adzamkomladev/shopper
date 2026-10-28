import { Hono } from "hono";
import * as v from "valibot";
import { acceptShift, ShiftError } from "@shopper/core/shifts";
import type { ShopperDatabase } from "@shopper/db-pg";
import type { createDeviceService } from "@shopper/auth/devices";
import { shiftUpload } from "../schemas/sync/shifts";
import { adoptSession } from "./offline";

/** Device-authenticated upload of a closed shift's Z. `rejected` is terminal for the till: it never retries. */
export function createShiftRoutes(options: {
  database: ShopperDatabase;
  devices: ReturnType<typeof createDeviceService>;
}) {
  const app = new Hono();
  app.post("/sync/shifts", async (c) => {
    const principal = await options.devices.resolveUploadPrincipal(c.req.raw);
    if (!principal) return c.json({ error: "Invalid device credential" }, 401);
    const data = v.parse(shiftUpload, await c.req.json());
    await adoptSession(options.database, principal, data);
    try {
      const accepted = await acceptShift(options.database, principal, data.shift, data.proof);
      return c.json({ requestId: data.requestId, accepted });
    } catch (error) {
      // 23505: two uploads of one id raced past the replay check.
      const pg = error as { code?: string; cause?: { code?: string } };
      const failure =
        (pg?.code ?? pg?.cause?.code) === "23505"
          ? new ShiftError("CONFLICT", "Shift identity already exists")
          : error;
      if (failure instanceof ShiftError)
        return c.json({
          requestId: data.requestId,
          rejected: { code: failure.code, message: failure.message },
        });
      if (v.isValiError(failure) || failure instanceof RangeError)
        return c.json({
          requestId: data.requestId,
          rejected: { code: "INVALID_EVENT", message: "Invalid shift" },
        });
      throw failure;
    }
  });
  return app;
}
