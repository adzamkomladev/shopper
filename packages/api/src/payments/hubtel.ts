import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import * as v from "valibot";
import { and, eq } from "drizzle-orm";
import { buildInfo } from "@shopper/config";
import { payment } from "@shopper/db-pg";
import { uuidV7Schema } from "@shopper/ports";
import { applyMomoEvent } from "@shopper/core/payments";
import { callbackSchema } from "@shopper/core/payments/hubtel";
import type { ApiOptions } from "../types";

/**
 * Hubtel's payment callback. It carries no signature, so it is only a nudge: the status API says what happened,
 * and that answer is applied once per outcome like any provider event.
 */
export function hubtelRoutes(options: ApiOptions) {
  const app = new Hono();
  app.use("/webhooks/hubtel", bodyLimit({ maxSize: 16_384 }));
  app.post("/webhooks/hubtel", async (c) => {
    if (!options.database || !options.hubtel || !options.momoPayment)
      return c.json({ error: "Payments unavailable" }, 503);
    const callback = v.safeParse(callbackSchema, await c.req.json().catch(() => undefined));
    if (!callback.success) return c.json({ error: "Invalid Hubtel callback" }, 400);
    const reference = callback.output.Data.ClientReference;
    if (!v.safeParse(uuidV7Schema, reference).success) return c.json({ received: true });
    const [row] = await options.database
      .select()
      .from(payment)
      .where(
        and(
          eq(payment.id, reference),
          eq(payment.reference, reference),
          eq(payment.provider, "hubtel"),
        ),
      );
    if (!row) return c.json({ received: true });
    const verified = await options.hubtel.verify(reference);
    if (verified.status !== "confirmed" && verified.status !== "failed")
      return c.json({ received: true });
    if (verified.status === "confirmed" && verified.amount !== row.amount)
      return c.json({ error: "Payment amount mismatch" }, 400);
    const saved = await applyMomoEvent(
      options.database,
      { orgId: row.orgId, appVersion: buildInfo.version },
      {
        provider: "hubtel",
        key: `${verified.status}:${reference}`,
        kind: `hubtel.${verified.status}`,
        reference,
        status: verified.status,
        providerReference: verified.providerReference,
        message: verified.status === "failed" ? "Hubtel reports the payment failed" : undefined,
      },
    );
    if (saved.duplicate) return c.json({ received: true });
    if (options.realtime) await options.realtime.publish(row.orgId, saved.storeId, saved.envelope);
    await options.momoPayment.send(reference, "payment", { type: "settled" });
    return c.json({ received: true });
  });
  return app;
}
