import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import * as v from "valibot";
import { customerLookup, customerUpload, type TillSqlite } from "@shopper/db-sqlite";
import { customerEvent } from "../../schemas/customers/events";
import type { ProjectedCustomer } from "./types";

/** Uploads that have not reached the server and have not been refused: what the lookup must still show. */
export const awaitingUpload = (orgId: string) =>
  and(
    eq(customerUpload.orgId, orgId),
    isNull(customerUpload.acceptedAt),
    isNull(customerUpload.blockedCode),
  );

/**
 * Lays the server's customers over the lookup: live ones replace their row, archived and merged ones leave it. Then
 * the edits still waiting to upload go back on top, so a pull never undoes a change the cashier made offline.
 */
export async function projectCustomers(tx: TillSqlite, orgId: string, rows: ProjectedCustomer[]) {
  const leaving = rows.filter((row) => row.archivedAt || row.mergedIntoId).map((row) => row.id);
  if (leaving.length) await removeCustomers(tx, orgId, leaving);
  for (const row of rows) {
    if (row.archivedAt || row.mergedIntoId) continue;
    const { id, name, phone, kind, businessName, tin, version } = row;
    const values = { name, phone, kind, businessName, tin, version };
    await tx
      .insert(customerLookup)
      .values({ orgId, customerId: id, ...values })
      .onConflictDoUpdate({
        target: [customerLookup.orgId, customerLookup.customerId],
        set: values,
        // A late answer must not roll back a newer row already pulled.
        setWhere: sql`excluded.version >= ${customerLookup.version}`,
      });
  }
  await replayPendingCustomers(
    tx,
    orgId,
    rows.map((row) => row.id),
  );
}

export function removeCustomers(tx: TillSqlite, orgId: string, ids: string[]) {
  return tx
    .delete(customerLookup)
    .where(and(eq(customerLookup.orgId, orgId), inArray(customerLookup.customerId, ids)));
}

/**
 * Applies the queued events in the order they were made: a create brings its customer back when a snapshot rebuilt the
 * lookup without it, an edit changes the row if there is one. `ids` limits it to those customers.
 */
export async function replayPendingCustomers(tx: TillSqlite, orgId: string, ids?: string[]) {
  const pending = await tx
    .select({ payload: customerUpload.payload })
    .from(customerUpload)
    .where(and(awaitingUpload(orgId), ids ? inArray(customerUpload.customerId, ids) : undefined))
    .orderBy(asc(sql`rowid`));
  for (const { payload } of pending) {
    const event = v.parse(customerEvent, payload);
    if (event.type === "customer.created") {
      const { id, name, phone, kind, businessName, tin } = event.customer;
      await tx
        .insert(customerLookup)
        .values({ orgId, customerId: id, name, phone, kind, businessName, tin, version: 1 })
        .onConflictDoNothing();
    } else
      await tx
        .update(customerLookup)
        .set(event.customer.changes)
        .where(
          and(eq(customerLookup.orgId, orgId), eq(customerLookup.customerId, event.customer.id)),
        );
  }
}
