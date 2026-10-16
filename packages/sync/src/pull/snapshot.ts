import type { Snapshot } from "../schemas/pull/snapshot";
import { eq } from "drizzle-orm";
import { v7 } from "uuid";
import { defineCommand } from "@shopper/audit/sqlite";
import { reference, tillState } from "@shopper/db-sqlite";
import { clearProjection, projectProducts, storeCashRounding } from "@shopper/core/till";

/** Replaces the organisation's reference and lookup; `referenceVersion` is the wire version the server sent. */
export const applySnapshot = (now?: () => number) =>
  defineCommand(
    {
      name: "till.sync.snapshot",
      async run(tx, context, input: Snapshot & { referenceVersion: number }) {
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
        await clearProjection(tx, context.orgId);
        const products = input.reference.products.filter((product) => !product.archivedAt);
        await projectProducts(tx, context.orgId, products);
        groups.product = products;
        await storeCashRounding(tx, context.orgId, input.reference.cashRounding);
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
            referenceVersion: input.referenceVersion,
          })
          .onConflictDoUpdate({
            target: [tillState.orgId, tillState.deviceId],
            set: {
              pullCursor: input.cursor,
              pullInitialized: true,
              referenceVersion: input.referenceVersion,
            },
          });
        return { count };
      },
      audit: (input, output) => ({ cursor: input.cursor, ...output }),
    },
    now,
  );
