import * as v from "valibot";
import { uuidV7Schema } from "@shopper/ports";

/** A bundle in the box's updates folder, by its file name alone: a name can never reach another folder. */
export const updateFile = v.pipe(v.string(), v.regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,120}\.tgz$/));
const iso = v.pipe(v.string(), v.isoTimestamp());

export const updateVerdictView = v.variant("ok", [
  v.strictObject({ ok: v.literal(true) }),
  v.strictObject({
    ok: v.literal(false),
    reason: v.picklist([
      "kind",
      "current",
      "older",
      "licence",
      "maintenance",
      "forged",
      "unreadable",
    ]),
    message: v.string(),
  }),
]);
export const updateBundleView = v.strictObject({
  file: updateFile,
  kind: v.picklist(["install", "update", "taxpack"]),
  version: v.string(),
  builtAt: iso,
  verdict: updateVerdictView,
});
export const updatesResponse = v.strictObject({
  running: v.strictObject({ version: v.string(), slot: v.picklist(["a", "b"]) }),
  bundles: v.array(updateBundleView),
  /** What the last attempt did, from the box's own record. */
  last: v.optional(
    v.strictObject({
      status: v.picklist(["applied", "rolled_back", "failed"]),
      version: v.string(),
      at: iso,
      message: v.optional(v.string()),
    }),
  ),
  scheduled: v.optional(v.strictObject({ file: updateFile, at: iso })),
});
/** Install now (no `at`), or after closing at `at`. */
export const updateInstallInput = v.strictObject({ file: updateFile, at: v.optional(iso) });
export const updateInstallResponse = v.variant("status", [
  v.strictObject({
    status: v.picklist(["started", "scheduled"]),
    file: updateFile,
    at: v.optional(iso),
  }),
  /** A tax rule pack: applied at once; `rules` is how many changed. */
  v.strictObject({ status: v.literal("applied"), file: updateFile, rules: v.number() }),
]);
export const boxUpdateParams = v.strictObject({
  orgId: uuidV7Schema,
  actorId: v.optional(uuidV7Schema),
  file: updateFile,
  at: iso,
});
export type UpdatesResponse = v.InferOutput<typeof updatesResponse>;
