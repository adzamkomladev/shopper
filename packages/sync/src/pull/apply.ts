import type { Page } from "../schemas/pull/apply";
export { page, type Page } from "../schemas/pull/apply";

import { and, eq } from "drizzle-orm";
import { v7 } from "uuid";
import { defineCommand } from "@shopper/audit/sqlite";
import { reference, tillState } from "@shopper/db-sqlite";

/** The only change version this till understands; a page holding any other halts the pull. */
export { KNOWN_VERSION } from "../schemas/pull/apply";

/** Applies one whole page and moves the cursor in a single audited transaction. */
export const applyPage = (now?: () => number) =>
  defineCommand<Page, { count: number }>(
    {
      name: "till.sync.pull",
      async run(tx, context, input) {
        for (const change of input.changes) {
          const key = and(
            eq(reference.orgId, context.orgId),
            eq(reference.entity, change.entity),
            eq(reference.id, change.entityId),
          );
          if (change.op === "delete") await tx.delete(reference).where(key);
          else
            await tx
              .insert(reference)
              .values({
                id: change.entityId,
                orgId: context.orgId,
                entity: change.entity,
                payload: change.payload,
              })
              .onConflictDoUpdate({
                target: [reference.orgId, reference.entity, reference.id],
                set: { payload: change.payload },
              });
        }
        await tx
          .insert(tillState)
          .values({
            id: v7(),
            orgId: context.orgId,
            deviceId: context.deviceId!,
            pullCursor: input.cursor,
            pullInitialized: true,
          })
          .onConflictDoUpdate({
            target: [tillState.orgId, tillState.deviceId],
            set: { pullCursor: input.cursor, pullInitialized: true },
          });
        return { count: input.changes.length };
      },
      audit: (input, output) => ({ cursor: input.cursor, head: input.head, ...output }),
    },
    now,
  );
