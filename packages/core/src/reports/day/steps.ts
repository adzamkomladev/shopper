import { and, eq, sql } from "drizzle-orm";
import { v7 } from "uuid";
import { defineCommand, enqueueAfterCommit } from "@shopper/audit";
import { store, storeDay } from "@shopper/db-pg";
import type { Json } from "@shopper/ports";
import { orgOwners } from "../../audit/anchor";
import { dayStart } from "../days";

/** The store-day workflow's business key: one per store and Accra day. */
export const storeDayId = (orgId: string, storeId: string, day: string) =>
  `store-day_${orgId}_${storeId}_${day}`;

const details = (input: { storeId: string }) => ({ entity: "store", entityId: input.storeId });
const at = (day: string, time: string) => new Date(`${day}T${time}.000Z`).toISOString();

/**
 * Opens the day's record and fixes its hours from the store's (an edit later in the day applies tomorrow). Null when
 * the store no longer exists, which ends the chain.
 */
export const openStoreDay = defineCommand({
  name: "store-day.open",
  async run(tx, ctx, input: { storeId: string; day: string }) {
    const [hours] = await tx
      .select({ opensAt: store.opensAt, closesAt: store.closesAt })
      .from(store)
      .where(and(eq(store.orgId, ctx.orgId), eq(store.id, input.storeId)));
    if (!hours) return null;
    await tx
      .insert(storeDay)
      .values({ orgId: ctx.orgId, storeId: input.storeId, day: input.day })
      .onConflictDoNothing();
    return { opensAt: at(input.day, hours.opensAt), closesAt: at(input.day, hours.closesAt) };
  },
  audit: (input, output) => ({ ...input, hours: output }),
  details,
});

/** The store opened: the day's record says so from now. */
export const markStoreDayOpen = defineCommand({
  name: "store-day.opened",
  async run(tx, ctx, input: { storeId: string; day: string }) {
    await tx
      .update(storeDay)
      .set({ status: "open", openedAt: new Date(), updatedAt: new Date() })
      .where(dayOf(ctx.orgId, input));
    return { opened: true };
  },
  audit: (input) => input,
  details,
});

/**
 * At closing, the registers that took a sale today after their last uploaded Z (the server only learns of a shift
 * when its Z arrives, so these are the ones still open). Each owner is emailed their names when there are any.
 */
export const remindStoreDay = defineCommand({
  name: "store-day.reminder",
  async run(tx, ctx, input: { storeId: string; day: string }) {
    const { rows } = await tx.execute<{ name: string }>(sql`
      SELECT coalesce(d.name, s.device_id::text) AS name
      FROM sale s LEFT JOIN device d ON d.org_id = s.org_id AND d.id = s.device_id
      WHERE s.org_id = ${ctx.orgId} AND s.store_id = ${input.storeId}
        AND s.occurred_at >= ${dayStart(input.day)} AND s.occurred_at < ${dayStart(sql`(${input.day}::date + 1)`)}
      GROUP BY s.org_id, s.device_id, d.name
      HAVING max(s.occurred_at) > coalesce(
        (SELECT max(z.closed_at) FROM shift z WHERE z.org_id = s.org_id AND z.device_id = s.device_id), '-infinity')
      ORDER BY 1`);
    const registers = rows.map((row) => row.name);
    if (registers.length)
      for (const owner of await orgOwners(tx, ctx.orgId))
        enqueueAfterCommit(tx, {
          id: v7(),
          orgId: ctx.orgId,
          v: 1,
          sequence: "0",
          type: "store-day.reminder",
          payload: { ...input, userId: owner.id, registers },
        });
    return { registers };
  },
  audit: (input, output) => ({ ...input, ...output }),
  details,
});

/** Keeps the day's figures on its record and queues one summary email per owner, read from that record. */
export const summarizeStoreDay = defineCommand({
  name: "store-day.summary",
  async run(tx, ctx, input: { storeId: string; day: string; summary: Json }) {
    await tx
      .update(storeDay)
      .set({ summary: input.summary, updatedAt: new Date() })
      .where(dayOf(ctx.orgId, input));
    const owners = await orgOwners(tx, ctx.orgId);
    for (const owner of owners)
      enqueueAfterCommit(tx, {
        id: v7(),
        orgId: ctx.orgId,
        v: 1,
        sequence: "0",
        type: "store-day.summary",
        payload: { storeId: input.storeId, day: input.day, userId: owner.id },
      });
    return { owners: owners.length };
  },
  audit: (input, output) => ({ storeId: input.storeId, day: input.day, ...output }),
  details,
});

/** The day is over and rolled up: its record is closed and its summary stays as sent. */
export const closeStoreDay = defineCommand({
  name: "store-day.close",
  async run(tx, ctx, input: { storeId: string; day: string }) {
    await tx
      .update(storeDay)
      .set({ status: "closed", closedAt: new Date(), updatedAt: new Date() })
      .where(dayOf(ctx.orgId, input));
    return { closed: true };
  },
  audit: (input) => input,
  details,
});

const dayOf = (orgId: string, input: { storeId: string; day: string }) =>
  and(eq(storeDay.orgId, orgId), eq(storeDay.storeId, input.storeId), eq(storeDay.day, input.day));
