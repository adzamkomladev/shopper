import { eq, sql } from "drizzle-orm";
import { sha256 } from "@shopper/utils";
import { defineCommand, type CommandContext } from "@shopper/audit/sqlite";
import { receiptOutput, type TillDatabase } from "@shopper/db-sqlite";
import type { PrintOutcome } from "../types";

type Print = { saleId: string; error: string | null; at: Date };

/** Audits one print attempt and keeps `receipt_output` in step: first print, reprint or failure. */
export function recordReceiptPrint(
  db: TillDatabase,
  context: CommandContext,
  saleId: string,
  outcome: PrintOutcome,
) {
  const input = {
    saleId,
    error: typeof outcome === "object" ? outcome.error : null,
    at: new Date(),
  };
  const command = typeof outcome === "object" ? failed : outcome === "first" ? first : reprint;
  return command(db, context, input);
}

const first = printCommand("receipt.print", 0);
const reprint = printCommand("receipt.reprint", 1);
const failed = printCommand("receipt.print.failed", 0);

function printCommand(name: string, reprints: 0 | 1) {
  return defineCommand({
    name,
    async run(tx, context, input: Print) {
      const printedAt = input.error ? null : input.at.toISOString();
      await tx
        .insert(receiptOutput)
        .values({
          saleId: input.saleId,
          orgId: context.orgId,
          printedAt,
          printError: input.error,
          reprints,
        })
        .onConflictDoUpdate({
          target: receiptOutput.saleId,
          set: input.error
            ? { printError: input.error }
            : {
                printError: null,
                // A reprint that works is the first copy out when the automatic print failed.
                printedAt: sql`coalesce(${receiptOutput.printedAt}, ${printedAt})`,
                reprints: sql`${receiptOutput.reprints} + ${reprints}`,
              },
        });
    },
    audit: (input) => ({ saleId: input.saleId, ...(input.error ? { error: input.error } : {}) }),
    details: (input) => ({ entity: "sale", entityId: input.saleId }),
  });
}

/** Stores the rendered PDF with its digest and size; the upload worker picks it up once the sale is acknowledged. */
export async function storeReceiptPdf(
  db: TillDatabase,
  context: CommandContext,
  input: { saleId: string; pdf: Uint8Array },
) {
  const stored = { pdf: Buffer.from(input.pdf), pdfSha256: await sha256(input.pdf) };
  return store(db, context, { saleId: input.saleId, ...stored });
}

const store = defineCommand({
  name: "receipt.pdf.store",
  async run(tx, context, input: { saleId: string; pdf: Buffer; pdfSha256: string }) {
    const values = { pdf: input.pdf, pdfSha256: input.pdfSha256, pdfSize: input.pdf.length };
    await tx
      .insert(receiptOutput)
      .values({ saleId: input.saleId, orgId: context.orgId, ...values })
      // A new PDF supersedes any earlier upload state, so it is uploaded afresh.
      .onConflictDoUpdate({
        target: receiptOutput.saleId,
        set: { ...values, assetId: null, uploadedAt: null, uploadAttempts: 0, nextUploadAt: null },
      });
  },
  audit: (input) => ({ saleId: input.saleId, sha256: input.pdfSha256, size: input.pdf.length }),
  details: (input) => ({ entity: "sale", entityId: input.saleId }),
});

/** Records that the server holds the PDF: the asset it was linked to and when. */
export const markReceiptUploaded = defineCommand({
  name: "receipt.pdf.upload",
  async run(tx, _context, input: { saleId: string; assetId: string; at: Date }) {
    await tx
      .update(receiptOutput)
      .set({ assetId: input.assetId, uploadedAt: input.at.toISOString(), nextUploadAt: null })
      .where(eq(receiptOutput.saleId, input.saleId));
  },
  audit: (input) => ({ saleId: input.saleId, assetId: input.assetId }),
  details: (input) => ({ entity: "sale", entityId: input.saleId }),
});

/** Counts a failed upload attempt and defers the next one to `nextUploadAt` (epoch ms). */
export const markReceiptUploadFailed = defineCommand({
  name: "receipt.pdf.upload.failed",
  async run(tx, _context, input: { saleId: string; nextUploadAt: number; reason: string }) {
    await tx
      .update(receiptOutput)
      .set({
        uploadAttempts: sql`${receiptOutput.uploadAttempts} + 1`,
        nextUploadAt: input.nextUploadAt,
      })
      .where(eq(receiptOutput.saleId, input.saleId));
  },
  audit: (input) => ({ saleId: input.saleId, reason: input.reason }),
  details: (input) => ({ entity: "sale", entityId: input.saleId }),
});
