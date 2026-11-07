import * as v from "valibot";
import { and, eq } from "drizzle-orm";
import { onlineOrder, orderPayment, type ShopperDatabase } from "@shopper/db-pg";
import { WorkflowTimeoutError, type Workflow } from "@shopper/ports";
import { payoutSubaccount } from "../../kyb/records";
import { applyOrderPaymentEvent, expireOrderPayment } from "../../orders/payments/apply";
import { awaitOrderPaymentCode } from "../../orders/payments/code";
import { momoEvent } from "../../payments/schemas/momo";
import type { OrderPaymentApplied, OrderPaymentDeps } from "../../orders/types";
import { orderPaymentParams } from "../../schemas/orders/pay";

const policy = { maxAttempts: 3, delayMs: 1000, backoff: "constant" } as const;
const closed = ["confirmed", "failed", "expired"];

/**
 * One attempt to pay an online order (instance id = the payment id): a MoMo prompt is sent, then the workflow waits
 * for the provider's webhook until the order's hold runs out and asks the provider once if none came. Card attempts
 * skip the prompt: the shopper pays on Paystack's page and the webhook arrives the same way. A network that asks for a
 * one-time code leaves the attempt waiting for it (the order page sends it as a `payment` event). Every outcome is applied
 * through the same command the webhooks use, so whichever comes first wins and the other changes nothing.
 */
