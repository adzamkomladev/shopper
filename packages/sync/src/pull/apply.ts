import * as v from "valibot";
import { and, eq } from "drizzle-orm";
import { v7 } from "uuid";
import { defineCommand } from "@shopper/audit/sqlite";
import { reference, tillState } from "@shopper/db-sqlite";
import { sequenceSchema } from "@shopper/ports";

/** The only change version this till understands; a page holding any other halts the pull. */
export const KNOWN_VERSION = 1;
export const page = v.object({
  changes: v.array(
    v.object({
      seq: sequenceSchema,
      entity: v.string(),
      entityId: v.string(),
      op: v.picklist(["upsert", "delete"]),
      v: v.pipe(v.number(), v.integer()),
      payload: v.unknown(),
    }),
  ),
  cursor: sequenceSchema,
  head: sequenceSchema,
  hasMore: v.boolean(),
});
export type Page = v.InferOutput<typeof page>;

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
          })
          .onConflictDoUpdate({
            target: [tillState.orgId, tillState.deviceId],
            set: { pullCursor: input.cursor },
          });
        return { count: input.changes.length };
      },
      audit: (input, output) => ({ cursor: input.cursor, head: input.head, ...output }),
    },
    now,
  );
