import { and, eq, sql } from "drizzle-orm";
import { defineCommand } from "@shopper/audit";
import { fiscalDoc, type ShopperDatabase } from "@shopper/db-pg";
import type { Json, Sdc, SdcResult, WorkflowLauncher } from "@shopper/ports";
import { fiscalArchiveId, fiscalHour } from "./archive";
import { FiscalError } from "./error";
import { recordChanges } from "../changes/record";
import { fiscalSigned } from "../changes/project";

/** Tries before a document is dead-lettered: with the lane's backoff, about six hours of SDC outage. */
export const FISCAL_MAX_ATTEMPTS = 10;

type Context = { orgId: string; appVersion: string };
type Outcome = SdcResult | { status: "unavailable"; message: string };

/**
 * Submits one fiscal document and records the outcome. "retry" means the SDC was unavailable and the lane should try
 * this document again before any later one; "done" means it is settled (accepted, rejected or dead-lettered).
 */
export async function submitFiscalDoc(
  db: ShopperDatabase,
  ctx: Context,
  sdc: Sdc,
  docId: string,
  /** Starts the bundle of the hour the document was accepted in; starting one that exists does nothing. */
  archive?: WorkflowLauncher,
): Promise<"done" | "retry"> {
  const doc = await claim(db, ctx, { docId });
  if (!doc) return "done";
  const outcome: Outcome = await sdc
    .submit({ invoiceNumber: doc.invoiceNumber, payload: doc.payload as Json })
    // Anything that is not an answer from the SDC is retried; only the SDC can reject a document.
    .catch((error: unknown) => ({
      status: "unavailable" as const,
      message: error instanceof Error ? error.message : "The SDC could not be reached",
    }));
  const settled = await settle(db, ctx, { docId, attempts: doc.attempts, outcome });
  if (settled.status === "accepted" && archive) {
    const hour = fiscalHour(settled.acceptedAt!);
    // A start that fails is covered by a later bundle of the store: each takes every unarchived document before it.
    await archive
      .start(fiscalArchiveId(ctx.orgId, settled.storeId, hour), {
        orgId: ctx.orgId,
        storeId: settled.storeId,
        hour: hour.toISOString(),
      })
      .catch((error: unknown) =>
        console.error({ event: "fiscal.archive_start_failed", orgId: ctx.orgId, docId, error }),
      );
  }
  return settled.status === "pending" ? "retry" : "done";
}

/** Marks the document submitted and counts the attempt, before the SDC call; settled documents are skipped. */
const claim = defineCommand({
  name: "fiscal.submit",
  async replay(tx, ctx, input: { docId: string }) {
    const [doc] = await tx
      .select({ status: fiscalDoc.status })
      .from(fiscalDoc)
      .where(and(eq(fiscalDoc.orgId, ctx.orgId), eq(fiscalDoc.id, input.docId)));
    if (!doc) throw new FiscalError("NOT_FOUND", "Fiscal document not found");
    return doc.status === "pending" || doc.status === "submitted" ? undefined : { output: null };
  },
  async run(tx, ctx, input): Promise<typeof fiscalDoc.$inferSelect | null> {
    // The replay check above ran under the org's command lock, so the document is still pending or submitted.
    const [doc] = await tx
      .update(fiscalDoc)
      .set({ status: "submitted", attempts: sql`${fiscalDoc.attempts} + 1`, updatedAt: new Date() })
      .where(and(eq(fiscalDoc.orgId, ctx.orgId), eq(fiscalDoc.id, input.docId)))
      .returning();
    return doc!;
  },
  audit: (_input, doc) => ({ attempts: doc?.attempts }),
  details: (input) => ({ entity: "fiscal_doc", entityId: input.docId }),
});

/** Records what the SDC said: the signature, the rejection, or another failed try (dead after the last). */
const settle = defineCommand({
  name: "fiscal.settle",
  async run(tx, ctx, input: { docId: string; attempts: number; outcome: Outcome }) {
    const { outcome } = input;
    const now = new Date();
    const changes =
      outcome.status === "accepted"
        ? {
            status: "accepted" as const,
            sdcId: outcome.sdcId,
            sdcCounter: outcome.counter,
            signature: outcome.signature,
            qr: outcome.qr,
            signedAt: new Date(outcome.signedAt),
            acceptedAt: now,
            lastError: null,
          }
        : outcome.status === "rejected"
          ? {
              status: "rejected" as const,
              rejectionCode: outcome.code,
              rejectionMessage: outcome.message,
              lastError: null,
            }
          : {
              status:
                input.attempts >= FISCAL_MAX_ATTEMPTS ? ("dead" as const) : ("pending" as const),
              lastError: outcome.message,
            };
    const [doc] = await tx
      .update(fiscalDoc)
      .set({ ...changes, updatedAt: now })
      .where(
        and(
          eq(fiscalDoc.orgId, ctx.orgId),
          eq(fiscalDoc.id, input.docId),
          eq(fiscalDoc.status, "submitted"),
        ),
      )
      .returning();
    if (!doc) throw new FiscalError("CONFLICT", "Fiscal document is no longer being submitted");
    // The store's tills add the signature to the receipt they printed provisionally.
    if (doc.status === "accepted")
      await recordChanges(
        tx,
        ctx.orgId,
        [
          fiscalSigned({
            ...doc,
            sdcId: doc.sdcId!,
            sdcCounter: doc.sdcCounter!,
            signature: doc.signature!,
            qr: doc.qr!,
            signedAt: doc.signedAt!,
          }),
        ],
        [doc.storeId],
      );
    return doc;
  },
  audit: (input, doc) => ({
    status: doc.status,
    attempts: doc.attempts,
    ...(input.outcome.status === "accepted"
      ? { sdcId: doc.sdcId, counter: doc.sdcCounter }
      : input.outcome.status === "rejected"
        ? { code: doc.rejectionCode }
        : { error: doc.lastError }),
  }),
  details: (input) => ({ entity: "fiscal_doc", entityId: input.docId }),
});