export async function runOrderPayment(
  flow: Pick<Workflow, "instanceId" | "step" | "waitFor">,
  deps: OrderPaymentDeps,
  raw: unknown,
) {
  const params = v.parse(orderPaymentParams, raw);
  if (params.id !== flow.instanceId) throw new Error("Order payment business key mismatch");
  const context = {
    orgId: params.orgId,
    appVersion: deps.appVersion,
    queue: deps.notifications?.(),
  };
  const row = await read(deps, params);
  if (closed.includes(row.payment.status)) return;
  const apply = (
    name: string,
    status: "confirmed" | "failed",
    extra: { providerReference?: string; message?: string },
  ) =>
    flow.step(name, policy, () =>
      deps.withDatabase((db) =>
        applyOrderPaymentEvent(db, context, {
          provider: row.payment.provider,
          key: `${name}:${params.id}`,
          kind: name,
          reference: params.id,
          status,
          ...extra,
        }),
      ),
    );
  const wake = (applied: OrderPaymentApplied) =>
    flow.step("wake", policy, async () => {
      if (!applied.duplicate && applied.outcome === "settled")
        await deps.orders.send(applied.orderId, "payment.settled", { reference: params.id });
      return { woke: !applied.duplicate && applied.outcome === "settled" };
    });
  const awaitCode = (name: string, status: "otp" | "pending", reason?: string) =>
    flow.step(name, policy, () =>
      deps.withDatabase((db) =>
        awaitOrderPaymentCode(db, context, { id: params.id, status, reason }),
      ),
    );

  const charged =
    row.payment.method === "momo"
      ? await flow.step("charge", { ...policy, maxAttempts: 1 }, async () => {
          const provider = row.payment.provider === "hubtel" ? deps.hubtel : deps.paystack;
          if (!provider)
            return {
              status: "failed" as const,
              message: "Hubtel is not set up for this shop. Pay another way.",
            };
          const subaccount =
            row.payment.provider === "hubtel"
              ? undefined
              : await deps.withDatabase((db) => payoutSubaccount(db, params.orgId));
          // An outage or dropped connection leaves the request's fate unknown. The attempt fails so the shopper can try
          // again at once; a prompt that did reach the payer is still honoured when its webhook arrives.
          const result = await provider
            .charge({
              reference: params.id,
              amount: row.payment.amount,
              phone: row.payment.phone,
              network: row.payment.network!,
              email: row.email ?? `${row.payment.phone}@pay.shopper.invalid`,
              subaccount,
            })
            .catch(() => ({
              status: "failed" as const,
              message: "We could not reach the payment provider. Try again in a moment.",
            }));
          return result;
        })
      : undefined;
  if (charged?.status === "failed" || charged?.status === "confirmed") {
    await wake(
      await apply("charged", charged.status, {
        providerReference: charged.providerReference,
        message: "message" in charged ? charged.message : undefined,
      }),
    );
    return;
  }
  // Some networks ask the payer for a one-time code first: the order page takes it and sends it here.
  let awaitingCode = charged?.status === "otp";
  if (awaitingCode) await awaitCode("code", "otp");
  const { until } = await flow.step("deadline", policy, async () => ({
    until: Date.now() + (deps.timeoutMs ?? remaining(row.holdExpiresAt)),
  }));
  try {
    for (let index = 0; ; index++) {
      const event = v.parse(
        momoEvent,
        await flow.waitFor(`event-${index}`, "payment", Math.max(0, until - Date.now())),
      );
      // A webhook already applied the outcome, in its own transaction; this run only ends.
      if (event.type === "settled") return;
      if (!awaitingCode) continue;
      const result = await flow.step(`otp-${index}`, { ...policy, maxAttempts: 1 }, () =>
        deps.paystack.submitOtp({ reference: params.id, otp: event.otp }).catch(() => ({
          status: "otp" as const,
          message: "We could not check the code. Try again in a moment.",
        })),
      );
      if (result.status === "confirmed" || result.status === "failed") {
        await wake(
          await apply(`coded-${index}`, result.status, {
            providerReference: result.providerReference,
            message: "message" in result ? result.message : undefined,
          }),
        );
        return;
      }
      // A code taken but the prompt still on the phone: the attempt waits on the payer again and takes no more codes.
      awaitingCode = result.status === "otp";
      await awaitCode(
        `code-${index}`,
        result.status,
        "message" in result ? result.message : undefined,
      );
    }
  } catch (error) {
    if (!(error instanceof WorkflowTimeoutError)) throw error;
    const verified = await flow.step("verify", { ...policy, maxAttempts: 1 }, async () => {
      const provider =
        row.payment.provider === "hubtel" ? (deps.hubtel ?? deps.paystack) : deps.paystack;
      // A card page nobody finished is unknown to Paystack: that is "nothing happened", not a failure. A payment that
      // lands after the attempt lapses is still applied by its webhook (and refunded when the order is gone).
      const result = await provider.verify(params.id).catch(() => ({ status: "pending" as const }));
      // Hubtel reports what it collected; money short of the order never keeps it.
      if ("amount" in result && result.amount !== undefined && result.amount !== row.payment.amount)
        return {
          status: "failed" as const,
          message: "Hubtel collected a different amount. Check the Hubtel dashboard.",
        };
      return result;
    });
    if (verified.status === "confirmed" || verified.status === "failed")
      await wake(
        await apply("verified", verified.status, {
          providerReference:
            "providerReference" in verified ? verified.providerReference : undefined,
          message: "message" in verified ? verified.message : undefined,
        }),
      );
    else
      await flow.step("expired", policy, () =>
        deps.withDatabase((db) => expireOrderPayment(db, context, { id: params.id })),
      );
  }
}

const remaining = (until: Date) => Math.max(0, until.getTime() - Date.now());

async function read(deps: OrderPaymentDeps, params: { orgId: string; id: string }) {
  return deps.withDatabase(async (db) => {
    const [found] = await db
      .select({
        payment: orderPayment,
        email: onlineOrder.email,
        holdExpiresAt: onlineOrder.holdExpiresAt,
      })
      .from(orderPayment)
      .innerJoin(
        onlineOrder,
        and(eq(onlineOrder.orgId, orderPayment.orgId), eq(onlineOrder.id, orderPayment.orderId)),
      )
      .where(and(eq(orderPayment.orgId, params.orgId), eq(orderPayment.id, params.id)));
    if (!found) throw new Error("Order payment not found");
    return found;
  });
}
