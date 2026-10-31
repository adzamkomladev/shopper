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
  expect(data.build.schemaVersion).toBe(buildInfo.schemaVersion);
  expect(response.headers.get("Shopper-Version")).toBe(data.build.version);
  const missing = await SELF.fetch("https://shopper.test/missing");
  expect(missing.status).toBe(404);
  expect(missing.headers.get("Shopper-Version")).toBe(data.build.version);
});

import { eq } from "drizzle-orm";
import { v7 } from "uuid";
import * as schema from "@shopper/db-pg";
import { defineCommand } from "@shopper/audit";
import {
  cloudflareDatabase,
  cloudflareCache,
  cloudflareBlobs,
  cloudflareSequencer,
  cloudflareWorkflow,
} from "@shopper/adapters-cf";
import { cacheMigration } from "@shopper/db-sqlite";
import { portConformance } from "@shopper/conformance";
import { buildInfo } from "@shopper/config";
import { provisionOrg } from "@shopper/core";
import { provisionPendingSale } from "@shopper/tests/support/till/pending/sale";
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
const createStore = defineCommand({
  name: "conformance.create-store",
  async run(tx, ctx) {
    const [row] = await tx
      .insert(schema.store)
      .values({ orgId: ctx.orgId, name: "Worker conformance" })
      .returning();
    if (!row) throw new Error("Expected Worker store");
    return row.id;
  },
  audit: (_input, storeId) => ({ storeId }),
});
portConformance("Cloudflare adapters in workerd", test, async () => {
  const bindings = env as {
    CACHE_DB: D1Database;
    BLOBS: R2Bucket;
    HYPERDRIVE: Hyperdrive;
    STORE_SEQUENCER: DurableObjectNamespace<
      import("@shopper/adapters-cf/coordination").StoreSequencer
    >;
  };
  await bindings.CACHE_DB.prepare(cacheMigration).run();
  const orgId = v7(),
    otherOrgId = v7();
  const connection = await cloudflareDatabase(bindings.HYPERDRIVE.connectionString);
  let storeId: string;
  try {
    await provisionOrg(
      connection.db,
      { orgId, appVersion: buildInfo.version },
      {
        name: "Worker conformance",
        metadata: {
          schemaVersion: buildInfo.schemaVersion,
          syncProtocol: buildInfo.syncProtocol,
          archiveFormat: buildInfo.archiveFormat,
        },
      },
    );
    await provisionOrg(
      connection.db,
      { orgId: otherOrgId, appVersion: buildInfo.version },
      {
        name: "Other Worker conformance",
        metadata: {
          schemaVersion: buildInfo.schemaVersion,
          syncProtocol: buildInfo.syncProtocol,
          archiveFormat: buildInfo.archiveFormat,
        },
      },
    );
    storeId = await createStore(connection.db, { orgId, appVersion: buildInfo.version }, undefined);
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
    workflow: cloudflareWorkflow,
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
    async provisionPendingSale() {
      const connection = await cloudflareDatabase(bindings.HYPERDRIVE.connectionString);
      try {
        return await provisionPendingSale(
          connection.db,
          { orgId, appVersion: buildInfo.version },
          storeId,
          otherOrgId,
          buildInfo.version,
          async (run) => {
            const live = await cloudflareDatabase(bindings.HYPERDRIVE.connectionString);
            try {
              return await run(live.db);
            } finally {
              await live.close();
            }
          },
        );
      } finally {
        await connection.close();
      }
    },
  };
});

test("real Worker auth session authorizes audited store routes", async () => {
  const bindings = env as { HYPERDRIVE: Hyperdrive; CACHE_DB: D1Database };
  const connection = await cloudflareDatabase(bindings.HYPERDRIVE.connectionString);
  const orgId = v7();
  try {
    await provision(connection.db, { orgId, appVersion: buildInfo.version }, undefined);
    await bindings.CACHE_DB.prepare(cacheMigration).run();
    const headers = {
      "content-type": "application/json",
      "X-Shopper-Org": orgId,
      "X-Shopper-Bootstrap-Token": "integration-bootstrap-token",
    };
    const signup = await SELF.fetch("https://shopper.test/api/auth/sign-up/email", {
      method: "POST",
      headers,
      body: JSON.stringify({
        name: "Owner",
        email: `${orgId}@worker.invalid`,
        password: "integration-password-123",
      }),
    });
    expect(signup.status).toBe(200);
    const signin = await SELF.fetch("https://shopper.test/api/auth/sign-in/email", {
      method: "POST",
      headers,
      body: JSON.stringify({
        email: `${orgId}@worker.invalid`,
        password: "integration-password-123",
      }),
    });
    expect(signin.status).toBe(200);
    const cookie = signin.headers.get("set-cookie")?.split(";")[0];
    expect(cookie).toBeTruthy();
    const created = await SELF.fetch("https://shopper.test/stores", {
      method: "POST",
      // A cookie write names its origin, the way a browser does, or it is refused as cross-site.
      headers: { ...headers, cookie: cookie!, Origin: "https://shopper.test" },
      body: JSON.stringify({ name: "Authenticated Worker store" }),
    });
    expect(created.status).toBe(201);
    const store = (await created.json()) as { id: string; lastSeq: string };
    expect(store.lastSeq).toBe("0");
    const listed = await SELF.fetch("https://shopper.test/stores", {
      headers: { "X-Shopper-Org": orgId, cookie: cookie! },
    });
    expect(listed.status).toBe(200);
    expect(await listed.json()).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: store.id })]),
    );
  } finally {
    await connection.close();
  }
});
