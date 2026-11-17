import * as v from "valibot";

const id = v.pipe(v.string(), v.uuid());

/** A box opening its import: the manifest exactly as it signed it, and that signature. */
export const openImportBody = v.object({
  manifest: v.pipe(v.string(), v.maxLength(16_000_000)),
  signature: v.string(),
});

/** What travels with the commit and never in the archive file. */
export const moveCredentials = v.object({
  passwords: v.array(v.object({ userId: id, password: v.string() })),
  pins: v.array(v.object({ userId: id, pinHash: v.string() })),
  sessionKey: v.nullable(v.string()),
});

export const commitImportBody = v.object({ credentials: v.optional(moveCredentials) });

export const archiveImportParams = v.object({ orgId: id, importId: id });

/** An owner starting the move: where the cloud's API is. */
export const cloudMoveBody = v.object({
  cloudUrl: v.pipe(v.string(), v.url(), v.startsWith("https://")),
});

export const cloudMoveParams = v.object({ orgId: id, moveId: id });

const figure = v.pipe(v.string(), v.regex(/^-?\d{1,20}$/));
/** A box's account of what arrived, as `reconciliationReport` writes it. */
export const reconciliationReportSchema = v.object({
  auditUpTo: v.nullable(v.pipe(v.number(), v.integer(), v.minValue(0))),
  tables: v.record(
    v.pipe(v.string(), v.regex(/^[a-z_]{1,63}$/)),
    v.object({
      rows: v.pipe(v.number(), v.integer(), v.minValue(0)),
      checksum: v.pipe(v.string(), v.regex(/^[0-9a-f]{32}$/)),
    }),
  ),
  days: v.record(
    v.pipe(v.string(), v.isoDate()),
    v.object({
      sales: figure,
      gross: figure,
      tax: figure,
      vat: figure,
      nhil: figure,
      getfund: figure,
      covid: figure,
      net: figure,
      refunds: figure,
      refund_gross: figure,
      refund_tax: figure,
    }),
  ),
});

/** A box claiming the move its licence was issued for: where its registers reach it, and which archive it holds. */
export const claimBody = v.object({
  upstream: v.pipe(v.string(), v.url(), v.startsWith("https://")),
  manifestSha256: v.pipe(v.string(), v.regex(/^[0-9a-f]{64}$/)),
});

export const reportBody = v.object({ report: reconciliationReportSchema });

/** The owner pasting the request code their box shows. */
export const moveLicenceBody = v.object({
  request: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(400)),
});
