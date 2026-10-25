import { and, asc, eq, inArray, isNull, lt } from "drizzle-orm";
import { defineCommand } from "@shopper/audit";
import { fiscalArchive, fiscalDoc } from "@shopper/db-pg";
import type { Blobs } from "@shopper/ports";
import { sha256 } from "@shopper/utils";

const HOUR_MS = 3_600_000;

/** The start of the UTC hour `at` falls in. */
export const fiscalHour = (at: Date) => new Date(Math.floor(at.getTime() / HOUR_MS) * HOUR_MS);

/** The archive workflow's business key: one per store and hour (the store id is globally unique). */
export const fiscalArchiveId = (orgId: string, storeId: string, hour: Date) =>
  `fiscal-archive_${orgId}_${storeId}_${hour.toISOString().slice(0, 13).replace(/\D/g, "")}`;

/** Where an hour's bundle lives in the org's blobs, kept six years by the bucket's lifecycle rule. */
export const fiscalArchiveKey = (storeId: string, hour: Date) =>
  `fiscal/${storeId}/${hour.toISOString().slice(0, 13).replace("T", "/").replaceAll("-", "/")}.jsonl`;

/**
 * Writes one JSON line per accepted document of the store not yet archived and accepted before the hour ended, then
 * records the bundle and points each document at it. Documents accepted late fall into the next hour's bundle.
 */
export const archiveFiscalHour = defineCommand({
  name: "fiscal.archive",
  async run(tx, ctx, input: { storeId: string; hour: string; blobs: Blobs }) {
    const hour = new Date(input.hour);
    const docs = await tx
      .select()
      .from(fiscalDoc)
      .where(
        and(
          eq(fiscalDoc.orgId, ctx.orgId),
          eq(fiscalDoc.storeId, input.storeId),
          eq(fiscalDoc.status, "accepted"),
          isNull(fiscalDoc.archiveId),
          lt(fiscalDoc.acceptedAt, new Date(hour.getTime() + HOUR_MS)),
        ),
      )
      .orderBy(asc(fiscalDoc.acceptedAt), asc(fiscalDoc.id))
      .for("update");
    if (!docs.length) return { archiveId: null, docCount: 0 };
    const bytes = new TextEncoder().encode(
      docs
        .map((doc) =>
          JSON.stringify({
            id: doc.id,
            kind: doc.kind,
            invoiceNumber: doc.invoiceNumber,
            payload: doc.payload,
            sdcId: doc.sdcId,
            counter: doc.sdcCounter,
            signature: doc.signature,
            qr: doc.qr,
            signedAt: doc.signedAt?.toISOString(),
            acceptedAt: doc.acceptedAt?.toISOString(),
          }),
        )
        .join("\n") + "\n",
    );
    const key = fiscalArchiveKey(input.storeId, hour);
    // Written before the rows: a rerun of this step rewrites the same key, so nothing is lost or doubled.
    await input.blobs.put(ctx.orgId, key, bytes);
    const [bundle] = await tx
      .insert(fiscalArchive)
      .values({
        orgId: ctx.orgId,
        storeId: input.storeId,
        hour,
        key,
        docCount: docs.length,
        sha256: await sha256(bytes),
        bytes: bytes.byteLength,
      })
      .returning({ id: fiscalArchive.id });
    await tx
      .update(fiscalDoc)
      .set({ archiveId: bundle!.id, updatedAt: new Date() })
      .where(
        and(
          eq(fiscalDoc.orgId, ctx.orgId),
          inArray(
            fiscalDoc.id,
            docs.map((doc) => doc.id),
          ),
        ),
      );
    return { archiveId: bundle!.id, docCount: docs.length };
  },
  audit: (input, output) => ({ storeId: input.storeId, hour: input.hour, ...output }),
  details: (_input, output) =>
    output.archiveId ? { entity: "fiscal_archive", entityId: output.archiveId } : {},
});
