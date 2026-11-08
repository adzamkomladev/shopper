import { execFile } from "node:child_process";
import { promisify } from "node:util";
import * as v from "valibot";
import { BoxUpdateError } from "@shopper/api";
import { ManagementError } from "@shopper/core/management";
import { changedFiles, type BoxUpdateDeps, type Manifest } from "@shopper/core/release";
import { applyTaxPack } from "@shopper/core/tax";

const run = promisify(execFile);

/**
 * A tax rule pack (`kind: "taxpack"`): its `taxrules.json`, checked against the signed manifest, applied to the shop at
 * once. Nothing is backed up or unpacked into a slot; the maintenance date never refuses one. Returns how many rules
 * changed.
 */
export async function applyTaxPackBundle(
  path: string,
  manifest: Manifest,
  options: { withDatabase: BoxUpdateDeps["withDatabase"]; appVersion: string },
  who: { orgId: string; actorId?: string },
) {
  const text = await run("tar", ["-xzOf", path, "./taxrules.json"], { maxBuffer: 1 << 20 }).then(
    (out) => out.stdout,
    () => undefined,
  );
  if (text === undefined) throw new BoxUpdateError(422, "This tax rule pack has no tax rules.");
  const changed = await changedFiles(manifest, async (name) =>
    name === "taxrules.json" ? Buffer.from(text) : undefined,
  );
  // The rules themselves must be signed: a pack signed without them proves nothing about them.
  if (changed.length || !manifest.files["taxrules.json"])
    throw new BoxUpdateError(
      422,
      `${changed.length ? changed.join(", ") : "taxrules.json"} is not what Shopper signed.`,
    );
  const result = await options
    .withDatabase((db) =>
      applyTaxPack(
        db,
        { ...who, appVersion: options.appVersion },
        { version: manifest.version, rules: JSON.parse(text) as unknown },
      ),
    )
    .catch((error: unknown) => {
      if (error instanceof ManagementError || v.isValiError(error))
        throw new BoxUpdateError(422, error.message);
      throw error;
    });
  return result.applied.length;
}
