import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  readManifest,
  updateVerdict,
  type Manifest,
  type UpdateVerdict,
} from "@shopper/core/release";

const run = promisify(execFile);

/** What a bundle in the updates folder is, from its signed manifest alone: nothing else is unpacked to find out. */
export async function readBundle(
  file: string,
  context: {
    releaseKey: string;
    installed: { version: string; schemaVersion: number };
    maintenanceUntil: string | undefined;
  },
): Promise<
  | { ok: true; manifest: Manifest; verdict: UpdateVerdict }
  | { ok: false; reason: "forged" | "unreadable"; message: string }
> {
  const text = await run("tar", ["-xzOf", file, "./manifest.json"], { maxBuffer: 1 << 24 })
    .then((out) => out.stdout)
    .catch(() => undefined);
  const parsed = await readManifest(context.releaseKey, text && safeJson(text));
  if (!parsed.ok)
    return {
      ok: false,
      reason: parsed.reason,
      message:
        parsed.reason === "forged"
          ? "This bundle was not signed by Shopper."
          : "This file is not a Shopper update bundle.",
    };
  return {
    ok: true,
    manifest: parsed.manifest,
    verdict: updateVerdict({
      manifest: parsed.manifest,
      installed: context.installed,
      maintenanceUntil: context.maintenanceUntil,
    }),
  };
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
