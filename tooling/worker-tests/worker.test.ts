import { SELF, env } from "cloudflare:test";
import { expect, test } from "vitest";

test("shared Hono API runs inside workerd and reports its baked version", async () => {
  const response = await SELF.fetch("https://shopper.test/health");
  expect(response.status).toBe(200);
  const data = (await response.json()) as {
    status: string;
    build: { version: string; schemaVersion: number };
  };
  expect(data.status).toBe("ok");
  expect(data.build.schemaVersion).toBe(2);
  expect(response.headers.get("Shopper-Version")).toBe(data.build.version);
  const missing = await SELF.fetch("https://shopper.test/missing");
  expect(missing.status).toBe(404);
  expect(missing.headers.get("Shopper-Version")).toBe(data.build.version);
});

import { eq } from "drizzle-orm";
import { v7 } from "uuid";
import * as schema from "../../packages/db-pg/src/schema";
import { defineCommand } from "../../packages/audit/src/index";
import {
  cloudflareDatabase,
  cloudflareCache,
  cloudflareBlobs,
  cloudflareSequencer,
} from "../../packages/adapters-cf/src/index";
import { cacheMigration } from "../../packages/db-sqlite/src/index";
import { portConformance } from "../../packages/conformance/src/index";
import { buildInfo } from "../../packages/config/src/index";
const provision = defineCommand({
  name: "conformance.provision",
  async run(tx, ctx) {
    await tx.insert(schema.org).values({ id: ctx.orgId, name: "Worker conformance" });
    const [row] = await tx
      .insert(schema.store)
      .values({ orgId: ctx.orgId, name: "Worker store" })
      .returning();
    return row!.id;
  },
  audit: (_input, storeId) => ({ storeId }),
});
portConformance("Cloudflare adapters in workerd", test, async () => {
  const bindings = env as {
    CACHE_DB: D1Database;
    BLOBS: R2Bucket;
    HYPERDRIVE: Hyperdrive;
    STORE_SEQUENCER: DurableObjectNamespace<
      import("../../packages/adapters-cf/src/coordination").StoreSequencer
    >;
  };
  await bindings.CACHE_DB.prepare(cacheMigration).run();
  const orgId = v7(),
    otherOrgId = v7();
  const connection = await cloudflareDatabase(bindings.HYPERDRIVE.connectionString);
  let storeId: string;
  try {
    storeId = await provision(connection.db, { orgId, appVersion: buildInfo.version }, undefined);
  } finally {
    await connection.close();
  }
  let time = Date.now();
  const now = () => time;
  const storage = await cloudflareBlobs(bindings.BLOBS, {
    baseUrl: "https://shopper.test/blobs",
    secret: crypto.getRandomValues(new Uint8Array(32)),
    now,
  });
  return {
    orgId,
    otherOrgId,
    storeId,
    cache: cloudflareCache(bindings.CACHE_DB, now),
    blobs: storage.blobs,
    sequencer: cloudflareSequencer(bindings.STORE_SEQUENCER),
    advanceClock: (ms) => {
      time += ms;
    },
    readSigned: storage.readSigned,
    async reopen() {
      return {
        cache: cloudflareCache(bindings.CACHE_DB, now),
        sequencer: cloudflareSequencer(bindings.STORE_SEQUENCER),
      };
    },
    async sequenceRecord() {
      const connection = await cloudflareDatabase(bindings.HYPERDRIVE.connectionString);
      try {
        const [row] = await connection.db
          .select()
          .from(schema.store)
          .where(eq(schema.store.id, storeId));
        return row!.lastSeq;
      } finally {
        await connection.close();
      }
    },
  };
});
