import { Hono } from "hono";
import * as v from "valibot";
import { buildInfo } from "@shopper/config";
import { acceptCustomerEvent, CustomerError } from "@shopper/core/customers";
import { SaleError } from "@shopper/core/sales";
import type { ShopperDatabase } from "@shopper/db-pg";
import type { createDeviceService } from "@shopper/auth/devices";
import { customerUpload } from "../schemas/sync/customers";

/**
 * Device-authenticated upload of a customer made or edited on a till. `rejected` is terminal for the till: it never
 * retries. A concurrent portal edit is not a rejection; the event resolves field by field and is accepted.
 */
export function createCustomerRoutes(options: {
  database: ShopperDatabase;
  devices: ReturnType<typeof createDeviceService>;
  now?: () => number;
}) {
  const app = new Hono();
  app.post("/sync/customers", async (c) => {
    const principal = await options.devices.resolveUploadPrincipal(c.req.raw);
    if (!principal) return c.json({ error: "Invalid device credential" }, 401);
    const data = v.parse(customerUpload, await c.req.json());
    try {
      const accepted = await acceptCustomerEvent(
        options.database,
        principal,
        data.customer,
        data.proof,
        data.requestId,
        { appVersion: buildInfo.version, now: options.now },
      );
      return c.json({ requestId: data.requestId, accepted });
    } catch (error) {
      // 23505: two uploads of one id raced past the replay check.
      const pg = error as { code?: string; cause?: { code?: string } };
      const failure =
        (pg?.code ?? pg?.cause?.code) === "23505"
          ? new CustomerError("CONFLICT", "Customer identity already exists")
          : error;
      if (failure instanceof CustomerError || failure instanceof SaleError)
        return c.json({
          requestId: data.requestId,
          rejected: { code: failure.code, message: failure.message },
        });
      if (v.isValiError(failure) || failure instanceof RangeError)
        return c.json({
          requestId: data.requestId,
          rejected: { code: "INVALID_EVENT", message: "Invalid customer event" },
        });
      throw failure;
    }
  });
  return app;
}
