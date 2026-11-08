import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { parseArgs } from "node:util";
import { signManifest } from "../../packages/core/src/release/index";
import { sha256 } from "../../packages/utils/src/crypto";
import { buildDefines } from "../build/info";

/**
 * Signs every file under `dir` into `dir/manifest.json`: the installed folder the box checks at boot, and the payload an
 * installer or update bundle carries. The private JWK is `SHOPPER_RELEASE_SIGNING_KEY` (a CI secret, never in the repo).
 */
export async function writeManifest(
  dir: string,
  key: string,
  fields: {
    kind: "install" | "update" | "taxpack";
    builtAt?: string;
    version?: string;
    schemaVersion?: number;
  },
) {
  const names = (await readdir(dir, { recursive: true, withFileTypes: true }))
    .filter((entry) => entry.isFile())
    .map((entry) => relative(dir, join(entry.parentPath, entry.name)))
    .filter((name) => name !== "manifest.json");
  const hashes = await Promise.all(
    names.map(async (name) => sha256(await readFile(join(dir, name)))),
  );
  const manifest = await signManifest(key, {
    kind: fields.kind,
    version: fields.version ?? (JSON.parse(buildDefines.SHOPPER_VERSION) as string),
    builtAt: fields.builtAt ?? JSON.parse(buildDefines.BUILD_DATE),
    schemaVersion: fields.schemaVersion ?? Number(buildDefines.SCHEMA_VERSION),
    files: Object.fromEntries(names.map((name, index) => [name, hashes[index]!])),
  });
  await writeFile(join(dir, "manifest.json"), JSON.stringify(manifest, null, 2));
  return manifest;
}

if (import.meta.main) {
  const args = parseArgs({
    options: { dir: { type: "string" }, kind: { type: "string", default: "install" } },
  }).values;
  const key = process.env.SHOPPER_RELEASE_SIGNING_KEY;
  if (!key || !args.dir) throw new Error("Pass --dir and set SHOPPER_RELEASE_SIGNING_KEY");
  await writeManifest(args.dir, key, { kind: args.kind as "install" | "update" | "taxpack" });
}
