import { and, eq } from "drizzle-orm";
import * as v from "valibot";
import { defineCommand } from "@shopper/audit";
import { creditEntry, customer, type ShopperTransaction } from "@shopper/db-pg";
import { money, sub } from "@shopper/money";
import { creditNoteInput, limitInput, paymentInput } from "../../schemas/customers/credit";
import { CustomerError } from "../error";
import { readCustomerRow } from "../queries";
import { mergeWinner } from "../sale";
import { authorize } from "./authority";
import type { Authority } from "../types";

type Target = { id: string; body: unknown };
/** A payment taken at a drawer: who took it, when, into which shift, and the MoMo reference. */
type Till = Authority & { occurredAt: Date; shiftId: string; reference: string | null };
type Paid = {
  id: string;
  entryId: string;
  replayed: boolean;
  shiftId?: string;
  reference?: string | null;
};

/**
 * Money paid onto the account (see `payee`); more than is owed becomes a deposit. A retry under the same id replays. From a till
 * (`till`) it needs a live `sale.create` session, and the entry keeps the till's shift id (no foreign key: the
 * shift's Z arrives when it closes, long after the money was taken).
 */
export const recordPayment = defineCommand({
  name: "customer.payment",
  async replay(tx, ctx, input: Target & { till?: Till }) {
    const payment = v.parse(paymentInput, input.body);
    const [saved] = await tx
      .select()
      .from(creditEntry)
      .where(and(eq(creditEntry.orgId, ctx.orgId), eq(creditEntry.id, payment.id)));
    if (!saved) return undefined;
    const payer = await payee(tx, ctx.orgId, input.id);
    if (
      saved.kind !== "payment" ||
      saved.customerId !== payer.id ||
      saved.amount !== sub(money(0), payment.amount) ||
      saved.method !== payment.method
    )
      throw new CustomerError("CONFLICT", "Payment identity already has different content");
    if (input.till) await authorize(tx, ctx, input.till, input.till.occurredAt);
    return { output: { id: saved.customerId, entryId: saved.id, replayed: true } };
  },
  async run(tx, ctx, input): Promise<Paid> {
    const payment = v.parse(paymentInput, input.body);
    const { till } = input;
    if (till) await authorize(tx, ctx, till, till.occurredAt);
    const current = await payee(tx, ctx.orgId, input.id);
    await tx.insert(creditEntry).values({
      id: payment.id,
      orgId: ctx.orgId,
      customerId: current.id,
      kind: "payment",
      amount: sub(money(0), payment.amount),
      method: payment.method,
      shiftId: till?.shiftId,
      actorId: ctx.actorId,
      occurredAt: till?.occurredAt ?? new Date(),
    });
    return {
      id: current.id,
      entryId: payment.id,
      replayed: false,
      ...(till && { shiftId: till.shiftId, reference: till.reference }),
    };
  },
  audit: (input, output) => ({ ...output, ...v.parse(paymentInput, input.body) }),
  details: (_input, output) => ({ entity: "customer", entityId: output.id }),
});

/**
 * Whose account a payment lowers, locked: a customer merged away resolves to the winner, and an archived one is still
 * paid (it only lowers the balance). Only an id this org does not have is refused.
 */
async function payee(tx: ShopperTransaction, orgId: string, id: string) {
  const found = await readCustomerRow(tx, orgId, id, true);
  if (!found.mergedIntoId) return found;
  return readCustomerRow(tx, orgId, (await mergeWinner(tx, orgId, found)).id, true);
}

/** The credit limit; above zero only for a KYC-verified customer. */
export const setCreditLimit = defineCommand({
  name: "customer.limit.set",
  async run(tx, ctx, input: Target) {
    const { creditLimit } = v.parse(limitInput, input.body);
    const current = await readCustomerRow(tx, ctx.orgId, input.id, true);
    const [verified] = await tx
      .select({ at: customer.kycVerifiedAt })
      .from(customer)
      .where(and(eq(customer.orgId, ctx.orgId), eq(customer.id, current.id)));
    if (creditLimit > 0 && !verified?.at)
      throw new CustomerError("NOT_VERIFIED", "A credit limit needs a KYC-verified customer");
    await tx
      .update(customer)
      .set({ creditLimit, updatedAt: new Date() })
      .where(and(eq(customer.orgId, ctx.orgId), eq(customer.id, current.id)));
    return { id: current.id, before: current.creditLimit, after: creditLimit };
  },
  audit: (_input, output) => ({ ...output }),
  details: (_input, output) => ({
    entity: "customer",
    entityId: output.id,
    before: { creditLimit: output.before },
    after: { creditLimit: output.after },
  }),
});

/** Lowers what the customer owes, with the reason and who wrote it. */
export const addCreditNote = defineCommand({
  name: "customer.credit_note",
  async run(tx, ctx, input: Target) {
    const note = v.parse(creditNoteInput, input.body);
    const current = await readCustomerRow(tx, ctx.orgId, input.id, true);
    const [row] = await tx
      .insert(creditEntry)
      .values({
        orgId: ctx.orgId,
        customerId: current.id,
        kind: "credit_note",
        amount: sub(money(0), note.amount),
        reason: note.reason,
        actorId: ctx.actorId,
        occurredAt: new Date(),
      })
      .returning({ id: creditEntry.id });
    return { id: current.id, entryId: row!.id, ...note };
  },
  audit: (_input, output) => ({ ...output }),
  details: (_input, output) => ({ entity: "customer", entityId: output.id }),
});
