// A release manifest is Shopper's word on every file, the kind and the build date; changing any of them voids it.
import { expect, test } from "vite-plus/test";
import { generateKey } from "@shopper/core/licence";
import { changedFiles, readManifest, signManifest } from "@shopper/core/release";

const file = "a".repeat(64);
const fields = {
  kind: "update" as const,
  version: "1.0.0",
  builtAt: "2026-11-10T08:00:00.000Z",
  schemaVersion: 41,
  files: { "shopper-box": file, "engine/rivet-engine": "b".repeat(64) },
};

test("a manifest verifies for its own key, and any changed field, file or key voids it", async () => {
  const shopper = await generateKey();
  const manifest = await signManifest(shopper.privateKey, fields);
  expect((await readManifest(shopper.publicKey, manifest)).ok).toBe(true);
  // The key order of the files does not matter; their content does.
  expect(
    (
      await readManifest(shopper.publicKey, {
        ...manifest,
        files: Object.fromEntries(Object.entries(manifest.files).reverse()),
      })
    ).ok,
  ).toBe(true);
  for (const tampered of [
    { ...manifest, kind: "install" },
    { ...manifest, builtAt: "2027-01-01T00:00:00.000Z" },
    { ...manifest, version: "9.9.9" },
    { ...manifest, files: { ...manifest.files, "shopper-box": "c".repeat(64) } },
    { ...manifest, files: { ...manifest.files, extra: file } },
  ])
    expect(await readManifest(shopper.publicKey, tampered)).toEqual({
      ok: false,
      reason: "forged",
    });
  const stranger = await generateKey();
  expect(await readManifest(stranger.publicKey, manifest)).toEqual({ ok: false, reason: "forged" });
  expect(await readManifest(shopper.publicKey, { format: "rel/1" })).toEqual({
    ok: false,
    reason: "unreadable",
  });
});

test("changedFiles names every file that differs or is missing", async () => {
  const { sha256 } = await import("@shopper/utils");
  const same = new TextEncoder().encode("same");
  const manifest = await signManifest((await generateKey()).privateKey, {
    ...fields,
    files: { kept: await sha256(same), edited: await sha256(same), gone: await sha256(same) },
  });
  const bytes: Record<string, Uint8Array> = {
    kept: same,
    edited: new TextEncoder().encode("other"),
  };
  expect(
    (await changedFiles(manifest, async (path) => bytes[path])).sort((a, b) => a.localeCompare(b)),
  ).toEqual(["edited", "gone"]);
});
