import { sql } from "drizzle-orm";
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
