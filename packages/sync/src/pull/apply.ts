import type { Page } from "../schemas/pull/apply";
export { page, type Page } from "../schemas/pull/apply";

import { and, eq, sql } from "drizzle-orm";
import { v7 } from "uuid";
import { defineCommand } from "@shopper/audit/sqlite";
import { reference, tillState } from "@shopper/db-sqlite";
import {
  projectCustomers,
  projectProducts,
  removeCustomers,
  unprojectProducts,
  type ProjectedCustomer,
  type ProjectedProduct,
} from "@shopper/core/till";

/** The only change version this till understands; a page holding any other halts the pull. */
export { KNOWN_VERSION } from "../schemas/pull/apply";

/**
 * Applies one whole page and moves the cursor in a single audited transaction, keeping the lookup in step.
 * `referenceVersion` is the lowest wire version of the page's product rows that lost data in an upcast: it can only
 * lower the till's version.
 */
export const applyPage = (now?: () => number) =>
  defineCommand<Page & { referenceVersion: number }, { count: number }>(
    {
      name: "till.sync.pull",
      async run(tx, context, input) {
        for (const change of input.changes) {
          if (change.entity === "customer") {
            // Customers live in the lookup alone; there is no reference row to keep in step.
            if (change.op === "delete") await removeCustomers(tx, context.orgId, [change.entityId]);
            else await projectCustomers(tx, context.orgId, [change.payload as ProjectedCustomer]);
            continue;
          }
          const key = and(
            eq(reference.orgId, context.orgId),
            eq(reference.entity, change.entity),
            eq(reference.id, change.entityId),
          );
          const product = change.entity === "product";
          const archived = product && !!(change.payload as { archivedAt?: unknown })?.archivedAt;
          if (change.op === "delete" || archived) await tx.delete(reference).where(key);
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
          if (product && change.op === "delete")
            await unprojectProducts(tx, context.orgId, [change.entityId]);
          else if (product)
            await projectProducts(tx, context.orgId, [change.payload as ProjectedProduct]);
        }
        await tx
          .insert(tillState)
          .values({
            id: v7(),
            orgId: context.orgId,
            deviceId: context.deviceId!,
            pullCursor: input.cursor,
            pullInitialized: true,
            referenceVersion: input.referenceVersion,
          })
          .onConflictDoUpdate({
            target: [tillState.orgId, tillState.deviceId],
            set: {
              pullCursor: input.cursor,
              pullInitialized: true,
              referenceVersion: sql`min(${tillState.referenceVersion}, ${input.referenceVersion})`,
            },
          });
        return { count: input.changes.length };
      },
      audit: (input, output) => ({ cursor: input.cursor, head: input.head, ...output }),
    },
    now,
  );
