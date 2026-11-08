import * as v from "valibot";

/** `rel/1`: what Shopper signs for a box. An install and an update carry the product; a tax pack only rules. */
export const manifest = v.object({
  format: v.literal("rel/1"),
  kind: v.picklist(["install", "update", "taxpack"]),
  version: v.pipe(v.string(), v.minLength(1)),
  // The day the bundle was built, signed in: it is compared with the licence's `maintenanceUntil`.
  builtAt: v.pipe(v.string(), v.isoTimestamp()),
  schemaVersion: v.pipe(v.number(), v.integer(), v.minValue(1)),
  // Path inside the bundle (or the installed folder) to the file's SHA-256, hex.
  files: v.record(v.string(), v.pipe(v.string(), v.regex(/^[0-9a-f]{64}$/))),
  signature: v.string(),
});
export type Manifest = v.InferOutput<typeof manifest>;
