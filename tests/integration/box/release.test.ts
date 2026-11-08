// The boot gate: the box starts only from a folder Shopper signed, and only as the signed binary.
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { appendFile, mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { generateKey } from "@shopper/core/licence";
import { postgresFixture } from "../../fixtures/postgres";
import { sealedBox, startSealed } from "../../support/box/sealed";
import { writeManifest } from "../../../tooling/release/sign";

let sealed: Awaited<ReturnType<typeof sealedBox>>;
let release: Awaited<ReturnType<typeof generateKey>>;
let database: Awaited<ReturnType<typeof postgresFixture>>;

beforeAll(async () => {
  release = await generateKey();
  database = await postgresFixture();
  sealed = await sealedBox({ SHOPPER_RELEASE_KEY: release.publicKey });
}, 300_000);
afterAll(async () => {
  await sealed?.close();
  await database?.close();
});

/** An installed folder: the binary, a stand-in engine, signed. */
async function installed(key = release.privateKey) {
  const install = await sealed.install();
  await mkdir(join(install.home, "engine"));
  await writeFile(join(install.home, "engine", "rivet-engine"), "engine v1".repeat(1000));
  await writeManifest(install.home, key, { kind: "install" });
  return install;
}
const start = (install: { home: string; binary: string }, dir = install.home) =>
  startSealed(install, {
    SHOPPER_RELEASE_DIR: dir,
    SHOPPER_EGRESS: "off",
    DATABASE_URL: database.connectionString,
    SHOPPER_AUTH_SECRET: "release-test-secret-0123456789abcdef",
    SHOPPER_AUTH_URL: "http://127.0.0.1:3001",
  });

test("a folder exactly as Shopper signed it starts", async () => {
  const box = await start(await installed());
  await box.stop();
});

test("a changed or missing engine, or a manifest not signed by Shopper, refuses to start and says which", async () => {
  const changed = await installed();
  await appendFile(join(changed.home, "engine", "rivet-engine"), "!");
  await expect(start(changed)).rejects.toThrow(
    /engine\/rivet-engine in .* is not what Shopper signed/,
  );

  const missing = await installed();
  await rm(join(missing.home, "engine", "rivet-engine"));
  await expect(start(missing)).rejects.toThrow(/engine\/rivet-engine/);

  const stranger = await generateKey();
  await expect(start(await installed(stranger.privateKey))).rejects.toThrow(
    /no genuine manifest \(forged\)/,
  );
});

test("a swapped binary is refused: the signed one is not this one, and this one is not the signed one", async () => {
  const signed = await installed();
  const other = await sealed.install();
  // This binary runs, but the folder it is checked against names another file as shopper-box.
  await expect(start(other, signed.home)).rejects.toThrow(/is not the signed shopper-box/);
  // The signed folder's binary is replaced after signing: the hash no longer matches.
  await writeFile(signed.binary, "not the box");
  await expect(start(other, signed.home)).rejects.toThrow(
    /shopper-box in .* is not what Shopper signed/,
  );
});
