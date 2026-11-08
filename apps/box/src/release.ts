import { readFile, realpath } from "node:fs/promises";
import { join } from "node:path";
import { changedFiles, readManifest } from "@shopper/core/release";

/**
 * The boot gate: the installed folder (`SHOPPER_RELEASE_DIR`, default `/opt/shopper/current`) must be what Shopper
 * signed, and this process must be its binary. The Rivet engine and every other file in the manifest are hashed too.
 * The release key is a build define, so a build without one (development, tests) checks nothing.
 */
export async function verifyRelease(env: Record<string, string | undefined>, releaseKey: string) {
  if (!releaseKey) return;
  const dir = env.SHOPPER_RELEASE_DIR ?? "/opt/shopper/current";
  const signed = await readManifest(
    releaseKey,
    await readFile(join(dir, "manifest.json"), "utf8")
      .then((text) => JSON.parse(text) as unknown)
      .catch(() => undefined),
  );
  if (!signed.ok)
    throw new Error(
      `The release in ${dir} has no genuine manifest (${signed.reason}): reinstall from a Shopper bundle`,
    );
  const changed = await changedFiles(signed.manifest, (path) =>
    readFile(join(dir, path)).catch(() => undefined),
  );
  if (changed.length)
    throw new Error(
      `${changed.join(", ")} in ${dir} is not what Shopper signed: reinstall from a Shopper bundle`,
    );
  if (!signed.manifest.files["shopper-box"])
    throw new Error(`The manifest in ${dir} does not name the shopper-box binary`);
  if ((await realpath(process.execPath)) !== (await realpath(join(dir, "shopper-box"))))
    throw new Error(`${process.execPath} is not the signed shopper-box in ${dir}`);
}
