import { sign } from "@shopper/core/licence";
import { sha256 } from "@shopper/utils";
import { ARCHIVE_FORMAT, type Manifest } from "./schemas/manifest";
import type { FileDescription } from "./types";
import { crc32 } from "./zip";

export async function describeFile(path: string, bytes: Uint8Array): Promise<FileDescription> {
  return {
    path,
    bytes: bytes.length,
    sha256: await sha256(bytes),
    crc: crc32(bytes),
    // One NDJSON line per row, each ended by a newline.
    rows: path.endsWith(".ndjson") ? bytes.reduce((n, byte) => n + (byte === 10 ? 1 : 0), 0) : 0,
  };
}

/** The manifest for described `tables/<table>/<n>.ndjson` and `blobs/<key>` files (in path order). */
export function buildManifest(
  meta: {
    productVersion: string;
    schemaVersion: number;
    createdAt: string;
    publicKey: string;
    org: Manifest["org"];
  },
  files: FileDescription[],
): Manifest {
  const tables: Manifest["tables"] = {};
  const sorted = [...files].sort((a, b) => a.path.localeCompare(b.path));
  for (const file of sorted) {
    const name = /^tables\/([^/]+)\//.exec(file.path)?.[1];
    if (!name) continue;
    const table = (tables[name] ??= { rows: 0, files: [] });
    table.rows += file.rows;
    table.files.push({ path: file.path, bytes: file.bytes, sha256: file.sha256, rows: file.rows });
  }
  return {
    archive_format: ARCHIVE_FORMAT,
    product_version: meta.productVersion,
    schema_version: meta.schemaVersion,
    created_at: meta.createdAt,
    public_key: meta.publicKey,
    org: meta.org,
    tables,
    blobs: sorted
      .filter((file) => file.path.startsWith("blobs/"))
      .map((file) => ({ path: file.path, bytes: file.bytes, sha256: file.sha256 })),
  };
}

/** The exact bytes of `manifest.json` and the Ed25519 signature over them that goes in `manifest.sig`. */
export async function signManifest(manifest: Manifest, privateKey: string) {
  const json = new TextEncoder().encode(`${JSON.stringify(manifest, null, 2)}\n`);
  return { json, signature: await sign(privateKey, new TextDecoder().decode(json)) };
}
