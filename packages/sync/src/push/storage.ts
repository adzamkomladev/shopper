import { and, asc, eq, isNotNull } from "drizzle-orm";
import { v7 } from "uuid";
import { defineCommand } from "@shopper/audit/sqlite";
import { hostSession, localSale, outbox, tillState } from "@shopper/db-sqlite";
import { dueBy } from "./backoff";
import type { PushOptions } from "./types";

type Change = {
  localId: string;
  sequence?: string;
  occurredAt?: string;
  blockedReason?: string;
  attempts?: number;
  nextAttemptAt?: number;
};
export function createQueueStorage(options: PushOptions) {
  const { database, config } = options;
  const scope = and(eq(outbox.orgId, config.orgId), eq(outbox.deviceId, config.deviceId));
  const change = defineCommand<Change[], void>(
    {
      name: "till.sync.update",
      async run(tx, _context, changes) {
        for (const entry of changes) {
          const where = and(scope, eq(outbox.localId, entry.localId));
          if (entry.sequence) {
            await tx
              .update(localSale)
              .set({ storeSequence: entry.sequence, occurredAt: entry.occurredAt })
              .where(
                and(
                  eq(localSale.orgId, config.orgId),
                  eq(localSale.deviceId, config.deviceId),
                  eq(localSale.localId, entry.localId),
                ),
              );
            await tx.delete(outbox).where(where);
          } else {
            await tx
              .update(outbox)
              .set({
                attempts: entry.attempts,
                nextAttemptAt: entry.nextAttemptAt,
                blockedReason: entry.blockedReason,
              })
              .where(where);
          }
        }
      },
      audit: (changes) => ({ changes }),
    },
    options.now,
  );
  // After a restore from an older backup the server holds fewer of this register's sales than it acknowledged. It cannot
  // say which, so every acknowledged sale goes back on the queue, in its original order and unchanged (same local id,
  // receipt number and hash); the server keeps one copy of each. Their sequences are cleared until acknowledged again.
  const replay = defineCommand<number, number>(
    {
      name: "till.sync.replay",
      async run(tx, _context, held) {
        const mine = and(
          eq(localSale.orgId, config.orgId),
          eq(localSale.deviceId, config.deviceId),
        );
        const acknowledged = await tx
          .select()
          .from(localSale)
          .where(and(mine, isNotNull(localSale.storeSequence)))
          .orderBy(asc(localSale.localId));
        if (acknowledged.length <= held) return 0;
        const queued = new Set(
          (await tx.select({ localId: outbox.localId }).from(outbox).where(scope)).map(
            (row) => row.localId,
          ),
        );
        const missing = acknowledged.filter((row) => !queued.has(row.localId));
        const [state] = await tx
          .select()
          .from(tillState)
          .where(and(eq(tillState.orgId, config.orgId), eq(tillState.deviceId, config.deviceId)));
        const first = (state?.lastOutboxSeq ?? 0) + 1;
        for (const [index, row] of missing.entries()) {
          // shortcut: replays as the current sale event (v7); keep the event on local_sale when v8 arrives.
          await tx.insert(outbox).values({
            id: v7(),
            orgId: config.orgId,
            deviceId: config.deviceId,
            localId: row.localId,
            localSeq: first + index,
            event: { v: 7, type: "sale.recorded", sale: row.payload },
          });
          await tx
            .update(localSale)
            .set({ storeSequence: null })
            .where(and(mine, eq(localSale.localId, row.localId)));
        }
        await tx
          .update(tillState)
          .set({ lastOutboxSeq: first + missing.length - 1 })
          .where(and(eq(tillState.orgId, config.orgId), eq(tillState.deviceId, config.deviceId)));
        return missing.length;
      },
      audit: (held, replayed) => ({ held, replayed }),
    },
    options.now,
  );
  return {
    replay: (held: number) =>
      replay(
        database,
        { orgId: config.orgId, deviceId: config.deviceId, appVersion: config.appVersion },
        held,
      ),
    read: () =>
      database.read(async (tx) => ({
        rows: (await tx.select().from(outbox).where(scope).orderBy(asc(outbox.localSeq))).map(
          (row) => ({
            ...row,
            nextAttemptAt: dueBy(row.nextAttemptAt, (options.now ?? Date.now)()),
          }),
        ),
        sessions: await tx
          .select()
          .from(hostSession)
          .where(
            and(eq(hostSession.orgId, config.orgId), eq(hostSession.deviceId, config.deviceId)),
          ),
      })),
    change: (changes: Change[]) =>
      changes.length
        ? change(
            database,
            { orgId: config.orgId, deviceId: config.deviceId, appVersion: config.appVersion },
            changes,
          )
        : Promise.resolve(),
  };
}
