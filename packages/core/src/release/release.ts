import * as v from "valibot";
import { sha256 } from "@shopper/utils";
import { sign, verify } from "../licence/keys";
import { manifest as manifestSchema, type Manifest } from "./schemas/base";

/** Shopper signs a release: every file's hash, the build date and the kind (`tooling/release/sign.ts`). */
export async function signManifest(
  releaseKey: string,
  fields: Omit<Manifest, "format" | "signature">,
) {
  const unsigned = { format: "rel/1" as const, ...fields };
  return { ...unsigned, signature: await sign(releaseKey, manifestMessage(unsigned)) };
}

/** The manifest when it is Shopper's, else why not. The public key is a build define, never box configuration. */
export async function readManifest(releaseKey: string, value: unknown) {
  const parsed = v.safeParse(manifestSchema, value);
  if (!parsed.success) return { ok: false, reason: "unreadable" } as const;
  if (!(await verify(releaseKey, manifestMessage(parsed.output), parsed.output.signature)))
    return { ok: false, reason: "forged" } as const;
  return { ok: true, manifest: parsed.output } as const;
}

/** The paths whose bytes differ from what was signed, or are not there: `read` gives a file's bytes. */
export async function changedFiles(
  manifest: Manifest,
  read: (path: string) => Promise<Uint8Array | undefined>,
) {
  const checked = await Promise.all(
    Object.entries(manifest.files).map(async ([path, hash]) => {
      const bytes = await read(path);
      return bytes && (await sha256(bytes)) === hash ? undefined : path;
    }),
  );
  return checked.filter((path) => path !== undefined);
}

function manifestMessage(m: Omit<Manifest, "signature">) {
  const files = Object.entries(m.files)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([path, hash]) => `${hash}  ${path}`);
  return [m.format, m.kind, m.version, m.builtAt, m.schemaVersion, ...files].join("\n");
}
