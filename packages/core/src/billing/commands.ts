import { and, eq, isNull, lte, ne, sql } from "drizzle-orm";
import { v7 } from "uuid";
import { defineCommand, enqueueAfterCommit, type CommandContext } from "@shopper/audit";
import {
  branch,
  device,
  deviceCredential,
  invoice,
  paymentEvent,
  store,
  subscription,
  type ShopperTransaction,
} from "@shopper/db-pg";
import { orgOwners } from "../audit/anchor";
import { READ_ONLY_AFTER_DAYS } from "./access";
import { invoiceAmount } from "./price";

type Invoice = typeof invoice.$inferSelect;

/**
 * Raises the period's invoice for the org's stores and live registers, priced by `invoiceAmount`, and moves the
 * subscription's next invoice to where this period ends. A period already raised answers its invoice.
 */
export const issueInvoice = defineCommand({
  name: "billing.invoice.issued",
  async run(tx, context: CommandContext, input: { periodStart: string }) {
    const [raised] = await tx
      .select()
      .from(invoice)
      .where(and(eq(invoice.orgId, context.orgId), eq(invoice.periodStart, input.periodStart)));
    if (raised) return invoiceView(raised);
    // A register counts while it holds an unrevoked credential, enrolled and able to sell.
    const counts = await tx
      .select({ registers: sql<number>`count(${deviceCredential.id})::int` })
      .from(store)
      .leftJoin(branch, and(eq(branch.orgId, store.orgId), eq(branch.storeId, store.id)))
      .leftJoin(device, and(eq(device.orgId, branch.orgId), eq(device.branchId, branch.id)))
      .leftJoin(
        deviceCredential,
        and(
          eq(deviceCredential.orgId, device.orgId),
          eq(deviceCredential.deviceId, device.id),
          isNull(deviceCredential.revokedAt),
        ),
      )
      .where(eq(store.orgId, context.orgId))
      .groupBy(store.id);
    const [periodEnd] = (
      await tx.execute<{ day: string }>(
        sql`SELECT (${input.periodStart}::date + interval '1 month')::date::text AS day`,
      )
    ).rows;
    const id = v7();
    const [row] = await tx
      .insert(invoice)
      .values({
        id,
        orgId: context.orgId,
        reference: id,
        periodStart: input.periodStart,
        periodEnd: periodEnd!.day,
        stores: counts.length,
        terminals: counts.reduce((sum, count) => sum + count.registers, 0),
        amount: invoiceAmount(counts.map((count) => count.registers)),
      })
      .returning();
    await tx
      .update(subscription)
      .set({ nextInvoiceOn: periodEnd!.day })
      .where(eq(subscription.orgId, context.orgId));
    return invoiceView(row!);
  },
  audit: (_input, output) => output,
  details: (_input, output) => ({ entity: "invoice", entityId: output.id }),
});

/** Stores the invoice's payment link and emails it to the owners. */
export const publishInvoice = defineCommand({
  name: "billing.invoice.published",
  async run(tx, context: CommandContext, input: { id: string; checkoutUrl: string | null }) {
    const [row] = await tx
      .update(invoice)
      .set({ checkoutUrl: input.checkoutUrl })
      .where(and(eq(invoice.orgId, context.orgId), eq(invoice.id, input.id)))
      .returning();
    await notifyOwners(tx, context.orgId, "invoice.issued", row!.id);
    return invoiceView(row!);
  },
  audit: (_input, output) => ({ id: output.id, checkoutUrl: output.checkoutUrl }),
  details: (_input, output) => ({ entity: "invoice", entityId: output.id }),
});

/**
 * A dunning step on an invoice still open: a reminder, or the back office turning read-only. A paid invoice
 * changes nothing.
 */
