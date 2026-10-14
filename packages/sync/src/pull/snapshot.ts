import type { Snapshot } from "../schemas/pull/snapshot";
import { eq } from "drizzle-orm";
import { v7 } from "uuid";
import { defineCommand } from "@shopper/audit/sqlite";
import { reference, tillState } from "@shopper/db-sqlite";

export const applySnapshot = (now?: () => number) =>
  defineCommand(
    {
      name: "till.sync.snapshot",
      async run(tx, context, input: Snapshot) {
        if (input.orgId !== context.orgId) throw new Error("Snapshot outside tenant scope");
        const groups = {
          product: input.reference.products,
          price: input.reference.prices,
          "tax-rule": input.reference.taxRules,
          "barcode-mapping": input.reference.barcodeMappings,
        };
        for (const rows of Object.values(groups))
          if (rows.some((row) => "orgId" in row && row.orgId !== context.orgId))
            throw new Error("Reference outside tenant scope");
        await tx.delete(reference).where(eq(reference.orgId, context.orgId));
        let count = 0;
        for (const [entity, rows] of Object.entries(groups)) {
          for (const payload of rows) {
            await tx
              .insert(reference)
              .values({ id: payload.id, orgId: context.orgId, entity, payload });
            count++;
          }
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
        return { count };
      },
      audit: (input, output) => ({ cursor: input.cursor, ...output }),
    },
    now,
  );
