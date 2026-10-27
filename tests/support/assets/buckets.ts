import { afterAll } from "vite-plus/test";
import { dropBucket, testBucket } from "../../../tooling/storage/buckets";

const created: Promise<string>[] = [];

/** A RustFS bucket of this test file's own, so files never share objects; dropped after the file. */
export function fileBucket() {
  const bucket = testBucket();
  created.push(bucket);
  return bucket;
}

afterAll(async () => {
  await Promise.all(created.splice(0).map(async (bucket) => dropBucket(await bucket)));
});
