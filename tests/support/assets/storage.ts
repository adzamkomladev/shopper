import { boxBlobs } from "@shopper/adapters-box";
import { createApi } from "@shopper/api";
import { afterAll } from "vite-plus/test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { db, auth, otherAuth } from "../../integration/auth/setup";

let directory: string;
let storage: Awaited<ReturnType<typeof boxBlobs>>;
export async function importStorage() {
  if (storage) return storage.blobs;
  directory = await mkdtemp(join(tmpdir(), "shopper-import-"));
  storage = await boxBlobs(directory, {
    baseUrl: "https://shopper.test/blobs",
    secret: new Uint8Array(32).fill(3),
    objectStorage: {
      endpoint: process.env.SHOPPER_S3_ENDPOINT ?? "http://127.0.0.1:9200",
      bucket: process.env.SHOPPER_S3_BUCKET ?? "shopper-imports-dev",
      accessKeyId: process.env.SHOPPER_S3_ACCESS_KEY_ID ?? "shopper_dev_access",
      secretAccessKey:
        process.env.SHOPPER_S3_SECRET_ACCESS_KEY ?? "shopper_dev_secret_at_least_32_chars",
      region: process.env.SHOPPER_S3_REGION ?? "us-east-1",
    },
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
