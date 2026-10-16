import * as v from "valibot";
import { and, eq, inArray } from "drizzle-orm";
import { paymentIntent, type TillDatabase } from "@shopper/db-sqlite";
import { momoView } from "@shopper/core/payments";
import { TillError } from "@shopper/core/till";
import { momoList } from "../../../schemas/till/host/payments";
import type { HostConfiguration } from "../config";
import { paymentHeaders } from "./headers";

export async function recoverHostPayments(
  database: TillDatabase,
  config: HostConfiguration,
  receive: (payment: v.InferOutput<typeof momoView>, allowUnknown?: boolean) => Promise<void>,
) {
  const session = config.session;
  if (!session) return;
  const response = await fetch(new URL("/payments/momo?status=unresolved", config.upstream), {
    headers: paymentHeaders(config),
    signal: AbortSignal.timeout(15_000),
  });
  // Payment availability and cashier expiry must not disconnect device-authenticated catalogue sync.
  if ([401, 403, 404, 503].includes(response.status)) return;
  if (!response.ok) throw new TillError("PAYMENT_UNAVAILABLE", "Payment recovery is unavailable");
  const result = v.parse(momoList, await response.json());
  for (const payment of result.payments) await receive(payment, true);
  const reported = new Set(result.payments.map((payment) => payment.reference));
  const pending = await database.read((tx) =>
    tx
      .select()
      .from(paymentIntent)
      .where(
        and(
          eq(paymentIntent.orgId, config.identity.orgId),
          eq(paymentIntent.deviceId, config.identity.deviceId),
          eq(paymentIntent.cashierId, session.userId),
          inArray(paymentIntent.status, ["pending", "otp"]),
        ),
      ),
  );
  for (const intent of pending) {
    if (reported.has(intent.reference)) continue;
    const terminal = await fetch(new URL(`/payments/momo/${intent.reference}`, config.upstream), {
      headers: paymentHeaders(config),
      signal: AbortSignal.timeout(15_000),
    });
    if (terminal.status === 404) continue;
    if (!terminal.ok) throw new TillError("PAYMENT_UNAVAILABLE", "Payment recovery is unavailable");
    await receive(v.parse(momoView, await terminal.json()));
  }
}
