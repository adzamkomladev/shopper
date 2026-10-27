import { rm } from "node:fs/promises";
import { dropE2eDatabase } from "../database/e2e";
import { createBucket, dropBucket } from "../storage/buckets";
import { BUILT_APPS, e2eRun, RUNS } from "./run";

/**
 * Playwright global setup for a named run: its imports bucket, open to its own portal origins.
 * The returned teardown drops the run's database, bucket and folders so nothing is left behind.
 * Without a run id the fixed `shopper_e2e` database and `vp run storage:setup` bucket stay as they are.
 */
export default async function e2eRunSetup() {
  const id = e2eRun.id;
  if (!id) return;
  await createBucket(
    e2eRun.bucket,
    [5183, 5185].flatMap((port) => [
      e2eRun.url(port),
      e2eRun.url(port).replace("localhost", "127.0.0.1"),
    ]),
  );
  return async () => {
    await dropE2eDatabase();
    await dropBucket(e2eRun.bucket);
    for (const folder of [`${RUNS}/${id}`, ...BUILT_APPS.map((app) => `${app}/.runs/${id}`)])
      await rm(folder, { recursive: true, force: true });
  };
}
