import { execFileSync } from "node:child_process";
import { writeManifest } from "../release/sign";

/**
 * An update bundle: a signed slot folder (the sealed box, the engine, `manifest.json` of kind `update`) as one .tgz. The
 * box verifies it, stages it into its spare slot and a root helper flips to it.
 */
export async function buildUpdate(options: {
  slot: string;
  out: string;
  releaseKey: string;
  kind?: "update" | "taxpack";
  builtAt?: string;
  version?: string;
  schemaVersion?: number;
}) {
  await writeManifest(options.slot, options.releaseKey, {
    kind: options.kind ?? "update",
    builtAt: options.builtAt,
    version: options.version,
    schemaVersion: options.schemaVersion,
  });
  execFileSync("tar", ["-czf", options.out, "-C", options.slot, "."]);
}
