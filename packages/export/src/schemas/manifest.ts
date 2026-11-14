import * as v from "valibot";

/**
 * The archive format this code writes and reads. A higher number is refused; a lower one is upcast by the importer.
 * It is a number in the code, not read from the build, so a verifier runs anywhere; a test holds it equal to the
 * build's `ARCHIVE_FORMAT`, which records it for installers and orgs.
 */
export const ARCHIVE_FORMAT = 1;

const hash = v.pipe(v.string(), v.regex(/^[a-f0-9]{64}$/));
const count = v.pipe(v.number(), v.integer(), v.minValue(0));
const part = v.object({ path: v.string(), bytes: count, sha256: hash, rows: count });

/** `manifest.json`: everything a reader needs to check the rest of the archive. */
export const manifest = v.object({
  archive_format: v.literal(ARCHIVE_FORMAT),
  product_version: v.string(),
  schema_version: count,
  created_at: v.string(),
  public_key: v.string(),
  org: v.object({ id: v.string(), name: v.string(), slug: v.string() }),
  tables: v.record(v.string(), v.object({ rows: count, files: v.array(part) })),
  blobs: v.array(v.object({ path: v.string(), bytes: count, sha256: hash })),
});

export type Manifest = v.InferOutput<typeof manifest>;
