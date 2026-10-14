import { SELF, env } from "cloudflare:test";
import { expect, test } from "vitest";
import { v7 } from "uuid";
import { defineCommand } from "@shopper/audit";
import * as schema from "@shopper/db-pg";
import { cloudflareDatabase } from "@shopper/adapters-cf";
import { cacheMigration } from "@shopper/db-sqlite";
import { buildInfo } from "@shopper/config";
import { provisionOrg } from "@shopper/core";
import { createProduct } from "@shopper/core/catalogue";
import { mutateManagement } from "@shopper/core/management";

const bindings = env as { HYPERDRIVE: Hyperdrive; CACHE_DB: D1Database };
const digest = async (value: string) =>
  Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");
const enroll = defineCommand({
  name: "worker.pull.enroll",
  async run(tx, ctx, input: { branchId: string; token: string }) {
    const [row] = await tx
      .insert(schema.device)
      .values({ orgId: ctx.orgId, branchId: input.branchId, name: "Worker till" })
      .returning();
    await tx.insert(schema.deviceCredential).values({
      orgId: ctx.orgId,
      deviceId: row!.id,
      tokenHash: await digest(input.token),
    });
    return row!.id;
  },
  audit: (_input, deviceId) => ({ deviceId }),
});

test("GET /sync/changes in workerd serves a device's store feed in the shared JSON shape", async () => {
  const orgId = v7();
  const context = { orgId, appVersion: buildInfo.version, reason: "Worker pull" };
  const token = Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
  await bindings.CACHE_DB.prepare(cacheMigration).run();
  const connection = await cloudflareDatabase(bindings.HYPERDRIVE.connectionString);
  let deviceId: string;
  const products: string[] = [];
  try {
    await provisionOrg(connection.db, context, {
      name: "Worker pull",
      metadata: {
        schemaVersion: buildInfo.schemaVersion,
        syncProtocol: buildInfo.syncProtocol,
        archiveFormat: buildInfo.archiveFormat,
      },
    });
    const store = await mutateManagement(connection.db, context, {
      kind: "store",
      action: "create",
      data: { name: "Worker pull store" },
    });
    const branch = await mutateManagement(connection.db, context, {
      kind: "branch",
      action: "create",
      data: { name: "Worker pull branch", storeId: store.id },
    });
    deviceId = await enroll(connection.db, context, { branchId: branch.id, token });
    for (const name of ["First", "Second"])
      products.push(
        (
          await createProduct(connection.db, context, {
            sku: `WORKER-${v7()}`,
            name,
            baseUnit: "each",
            taxClass: "standard",
          })
        ).id,
      );
  } finally {
    await connection.close();
  }
  const headers = {
    authorization: `Bearer ${token}`,
    "X-Shopper-Device": deviceId,
    "X-Shopper-Protocol": String(buildInfo.syncProtocol),
  };
  const pull = (query: string, extra: Record<string, string> = headers) =>
    SELF.fetch(`https://shopper.test/sync/changes?${query}`, { headers: extra });

  const snapshot = await pull("cursor=0");
  expect(snapshot.status).toBe(200);
  expect(await snapshot.json()).toEqual({ snapshot: true, head: "2" });

  const page = await pull("cursor=1&limit=500");
  expect(page.status).toBe(200);
  expect(await page.json()).toEqual({
    changes: [
      {
        seq: "2",
        id: expect.any(String),
        entity: "product",
        entityId: products[1],
        op: "upsert",
        v: 1,
        payload: expect.objectContaining({ id: products[1], orgId, name: "Second" }),
      },
    ],
    cursor: "2",
    head: "2",
    hasMore: false,
  });

  expect((await pull("cursor=1&limit=501")).status).toBe(400);
  expect((await pull("cursor=1", { ...headers, "X-Shopper-Protocol": "99" })).status).toBe(409);
  expect(
    (await pull("cursor=1", { ...headers, authorization: `Bearer ${"0".repeat(64)}` })).status,
  ).toBe(401);
  expect((await pull("cursor=1", { ...headers, "X-Shopper-Org": v7() })).status).toBe(401);
});
