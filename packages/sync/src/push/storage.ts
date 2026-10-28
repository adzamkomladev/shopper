import { and, asc, eq } from "drizzle-orm";
import { defineCommand } from "@shopper/audit/sqlite";
import { hostSession, localSale, outbox } from "@shopper/db-sqlite";
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
  return {
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
