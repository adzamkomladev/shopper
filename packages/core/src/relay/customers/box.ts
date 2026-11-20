import { and, asc, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import * as v from "valibot";
import { defineCommand, type CommandContext } from "@shopper/audit";
import { customer, relayPublished, type ShopperDatabase } from "@shopper/db-pg";
import { sha256 } from "@shopper/utils";
import { BATCH_ROWS, CUSTOMER_BATCH, type RelayCustomerWire } from "../../schemas/relay";
import { receiptDocument } from "../../schemas/receipts/document";
import { readShopPoints } from "../../shop/points";
import { receiptRows } from "../../shop/purchases";
import type { RelaySend } from "../types";

type Shared = RelayCustomerWire;

/**
 * A Publisher step on the box (v1.5 Day 51): for each phone a customer agreed to share, the points and receipts the
 * box's own account pages show, sent when they changed since the relay last took them; a customer no longer shared
 * is withdrawn. Nothing of anyone else is read. Answers the relay's response when it did not take a batch.
 * shortcut: every shared phone is recomputed each run; keep a dirty flag on sales and points if shops share thousands.
 */
export async function shareCustomers(
  db: ShopperDatabase,
  context: CommandContext,
  send: RelaySend,
  now: Date,
) {
  const phones = await db
    .selectDistinctOn([customer.phone], { id: customer.id, phone: customer.phone })
    .from(customer)
    .where(
      and(
        eq(customer.orgId, context.orgId),
        isNotNull(customer.onlineSharedAt),
        isNull(customer.mergedIntoId),
        isNull(customer.archivedAt),
      ),
    )
    .orderBy(asc(customer.phone), asc(customer.id));
  const known = new Map(
    (
      await db
        .select({ id: relayPublished.entityId, hash: relayPublished.hash })
        .from(relayPublished)
        .where(and(eq(relayPublished.orgId, context.orgId), eq(relayPublished.entity, "customer")))
    ).map((row) => [row.id, row.hash]),
  );
  const changed: { row: Shared; hash: string }[] = [];
  for (const shared of phones) {
    const row = await sharedView(db, { orgId: context.orgId, ...shared }, now);
    const hash = await sha256(JSON.stringify(row));
    if (known.get(row.id) !== hash) changed.push({ row, hash });
  }
  const listed = new Set(phones.map((row) => row.id));
  const withdrawn = [...known.keys()].filter((id) => !listed.has(id));
  const batches = Array.from({ length: Math.ceil(changed.length / CUSTOMER_BATCH) }, (_, index) =>
    changed.slice(index * CUSTOMER_BATCH, (index + 1) * CUSTOMER_BATCH),
  );
  if (withdrawn.length && !batches.length) batches.push([]);
  for (const [index, batch] of batches.entries()) {
    // Withdrawals ride the first batch, within what the relay takes; any more go next run.
    const gone = index === 0 ? withdrawn.slice(0, BATCH_ROWS) : [];
    const response = await send("/relay/customers", {
      method: "POST",
      body: JSON.stringify({ customers: batch.map((entry) => entry.row), withdrawn: gone }),
    });
    if (!response.ok) return response;
    await sharedCustomers(db, context, {
      rows: batch.map((entry) => ({ id: entry.row.id, hash: entry.hash })),
      withdrawn: gone,
      now,
    });
  }
  return undefined;
}

/** What the box's account pages show the phone, keyed by its shared customer row. */
async function sharedView(
  db: ShopperDatabase,
  shared: { orgId: string; id: string; phone: string },
  now: Date,
): Promise<Shared> {
  const points = await readShopPoints(db, shared, now);
  const receipts = await receiptRows(db, shared);
  return {
    id: shared.id,
    phone: shared.phone,
    points,
    receipts: receipts.map((row) => ({
      id: row.id,
      receiptNumber: row.receiptNumber,
      occurredAt: row.occurredAt.toISOString(),
      total: row.total,
      status: row.status,
      branchName: row.branchName,
      receipt: row.receipt ? v.parse(receiptDocument, row.receipt) : null,
    })),
  };
}

/** The relay took these customers' copies (and dropped the withdrawn ones). */
const sharedCustomers = defineCommand({
  name: "relay.customers.shared",
  async run(
    tx,
    ctx,
    input: { rows: { id: string; hash: string }[]; withdrawn: string[]; now: Date },
  ) {
    if (input.rows.length)
      await tx
        .insert(relayPublished)
        .values(
          input.rows.map((row) => ({
            orgId: ctx.orgId,
            entity: "customer" as const,
            entityId: row.id,
            hash: row.hash,
            publishedAt: input.now,
          })),
        )
        .onConflictDoUpdate({
          target: [relayPublished.orgId, relayPublished.entity, relayPublished.entityId],
          set: { hash: sql`excluded.hash`, publishedAt: sql`excluded.published_at` },
        });
    if (input.withdrawn.length)
      await tx
        .delete(relayPublished)
        .where(
          and(
            eq(relayPublished.orgId, ctx.orgId),
            eq(relayPublished.entity, "customer"),
            inArray(relayPublished.entityId, input.withdrawn),
          ),
        );
    return { shared: input.rows.map((row) => row.id), withdrawn: input.withdrawn };
  },
  audit: (_input, output) => output,
});
