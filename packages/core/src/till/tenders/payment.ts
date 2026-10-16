import * as v from "valibot";
import { and, eq } from "drizzle-orm";
import { v7 } from "uuid";
import { defineCommand, type CommandContext } from "@shopper/audit/sqlite";
import { paymentIntent, saleDraftTender, type TillDatabase } from "@shopper/db-sqlite";
import { draftPaymentInput } from "../../schemas/till/payments";
import { assertDraftScope, claimDraft } from "../drafts/edit";
import { toView } from "../drafts/queries";
import { paymentSale } from "./consumption";
import { retainedPaymentState } from "./status";
import { TillError } from "../error";

export function applyDraftPayment(db: TillDatabase, context: CommandContext, raw: unknown) {
  const input = v.parse(draftPaymentInput, raw);
  assertDraftScope(context, input.scope);
  return applyPayment(db, context, input);
}
const applyPayment = defineCommand({
  name: "till.draft.payment",
  async run(tx, context, input: v.InferOutput<typeof draftPaymentInput>) {
    const found = await claimDraft(tx, input.scope, input.expectedRevision, input.at);
    if (await paymentSale(tx, context.orgId, input.reference))
      throw new TillError("PAYMENT_INVALID", "Payment already completed a sale");
    const [intent] = await tx
      .select()
      .from(paymentIntent)
      .where(
        and(eq(paymentIntent.orgId, context.orgId), eq(paymentIntent.reference, input.reference)),
      );
    if (
      intent &&
      (intent.deviceId !== input.scope.deviceId ||
        intent.cashierId !== input.scope.cashierId ||
        intent.amount !== input.amount ||
        intent.network !== input.network ||
        (input.phoneFingerprint !== undefined &&
          intent.phoneFingerprint !== input.phoneFingerprint))
    )
      throw new TillError(
        "PAYMENT_INVALID",
        "Payment identity does not match this cashier and amount",
      );
    const [existing] = await tx
      .select()
      .from(saleDraftTender)
      .where(
        and(
          eq(saleDraftTender.orgId, context.orgId),
          eq(saleDraftTender.reference, input.reference),
        ),
      );
    if (existing && existing.draftId !== found.draft.id)
      throw new TillError("DRAFT_BUSY", "Payment belongs to another basket");
    const state = retainedPaymentState(existing, retainedPaymentState(intent, input));
    const stamp = input.at.toISOString();
    await tx
      .insert(paymentIntent)
      .values({
        id: input.reference,
        ...input.scope,
        reference: input.reference,
        amount: input.amount,
        phone: input.phone,
        phoneFingerprint: input.phoneFingerprint ?? null,
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
    const values = { status: state.status, phone: input.phone, network: input.network };
    if (existing) {
      if (existing.amount !== input.amount)
        throw new TillError("PAYMENT_INVALID", "Payment amount changed");
      await tx.update(saleDraftTender).set(values).where(eq(saleDraftTender.id, existing.id));
    } else {
      const tenders = await tx
        .select()
        .from(saleDraftTender)
        .where(eq(saleDraftTender.draftId, found.draft.id));
      await tx.insert(saleDraftTender).values({
        id: v7(),
        orgId: context.orgId,
        draftId: found.draft.id,
        position: Math.max(-1, ...tenders.map((t) => t.position)) + 1,
        kind: "momo",
        amount: input.amount,
        reference: input.reference,
        ...values,
        createdAt: stamp,
      });
    }
    return toView(tx, input.scope, input.at, found);
  },
  audit: (input) => ({ reference: input.reference, status: input.status, amount: input.amount }),
});
