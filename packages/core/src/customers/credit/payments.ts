import { and, eq } from "drizzle-orm";
import * as v from "valibot";
import { defineCommand } from "@shopper/audit";
import { creditEntry, customer } from "@shopper/db-pg";
import { money, sub } from "@shopper/money";
import { creditNoteInput, limitInput, paymentInput } from "../../schemas/customers/credit";
import { CustomerError } from "../error";
import { readCustomerRow } from "../queries";

type Target = { id: string; body: unknown };

/** Money paid onto the account; more than is owed becomes a deposit. A retry under the same id replays. */
export const recordPayment = defineCommand({
  name: "customer.payment",
  async replay(tx, ctx, input: Target) {
    const payment = v.parse(paymentInput, input.body);
    const [saved] = await tx
      .select()
      .from(creditEntry)
      .where(and(eq(creditEntry.orgId, ctx.orgId), eq(creditEntry.id, payment.id)));
    if (!saved) return undefined;
    if (
      saved.kind !== "payment" ||
      saved.customerId !== input.id.toLowerCase() ||
      saved.amount !== sub(money(0), payment.amount) ||
      saved.method !== payment.method
    )
      throw new CustomerError("CONFLICT", "Payment identity already has different content");
    return { output: { id: saved.customerId, entryId: saved.id, replayed: true } };
  },
  async run(tx, ctx, input) {
    const payment = v.parse(paymentInput, input.body);
    const current = await readCustomerRow(tx, ctx.orgId, input.id, true);
    await tx.insert(creditEntry).values({
      id: payment.id,
      orgId: ctx.orgId,
      customerId: current.id,
      kind: "payment",
      amount: sub(money(0), payment.amount),
      method: payment.method,
      actorId: ctx.actorId,
      occurredAt: new Date(),
    });
    return { id: current.id, entryId: payment.id, replayed: false };
  },
  audit: (input, output) => ({ ...output, ...v.parse(paymentInput, input.body) }),
  details: (_input, output) => ({ entity: "customer", entityId: output.id }),
});

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
