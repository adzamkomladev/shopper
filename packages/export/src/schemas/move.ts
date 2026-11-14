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
