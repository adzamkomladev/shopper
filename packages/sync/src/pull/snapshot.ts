import type { Snapshot } from "../schemas/pull/snapshot";
import { eq } from "drizzle-orm";
import { v7 } from "uuid";
import { defineCommand } from "@shopper/audit/sqlite";
import { reference, tillState } from "@shopper/db-sqlite";
import {
  clearProjection,
  projectCustomers,
  projectProducts,
  replayPendingCustomers,
  signLocalReceipt,
  storeOrgSettings,
} from "@shopper/core/till";
import type { TillFiscalSignature } from "@shopper/core/schemas";

/** Replaces the organisation's reference and lookup; `referenceVersion` is the wire version the server sent. */
export const applySnapshot = (now?: () => number) =>
  defineCommand(
    {
      name: "till.sync.snapshot",
      async run(
        tx,
        context,
        input: Snapshot & { referenceVersion: number; signatures?: TillFiscalSignature[] },
      ) {
        if (input.orgId !== context.orgId) throw new Error("Snapshot outside tenant scope");
        const groups = {
          product: input.reference.products,
          price: input.reference.prices,
          "tax-rule": input.reference.taxRules,
          "barcode-mapping": input.reference.barcodeMappings,
        };
        const { customers } = input.reference;
        for (const rows of [...Object.values(groups), customers])
          if (rows.some((row) => "orgId" in row && row.orgId !== context.orgId))
            throw new Error("Reference outside tenant scope");
        await tx.delete(reference).where(eq(reference.orgId, context.orgId));
        await clearProjection(tx, context.orgId);
        const products = input.reference.products.filter((product) => !product.archivedAt);
        await projectProducts(tx, context.orgId, products);
        groups.product = products;
        // The server's customers come first; what this till made or edited and has not uploaded goes back on top.
        await projectCustomers(tx, context.orgId, customers);
        await replayPendingCustomers(tx, context.orgId);
        await storeOrgSettings(tx, context.orgId, input.reference.settings);
        let count = 0;
        for (const [entity, rows] of Object.entries(groups)) {
          for (const payload of rows) {
            await tx
              .insert(reference)
              .values({ id: payload.id, orgId: context.orgId, entity, payload });
            count++;
          }
        }
        // Signatures the skipped feed carried, fetched before this transaction so a failure applies nothing.
        for (const signed of input.signatures ?? [])
          await signLocalReceipt(tx, context.orgId, signed);
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