export const dunInvoice = defineCommand({
  name: "billing.invoice.dunned",
  async run(tx, context: CommandContext, input: { id: string; step: "reminder" | "read_only" }) {
    const [row] = await tx
      .select()
      .from(invoice)
      .where(and(eq(invoice.orgId, context.orgId), eq(invoice.id, input.id)))
      .for("update");
    if (row!.status !== "open") return { id: row!.id, step: null };
    if (input.step === "reminder")
      await tx
        .update(invoice)
        .set({ reminders: sql`${invoice.reminders} + 1` })
        .where(eq(invoice.id, row!.id));
    else
      await tx
        .update(subscription)
        .set({ status: "read_only" })
        .where(eq(subscription.orgId, context.orgId));
    await notifyOwners(tx, context.orgId, `invoice.${input.step}`, row!.id);
    return { id: row!.id, step: input.step };
  },
  audit: (_input, output) => output,
  details: (_input, output) => ({ entity: "invoice", entityId: output.id }),
});

/**
 * The checkout's webhook paid the invoice: paid once, and the subscription active again. A replayed webhook is
 * seen in the provider-event ledger and changes, audits and wakes nothing.
 */
export const payInvoice = defineCommand({
  name: "billing.invoice.paid",
  async replay(tx, context, input: { id: string; key: string; at: Date }) {
    const [seen] = await tx
      .select({ id: paymentEvent.id })
      .from(paymentEvent)
      .where(
        and(
          eq(paymentEvent.orgId, context.orgId),
          eq(paymentEvent.provider, "paystack"),
          eq(paymentEvent.key, input.key),
        ),
      );
    return seen ? { output: { id: input.id, paid: false } } : undefined;
  },
  async run(tx, context: CommandContext, input: { id: string; key: string; at: Date }) {
    await tx.insert(paymentEvent).values({
      orgId: context.orgId,
      provider: "paystack",
      key: input.key,
      reference: input.id,
      kind: "charge.success",
    });
    const [row] = await tx
      .update(invoice)
      .set({ status: "paid", paidAt: input.at })
      .where(
        and(eq(invoice.orgId, context.orgId), eq(invoice.id, input.id), eq(invoice.status, "open")),
      )
      .returning();
    // Another period still unpaid past its read-only day keeps the back office read-only.
    const [overdue] = await tx
      .select({ id: invoice.id })
      .from(invoice)
      .where(
        and(
          eq(invoice.orgId, context.orgId),
          eq(invoice.status, "open"),
          ne(invoice.id, input.id),
          lte(
            invoice.periodStart,
            new Date(input.at.getTime() - READ_ONLY_AFTER_DAYS * 86_400_000)
              .toISOString()
              .slice(0, 10),
          ),
        ),
      )
      .limit(1);
    await tx
      .update(subscription)
      .set({ status: overdue ? "read_only" : "active" })
      .where(eq(subscription.orgId, context.orgId));
    return { id: input.id, paid: row !== undefined };
  },
  audit: (_input, output) => output,
  details: (_input, output) => ({ entity: "invoice", entityId: output.id }),
});

/** The period's workflow saw its invoice paid and stops dunning: its run is complete. */
export const settleInvoice = defineCommand({
  name: "billing.invoice.settled",
  async run(_tx, _context: CommandContext, input: { id: string }) {
    return { id: input.id };
  },
  audit: (_input, output) => output,
  details: (_input, output) => ({ entity: "invoice", entityId: output.id }),
});

export function invoiceView(row: Invoice) {
  return {
    id: row.id,
    reference: row.reference,
    periodStart: row.periodStart,
    periodEnd: row.periodEnd,
    stores: row.stores,
    terminals: row.terminals,
    amount: row.amount,
    status: row.status,
    checkoutUrl: row.checkoutUrl,
    reminders: row.reminders,
    paidAt: row.paidAt?.toISOString() ?? null,
  };
}

async function notifyOwners(
  tx: ShopperTransaction,
  orgId: string,
  type: string,
  invoiceId: string,
) {
  for (const owner of await orgOwners(tx, orgId))
    enqueueAfterCommit(tx, {
      id: v7(),
      orgId,
      v: 1,
      sequence: "0",
      type,
      payload: { invoiceId, userId: owner.id },
    });
}
