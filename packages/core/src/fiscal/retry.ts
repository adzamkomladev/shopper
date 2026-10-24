import { and, eq } from "drizzle-orm";
import { defineCommand } from "@shopper/audit";
import { fiscalDoc } from "@shopper/db-pg";
import { FiscalError } from "./error";

/** Puts a dead-lettered document back as pending with a fresh count; the caller queues it on its store's lane. */
export const retryFiscalDoc = defineCommand({
  name: "fiscal.retry",
  async run(tx, ctx, input: { docId: string }) {
    const [doc] = await tx
      .update(fiscalDoc)
      .set({ status: "pending", attempts: 0, updatedAt: new Date() })
      .where(
        and(
          eq(fiscalDoc.orgId, ctx.orgId),
          eq(fiscalDoc.id, input.docId),
          eq(fiscalDoc.status, "dead"),
        ),
      )
      .returning({ storeId: fiscalDoc.storeId, lastError: fiscalDoc.lastError });
    if (!doc) throw new FiscalError("CONFLICT", "Only a dead-lettered document can be retried");
    return doc;
  },
  audit: (_input, doc) => ({ lastError: doc.lastError }),
  details: (input) => ({ entity: "fiscal_doc", entityId: input.docId }),
});
