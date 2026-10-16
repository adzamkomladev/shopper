import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import * as v from "valibot";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { buildInfo } from "@shopper/config";
import { payment, saleTender, user } from "@shopper/db-pg";
import { uuidV7Schema } from "@shopper/ports";
import { money, toPesewas } from "@shopper/money";
import {
  momoCheckpoint,
  momoInput,
  momoOtp,
  paymentView,
  startMomo,
  updateMomo,
} from "@shopper/core/payments";
import { verifyWebhook } from "@shopper/core/payments/paystack";
import { ManagementError } from "@shopper/core/management";
import type { ApiOptions } from "../types";

export function paymentRoutes(options: ApiOptions) {
  const app = new Hono<import("../types").ApiEnvironment>();
  app.use("/payments/*", bodyLimit({ maxSize: 16_384 }));
  app.use("/webhooks/paystack", bodyLimit({ maxSize: 16_384 }));
  app.onError((error, c) => {
    if (error instanceof ManagementError) return c.json({ error: error.message }, error.status);
    if (v.isValiError(error) || error instanceof SyntaxError)
      return c.json({ error: "Invalid payment data" }, 400);
    return c.json({ error: "Payment service unavailable" }, 503);
  });
  app.post("/webhooks/paystack", async (c) => {
    const event =
      options.paystackSecret &&
      (await verifyWebhook(
        options.paystackSecret,
        await c.req.text(),
        c.req.header("x-paystack-signature"),
      ));
    if (!event) return c.json({ error: "Invalid Paystack signature" }, 401);
    if (!options.database || !options.momoPayment)
      return c.json({ error: "Payments unavailable" }, 503);
    if (!v.safeParse(uuidV7Schema, event.data.reference).success) return c.json({ received: true });
    const [row] = await options.database
      .select()
      .from(payment)
      .where(
        and(eq(payment.id, event.data.reference), eq(payment.reference, event.data.reference)),
      );
    if (!row) return c.json({ received: true });
    if (toPesewas(money(row.amount)) !== event.data.amount)
      return c.json({ error: "Payment amount mismatch" }, 400);
    const status = event.event === "charge.success" ? "confirmed" : "failed";
    const saved = await updateMomo(
      options.database,
      { orgId: row.orgId, appVersion: buildInfo.version },
      { reference: row.reference, status, message: event.data.gateway_response ?? undefined },
      momoCheckpoint(row.reference, `webhook-${status}`, "completed"),
    );
    // The table survives an expired engine instance; late confirmations remain recoverable.
    if (options.realtime) await options.realtime.publish(row.orgId, saved.storeId, saved.envelope);
    await options.momoPayment.send(row.reference, "payment", { type: "settled" });
    return c.json({ received: true });
  });
  app.use("/payments/*", async (c, next) => {
    const principal = await options.devices?.resolveDevicePrincipal(c.req.raw);
    if (!principal?.deviceId || !principal.branchId)
      return c.json({ error: "Cashier and device authentication required" }, 401);
    if (
      !options.authentication ||
      !(await options.authentication.hasPermission(principal, "payment.momo"))
    )
      return c.json({ error: "Permission denied" }, 403);
    c.set("principal", principal);
    await next();
  });
  app.post("/payments/momo", async (c) => {
    if (!options.database || !options.momoPayment)
      return c.json({ error: "Payments unavailable" }, 503);
    const p = c.get("principal");
    const data = v.parse(momoInput, await c.req.json());
    const saved = await startMomo(
      options.database,
      {
        orgId: p.orgId,
        actorId: p.userId,
        deviceId: p.deviceId,
        branchId: p.branchId,
        role: p.roleName,
        appVersion: buildInfo.version,
      },
      data,
    );
    const [cashier] = await options.database
      .select({ email: user.email })
      .from(user)
      .where(and(eq(user.orgId, p.orgId), eq(user.id, p.userId)));
    if (!cashier) return c.json({ error: "Cashier not found" }, 401);
    await options.momoPayment.start(saved.reference, {
      orgId: p.orgId,
      reference: saved.reference,
      phone: data.phone,
      email: cashier.email,
    });
    return c.json(saved, 201);
  });
  app.get("/payments/momo", async (c) => {
    if (!options.database) return c.json({ error: "Payments unavailable" }, 503);
    const p = c.get("principal");
    const rows = await options.database
      .select({ payment })
      .from(payment)
      .leftJoin(
        saleTender,
        and(eq(saleTender.orgId, payment.orgId), eq(saleTender.paymentId, payment.id)),
      )
      .where(
        and(
          eq(payment.orgId, p.orgId),
          // The payment middleware requires a device-scoped cashier.
          eq(payment.deviceId, p.deviceId!),
          eq(payment.cashierId, p.userId),
          inArray(payment.status, ["pending", "otp", "confirmed"]),
          isNull(saleTender.id),
        ),
      );
    return c.json({ payments: rows.map((row) => paymentView(row.payment)) });
  });
  app.on(
    ["GET", "POST"],
    ["/payments/momo/:reference", "/payments/momo/:reference/otp"],
    async (c) => {
      if (!options.database || !options.momoPayment)
        return c.json({ error: "Payments unavailable" }, 503);
      const p = c.get("principal");
      const [row] = await options.database
        .select()
        .from(payment)
        .where(
          and(
            eq(payment.orgId, p.orgId),
            // Both registered paths contain :reference; middleware requires deviceId.
            eq(payment.reference, c.req.param("reference")!),
            eq(payment.deviceId, p.deviceId!),
            eq(payment.cashierId, p.userId),
          ),
        );
      if (!row) return c.json({ error: "Payment not found" }, 404);
      if (c.req.method === "POST") {
        if (row.status !== "otp") return c.json({ error: "Payment is not awaiting OTP" }, 409);
        const data = v.parse(momoOtp, await c.req.json());
        await options.momoPayment.send(row.reference, "payment", { type: "otp", otp: data.otp });
      }
      return c.json(paymentView(row));
    },
  );
  return app;
}
