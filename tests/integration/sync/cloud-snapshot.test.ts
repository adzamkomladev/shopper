import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { unstable_dev, type Unstable_DevWorker } from "wrangler";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { cacheMigration } from "@shopper/db-sqlite";
import { buildDefines } from "../../../tooling/build/info";
import { context, databaseConnectionString } from "../../support/till/server";
import { pullHeaders, storeId } from "../../support/till/pull";

let directory: string;
let worker: Unstable_DevWorker;

beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), "shopper-cloud-snapshot-"));
  const entry = join(directory, "worker.ts");
  await writeFile(
    entry,
    `import edge from ${JSON.stringify(resolve("apps/edge/src/worker.ts"))};
export default { async fetch(request, env) {
  await env.CACHE_DB.prepare(${JSON.stringify(cacheMigration)}).run();
  return edge.fetch(request, env);
} };`,
  );
  const config = {
    name: "shopper-cloud-snapshot-test",
    main: entry,
    compatibility_date: "2026-10-05",
    compatibility_flags: ["nodejs_compat"],
    define: buildDefines,
    hyperdrive: [
      {
        binding: "HYPERDRIVE",
        id: "snapshot-test",
        localConnectionString: databaseConnectionString(),
      },
    ],
    d1_databases: [
      { binding: "CACHE_DB", database_name: "snapshot-test", database_id: "snapshot-test" },
    ],
    r2_buckets: [{ binding: "BLOBS", bucket_name: "snapshot-test" }],
    vars: {
      SHOPPER_AUTH_SECRET: "snapshot-test-secret-that-is-at-least-32-characters",
      SHOPPER_AUTH_URL: "https://shopper.test",
      SHOPPER_BOOTSTRAP_TOKEN: "snapshot-test-bootstrap-token",
      SHOPPER_LINK_SECRET: "snapshot-test-link-secret-that-is-32-characters",
    },
  };
  const configPath = join(directory, "wrangler.json");
  await writeFile(configPath, JSON.stringify(config));
  worker = await unstable_dev(config.main, {
    config: configPath,
    ip: "127.0.0.1",
    port: 0,
    local: true,
    persist: false,
    logLevel: "error",
    experimental: { forceLocal: true, watch: false, disableExperimentalWarning: true },
  });
});

afterAll(async () => {
  await worker?.stop();
  if (directory) await rm(directory, { recursive: true, force: true });
});

test("Cloudflare returns a single-decompressed snapshot over external HTTP", async () => {
  const response = await fetch(`http://${worker.address}:${worker.port}/sync/snapshot`, {
    headers: pullHeaders(),
  });
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ orgId: context.orgId, storeId, v: 1 });
});
