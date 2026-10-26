import { boxBlobs } from "@shopper/adapters-box";
import { createApi } from "@shopper/api";
import { afterAll } from "vite-plus/test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { rustfs } from "../../../tooling/storage/buckets";
import { db, auth, otherAuth } from "../../integration/auth/setup";
import { fileBucket } from "./buckets";

let directory: string;
let storage: Awaited<ReturnType<typeof boxBlobs>>;
export async function importStorage() {
  if (storage) return storage.blobs;
  directory = await mkdtemp(join(tmpdir(), "shopper-import-"));
  storage = await boxBlobs(directory, {
    baseUrl: "https://shopper.test/blobs",
    secret: new Uint8Array(32).fill(3),
    objectStorage: { ...rustfs, bucket: await fileBucket() },
  });
  return storage.blobs;
}

export async function importApi(other = false) {
  return createApi({
    database: db,
    authentication: other ? otherAuth : auth,
    blobs: await importStorage(),
  });
}

afterAll(async () => {
  if (directory) await rm(directory, { recursive: true, force: true });
});
