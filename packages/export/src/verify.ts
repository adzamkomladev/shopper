import * as v from "valibot";
import { verify } from "@shopper/core/licence";
import { sha256 } from "@shopper/utils";
import { ARCHIVE_FORMAT, manifest as manifestSchema } from "./schemas/manifest";
import { readZip } from "./zip";

type Refusal = {
  ok: false;
  reason: "unreadable" | "newer" | "signature" | "missing" | "changed" | "unlisted";
  message: string;
  path?: string;
};

/**
 * Checks a `.shopper` file with nothing but itself: the manifest's signature, then every listed file's size, SHA-256
 * and row count, and that nothing else is in the ZIP. Returns the key that signed it so the importer can decide
 * whether it trusts that key.
 */
export async function verifyArchive(bytes: Uint8Array) {
  const files = readOrNothing(bytes);
  const manifestBytes = files?.get("manifest.json");
  const signature = files?.get("manifest.sig");
  if (!files || !manifestBytes || !signature)
    return refuse("unreadable", "This is not a Shopper Archive.");
  const text = new TextDecoder().decode(manifestBytes);
  const raw = parseJson(text);
  if (typeof raw?.archive_format !== "number")
    return refuse("unreadable", "This is not a Shopper Archive.");
  if (raw.archive_format > ARCHIVE_FORMAT)
    return refuse(
      "newer",
      `This archive was made by a newer Shopper (archive format ${raw.archive_format}, Shopper ${String(raw.product_version)}). Update Shopper before importing it.`,
    );
  const parsed = v.safeParse(manifestSchema, raw);
  if (!parsed.success) return refuse("unreadable", "This Shopper Archive's manifest is damaged.");
  const manifest = parsed.output;
  if (!(await verify(manifest.public_key, text, new TextDecoder().decode(signature))))
    return refuse("signature", "This archive's signature does not match its manifest.");

  const listed = [
    ...Object.values(manifest.tables).flatMap((table) => table.files),
    ...manifest.blobs,
  ];
  for (const file of listed) {
    const content = files.get(file.path);
    if (!content) return refuse("missing", `${file.path} is missing.`, file.path);
    const rows = "rows" in file ? file.rows : undefined;
    if (
      content.length !== file.bytes ||
      (await sha256(content)) !== file.sha256 ||
      (rows !== undefined && content.reduce((n, byte) => n + (byte === 10 ? 1 : 0), 0) !== rows)
    )
      return refuse("changed", `${file.path} was changed after it was signed.`, file.path);
  }
  const known = new Set([...listed.map((file) => file.path), "manifest.json", "manifest.sig"]);
  const extra = [...files.keys()].find((path) => !known.has(path));
  if (extra)
    return refuse("unlisted", `${extra} is in the archive but not in its manifest.`, extra);
  return { ok: true, manifest, publicKey: manifest.public_key } as const;
}

const refuse = (reason: Refusal["reason"], message: string, path?: string): Refusal => ({
  ok: false,
  reason,
  message,
  ...(path ? { path } : {}),
});

function readOrNothing(bytes: Uint8Array) {
  try {
    return readZip(bytes);
  } catch {
    return undefined;
  }
}

function parseJson(text: string) {
  try {
    return JSON.parse(text) as Record<string, unknown> | null;
  } catch {
    return undefined;
  }
}
