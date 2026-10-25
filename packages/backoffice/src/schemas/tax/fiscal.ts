import * as v from "valibot";

export const fiscalSegments = ["all", "pending", "accepted", "rejected", "dead"] as const;
export type FiscalSegment = (typeof fiscalSegments)[number];
const status = v.picklist(["pending", "submitted", "accepted", "rejected", "dead"]);

/** The Fiscal tab's address: the segment shown and the receipt number searched for. */
export const fiscalSearch = v.object({
  status: v.optional(v.picklist(fiscalSegments)),
  q: v.optional(v.pipe(v.string(), v.maxLength(64))),
  date: v.optional(v.pipe(v.string(), v.isoDate())),
});
export type FiscalSearch = v.InferOutput<typeof fiscalSearch>;

const row = v.object({
  id: v.string(),
  kind: v.picklist(["invoice", "credit_note"]),
  invoiceNumber: v.string(),
  branchName: v.string(),
  status,
  attempts: v.number(),
  createdAt: v.string(),
  acceptedAt: v.nullable(v.string()),
  reason: v.nullable(v.string()),
});
export type FiscalRow = v.InferOutput<typeof row>;
export const fiscalListView = v.object({
  connected: v.boolean(),
  counts: v.object(
    Object.fromEntries(fiscalSegments.map((s) => [s, v.number()])) as Record<
      FiscalSegment,
      v.NumberSchema<undefined>
    >,
  ),
  documents: v.array(row),
});
export const fiscalDocView = v.object({
  ...row.entries,
  status,
  sdcId: v.nullable(v.string()),
  sdcCounter: v.nullable(v.number()),
  signature: v.nullable(v.string()),
  qr: v.nullable(v.string()),
  signedAt: v.nullable(v.string()),
  rejectionCode: v.nullable(v.string()),
  rejectionMessage: v.nullable(v.string()),
  lastError: v.nullable(v.string()),
  payload: v.object({ totals: v.optional(v.object({ total: v.number() })) }),
});
export type FiscalDocView = v.InferOutput<typeof fiscalDocView>;
export const fiscalArchivesView = v.object({
  archives: v.array(
    v.object({
      id: v.string(),
      storeName: v.string(),
      hour: v.string(),
      docCount: v.number(),
      bytes: v.number(),
      sha256: v.string(),
      url: v.nullable(v.string()),
    }),
  ),
});
export type FiscalArchive = v.InferOutput<typeof fiscalArchivesView>["archives"][number];
