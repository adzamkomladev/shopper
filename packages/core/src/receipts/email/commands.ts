import * as v from "valibot";
import { and, eq } from "drizzle-orm";
import { defineCommand, type CommandContext } from "@shopper/audit";
import { customer, receiptEmail, sale } from "@shopper/db-pg";
import { ManagementError } from "../../management";
import type { receiptEmailRequest } from "../schemas/email";
import { queueReceiptEmail } from "./queue";

/**
 * A back-office resend of a sale's receipt, to the given address or the customer's. The sale must be in the
 * member's branches; without an address there is nothing to send.
 */
export const resendReceiptEmail = defineCommand({
  name: "receipt.email.requested",
  async run(
    tx,
    context: CommandContext,
    input: v.InferOutput<typeof receiptEmailRequest> & { saleId: string; scope?: string[] },
  ) {
    const [found] = await tx
      .select({ id: sale.id, branchId: sale.branchId, email: customer.email })
      .from(sale)
      .leftJoin(customer, and(eq(customer.orgId, sale.orgId), eq(customer.id, sale.customerId)))
      .where(and(eq(sale.orgId, context.orgId), eq(sale.id, input.saleId)));
    if (!found || (input.scope && !input.scope.includes(found.branchId)))
      throw new ManagementError("Transaction not found", 404);
    const email = input.email ?? found.email;
    if (!email) throw new ManagementError("This customer has no email address. Enter one.", 400);
    const id = await queueReceiptEmail(tx, context.orgId, {
      saleId: found.id,
      email,
      requestKey: `resend:${input.requestKey}`,
    });
    return { saleId: found.id, email, queued: id !== undefined };
  },
  audit: (_input, output) => output,
  details: (_input, output) => ({ entity: "sale", entityId: output.saleId }),
});

/** The provider took the email; a redelivered message for this row then sends nothing. */
export const markReceiptSent = defineCommand({
  name: "receipt.email.sent",
  async run(tx, context: CommandContext, input: { id: string; reference: string | undefined }) {
    await tx
      .update(receiptEmail)
      .set({ sentAt: new Date() })
      .where(and(eq(receiptEmail.orgId, context.orgId), eq(receiptEmail.id, input.id)));
    return input;
  },
  audit: (input) => input,
  details: (input) => ({ entity: "receipt_email", entityId: input.id }),
});
