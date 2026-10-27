import * as v from "valibot";
import { and, eq } from "drizzle-orm";
import { payment, paymentRefund } from "@shopper/db-pg";
import { WorkflowTimeoutError, type Workflow } from "@shopper/ports";
import { PaystackError } from "../../payments/paystack/client";
import { refundCheckpoint, updatePaymentRefund } from "../../payments/refunds/commands";
import { refundParams } from "../../payments/schemas/refunds";
import type { MomoDeps } from "../../payments/types";

const policy = { maxAttempts: 3, delayMs: 1000, backoff: "constant" } as const;
const DAY_MS = 86_400_000;
const INTERRUPTED =
  "The refund request did not complete. Check the Paystack dashboard before refunding again.";
const UNCONFIRMED =
  "Paystack has not confirmed this refund. Check the Paystack dashboard before refunding again.";

/**
 * Sends a MoMo refund back through Paystack (instance id = the payment refund's id): refund → wait for the
 * `refund.*` webhook → on timeout, verify once. The webhook records the outcome itself; the wait only ends early.
 */
export async function runMomoRefund(
  flow: Pick<Workflow, "instanceId" | "step" | "waitFor">,
  deps: Omit<MomoDeps, "realtime">,
  raw: unknown,
) {
  const params = v.parse(refundParams, raw);
  if (params.id !== flow.instanceId) throw new Error("Refund business key mismatch");
  const context = { orgId: params.orgId, appVersion: deps.appVersion };
  const read = () =>
    deps.withDatabase(async (db) => {
      const [row] = await db
        .select({ refund: paymentRefund, reference: payment.reference })
        .from(paymentRefund)
        .innerJoin(
          payment,
          and(eq(payment.orgId, paymentRefund.orgId), eq(payment.id, paymentRefund.paymentId)),
        )
        .where(and(eq(paymentRefund.orgId, params.orgId), eq(paymentRefund.id, params.id)));
      if (!row) throw new Error("Payment refund not found");
      return row;
    });
  const record = (
    step: string,
    change: Omit<Parameters<typeof updatePaymentRefund>[2], "id">,
    status: "waiting" | "completed" | "failed" = change.status === "pending"
      ? "waiting"
      : "completed",
  ) =>
    deps.withDatabase((db) =>
      updatePaymentRefund(
        db,
        context,
        { id: params.id, ...change },
        refundCheckpoint(params.id, step, status),
      ),
    );
  // One attempt: a retried request that Paystack already received would refund the money twice.
  const sent = await flow.step("refund", { ...policy, maxAttempts: 1 }, async () => {
    const row = await read();
    if (row.refund.status !== "pending" || row.refund.providerReference) return row.refund;
    // A refused refund (already refunded, not settled) is final. Any other failure may or may not have reached
    // Paystack, so the refund stays reserved and the run stops failed for someone to check.
    const result = await deps.paystack
      .refund({ reference: row.reference, amount: row.refund.amount })
      .catch((error: unknown) => {
        if (error instanceof PaystackError && error.httpStatus < 500)
          return { status: "failed" as const, reason: error.message };
        console.error({ event: "refund.interrupted", instanceId: params.id, error });
        return { status: "pending" as const, reason: INTERRUPTED };
      });
    return record(
      "refund",
      result,
      "reason" in result && result.reason === INTERRUPTED ? "failed" : undefined,
    );
  });
  if (sent.status !== "pending" || sent.failureReason === INTERRUPTED) return;
  try {
    await flow.waitFor("settled", "refund", deps.timeoutMs ?? DAY_MS);
    await flow.step("settled", policy, async () => {
      const row = await read();
      return record("settled", { status: row.refund.status });
    });
  } catch (error) {
    if (!(error instanceof WorkflowTimeoutError)) throw error;
    await flow.step("verify", { ...policy, maxAttempts: 1 }, async () => {
      const row = await read();
      if (row.refund.status !== "pending" || !row.refund.providerReference) return row.refund;
      const verified = await deps.paystack.verifyRefund(row.refund.providerReference);
      // Still unconfirmed: the money stays reserved, and a late webhook can still settle it.
      return record(
        "verify",
        verified.status === "pending" ? { status: "pending", reason: UNCONFIRMED } : verified,
        "completed",
      );
    });
  }
}
