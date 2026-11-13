/// <reference types="node" />
// A Shopper Archive is a stored ZIP whose manifest.json lists every file's SHA-256 and carries Shopper's Ed25519
// signature, so a copy of a business can be checked with nothing but the file.
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vite-plus/test";
import { buildInfo } from "@shopper/config";
import { generateKey } from "@shopper/core/licence";
import { ARCHIVE_FORMAT, readZip, verifyArchive, zipBytes } from "@shopper/export";
import { sealedArchive } from "../../support/export/archive";

const decoder = new TextDecoder();

test("a sealed archive is a real ZIP that verifies, with exact counts and the signing key", async () => {
  const { bytes, key } = await sealedArchive();
  const dir = mkdtempSync(join(tmpdir(), "archive-"));
  writeFileSync(join(dir, "a.shopper"), bytes);
  // Any unzip tool must accept it: the format is not only what our own reader happens to read.
  expect(execFileSync("unzip", ["-t", join(dir, "a.shopper")]).toString()).toContain(
    "No errors detected",
  );
  const result = await verifyArchive(bytes);
  expect(result).toMatchObject({ ok: true, publicKey: key.publicKey });
  if (!result.ok) throw new Error(result.message);
  expect(result.manifest.archive_format).toBe(1);
  expect(result.manifest.tables.product.rows).toBe(3);
  expect(result.manifest.tables.product.files.map((file) => file.path)).toEqual([
    "tables/product/0001.ndjson",
    "tables/product/0002.ndjson",
  ]);
  expect(result.manifest.tables.sale.rows).toBe(1);
  expect(result.manifest.blobs).toHaveLength(1);
});

test("one flipped byte in a table file is found and named", async () => {
  const { bytes } = await sealedArchive();
  const at = indexOfText(bytes, "Sugar");
  bytes[at] = bytes[at]! ^ 1;
  expect(await verifyArchive(bytes)).toMatchObject({
    ok: false,
    reason: "changed",
    path: "tables/product/0002.ndjson",
  });
});

test("a flipped byte in a blob, in the manifest, or in the signature voids the archive", async () => {
  const blob = (await sealedArchive()).bytes;
  blob[indexOfBytes(blob, [137, 80, 78, 71])! + 5] ^= 1;
  expect(await verifyArchive(blob)).toMatchObject({ ok: false, path: "blobs/products/a.png" });

  const manifest = (await sealedArchive()).bytes;
  manifest[indexOfText(manifest, "Kofi Mart") + 1] ^= 1;
  expect(await verifyArchive(manifest)).toMatchObject({ ok: false, reason: "signature" });

  const signature = await sealedArchive();
  const files = readZip(signature.bytes);
  const bad = new Uint8Array(files.get("manifest.sig")!);
  bad[3] = bad[3]! ^ 1;
  expect(await verifyArchive(await rezip(files, { "manifest.sig": bad }))).toMatchObject({
    ok: false,
    reason: "signature",
  });
});

test("a missing, replaced or extra file is refused even when the ZIP itself is well formed", async () => {
  const { bytes } = await sealedArchive();
  const files = readZip(bytes);
  const without = new Map(files);
  without.delete("tables/sale/0001.ndjson");
  expect(await verifyArchive(await rezip(without))).toMatchObject({
    ok: false,
    reason: "missing",
    path: "tables/sale/0001.ndjson",
  });
  expect(
    await verifyArchive(
      await rezip(files, {
        // Same length, so only the hash can tell.
        "tables/sale/0001.ndjson": new TextEncoder().encode('{"id":"s1","total":999999}\n'),
      }),
    ),
  ).toMatchObject({ ok: false, reason: "changed", path: "tables/sale/0001.ndjson" });
  expect(
    await verifyArchive(await rezip(files, { "tables/sale/0002.ndjson": new Uint8Array([10]) })),
  ).toMatchObject({ ok: false, reason: "unlisted", path: "tables/sale/0002.ndjson" });
});

test("an archive re-signed by another key still checks out but names that other key", async () => {
  const original = await sealedArchive();
  const stranger = await generateKey();
  const forged = await sealedArchive({ key: stranger });
  const result = await verifyArchive(forged.bytes);
  expect(result).toMatchObject({ ok: true, publicKey: stranger.publicKey });
  expect(stranger.publicKey).not.toBe(original.key.publicKey);
  // Taking the original's manifest but the stranger's signature does not verify.
  const swapped = await rezip(readZip(original.bytes), {
    "manifest.sig": readZip(forged.bytes).get("manifest.sig")!,
  });
  expect(await verifyArchive(swapped)).toMatchObject({ ok: false, reason: "signature" });
});

test("a newer format is refused with a message that says to update, and a non-archive is refused", async () => {
  const result = await verifyArchive((await sealedArchive({ format: 2 })).bytes);
  expect(result).toMatchObject({ ok: false, reason: "newer" });
  if (result.ok) throw new Error("expected a refusal");
  expect(result.message).toBe(
    "This archive was made by a newer Shopper (archive format 2, Shopper 1.0.0). Update Shopper before importing it.",
  );
  expect(await verifyArchive(new Uint8Array([1, 2, 3, 4]))).toMatchObject({
    ok: false,
    reason: "unreadable",
  });
  expect(await verifyArchive(await zipBytes([]))).toMatchObject({
    ok: false,
    reason: "unreadable",
  });
  const noFormat = readZip((await sealedArchive()).bytes);
  const manifest = JSON.parse(decoder.decode(noFormat.get("manifest.json")!));
  delete manifest.archive_format;
  expect(
    await verifyArchive(
      await rezip(noFormat, {
        "manifest.json": new TextEncoder().encode(JSON.stringify(manifest)),
      }),
    ),
  ).toMatchObject({ ok: false, reason: "unreadable" });
});

async function rezip(files: Map<string, Uint8Array>, replace: Record<string, Uint8Array> = {}) {
  const { describeFile } = await import("@shopper/export");
  const all = new Map(files);
  for (const [path, bytes] of Object.entries(replace)) all.set(path, bytes);
  return zipBytes(
    await Promise.all(
      [...all].map(async ([path, bytes]) => ({
        ...(await describeFile(path, bytes)),
        read: async () => bytes,
      })),
    ),
  );
}

function indexOfText(bytes: Uint8Array, text: string) {
  return indexOfBytes(bytes, [...new TextEncoder().encode(text)])!;
}

function indexOfBytes(bytes: Uint8Array, needle: number[]) {
  for (let i = 0; i < bytes.length; i++)
    if (needle.every((byte, offset) => bytes[i + offset] === byte)) return i;
  return undefined;
}

test("the format this code writes is the one the build records", () => {
  expect(ARCHIVE_FORMAT).toBe(buildInfo.archiveFormat);
});
