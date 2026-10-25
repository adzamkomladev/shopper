// Pending fiscal documents for the lane conformance suites, on the box and in workerd. Each gets its own sale, a copy
// of the provisioned pending sale with a fresh identity, so the documents satisfy every foreign key.
import { sql } from "drizzle-orm";
import { defineCommand, type CommandContext } from "@shopper/audit";
import { fiscalDoc, type ShopperDatabase } from "@shopper/db-pg";

export function seedFiscalDocs(
  db: ShopperDatabase,
  context: CommandContext,
  input: { baseLocalId: string; storeId: string; prefix: string; count: number },
) {
  return seed(db, context, input);
}

const seed = defineCommand({
  name: "conformance.fiscal.docs",
  async run(
    tx,
    ctx,
    input: { baseLocalId: string; storeId: string; prefix: string; count: number },
  ) {
    const ids: string[] = [];
    for (let n = 1; n <= input.count; n++) {
      const invoiceNumber = `${input.prefix}-${n}`;
      const { rows } = await tx.execute<{ id: string; branch_id: string }>(sql`
        INSERT INTO sale
        SELECT (jsonb_populate_record(s, jsonb_build_object(
          'id', uuidv7(), 'local_id', uuidv7(), 'store_sequence', null, 'receipt_number', ${invoiceNumber}::text))).*
        FROM sale s WHERE s.org_id = ${ctx.orgId} AND s.local_id = ${input.baseLocalId}
        RETURNING id, branch_id`);
      const [row] = await tx
        .insert(fiscalDoc)
        .values({
          orgId: ctx.orgId,
          storeId: input.storeId,
          branchId: rows[0]!.branch_id,
          kind: "invoice",
          saleId: rows[0]!.id,
          invoiceNumber,
          payload: { type: "invoice", invoiceNumber },
        })
        .returning({ id: fiscalDoc.id });
      ids.push(row!.id);
    }
    return ids;
  },
  audit: (input, ids) => ({ prefix: input.prefix, ids }),
});
