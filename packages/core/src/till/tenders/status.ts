import * as v from "valibot";
import { and, eq } from "drizzle-orm";
import { defineCommand, type CommandContext } from "@shopper/audit/sqlite";
import { paymentIntent, type TillDatabase } from "@shopper/db-sqlite";
import { paymentUpdateInput } from "../../schemas/till/payments";
import { assertDraftScope } from "../drafts/edit";
import { TillError } from "../error";

export function storePaymentUpdate(db: TillDatabase, context: CommandContext, raw: unknown) {
  const input = v.parse(paymentUpdateInput, raw);
  assertDraftScope(context, input.scope);
  return store(db, context, input);
}
const store = defineCommand({
  name: "till.payment.updated",
  async run(tx, context, input: v.InferOutput<typeof paymentUpdateInput>) {
    const [known] = await tx
      .select()
      .from(paymentIntent)
      .where(
        and(eq(paymentIntent.orgId, context.orgId), eq(paymentIntent.reference, input.reference)),
      );
    if (
      known &&
      (known.deviceId !== input.scope.deviceId ||
        known.cashierId !== input.scope.cashierId ||
        known.amount !== input.amount ||
        known.network !== input.network)
    )
      throw new TillError("PAYMENT_INVALID", "Payment identity does not match this register");
    const state = retainedPaymentState(known, input);
    const stamp = input.at.toISOString();
    await tx
      .insert(paymentIntent)
      .values({
        id: input.reference,
        ...input.scope,
        reference: input.reference,
        amount: input.amount,
        phone: input.phone,
        network: input.network,
        ...state,
        createdAt: stamp,
        updatedAt: stamp,
      })
      .onConflictDoUpdate({
        target: [paymentIntent.orgId, paymentIntent.reference],
        set: {
          ...state,
          updatedAt: stamp,
        },
      });
    return { ...input, ...state };
  },
  audit: (input) => ({ reference: input.reference, status: input.status }),
});

export function retainedPaymentState(
  known: { status: string; failureReason?: string | null } | undefined,
  input: Pick<v.InferOutput<typeof paymentUpdateInput>, "status" | "failureReason">,
) {
  const status =
    known?.status === "confirmed"
      ? "confirmed"
      : input.status !== "confirmed" && (known?.status === "failed" || known?.status === "expired")
        ? known.status
        : input.status;
  return {
    status,
    failureReason:
      status === "confirmed"
        ? null
        : status !== input.status
          ? (known?.failureReason ?? null)
          : input.failureReason,
  };
}
