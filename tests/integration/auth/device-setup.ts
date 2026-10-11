// Shared device-service fixture for the device suites. Importing it registers the hooks.
import { afterAll, beforeAll } from "vite-plus/test";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { v7 } from "uuid";
import * as schema from "@shopper/db-pg";
import { createDeviceService } from "@shopper/auth/devices";
import { defineCommand } from "@shopper/audit";
import { migrateDatabase } from "../../../tooling/migrate";
import { provisionOrg, provisioningContext } from "../../../tooling/seed";
import { postgresFixture } from "../../fixtures/postgres";
import type { Cache } from "@shopper/ports";
import { boxCache } from "@shopper/adapters-box";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
export let fixture: Awaited<ReturnType<typeof postgresFixture>>;
export let pool: Pool;
export let db: import("@shopper/db-pg").ShopperDatabase;
export let service: ReturnType<typeof createDeviceService>;
export let principal: { orgId: string; userId: string; roleId: string; roleName: string };
export let branchId: string;
export const context = provisioningContext();
export let directory: string;
export let localCache: ReturnType<typeof boxCache>;
export let cache: Cache;
export const seed = defineCommand({
  name: "devices.test.seed",
  async run(tx, c) {
    const [store] = await tx
      .insert(schema.store)
      .values({ orgId: c.orgId, name: "Store" })
      .returning();
    const [branch] = await tx
      .insert(schema.branch)
      .values({ orgId: c.orgId, storeId: store!.id, name: "Branch" })
      .returning();
    const [user] = await tx
      .insert(schema.user)
      .values({ orgId: c.orgId, email: `${v7()}@example.com`, name: "Cashier" })
      .returning();
    const [role] = await tx
      .insert(schema.role)
      .values({ orgId: c.orgId, name: "cashier" })
      .returning();
    await tx.insert(schema.member).values({
      orgId: c.orgId,
      organizationId: c.orgId,
      userId: user!.id,
      roleId: role!.id,
      role: "member",
    });
    return { branchId: branch!.id, userId: user!.id, roleId: role!.id };
  },
  audit: () => ({}),
});
beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), "shopper-device-cache-"));
  localCache = boxCache(join(directory, "cache.sqlite"));
  cache = localCache.cache;
  fixture = await postgresFixture();
  pool = new Pool({ connectionString: fixture.connectionString });
  db = drizzle(pool, { schema });
  await migrateDatabase(db);
  await provisionOrg(db, context, { name: "Devices integration" });
  const seeded = await seed(db, context, {});
  branchId = seeded.branchId;
  principal = {
    orgId: context.orgId,
    userId: seeded.userId,
    roleId: seeded.roleId,
    roleName: "cashier",
  };
  service = createDeviceService(db, cache, context.appVersion);
});
afterAll(async () => {
  localCache?.close();
  if (directory) await rm(directory, { recursive: true, force: true });
  await pool?.end();
  await fixture?.close();
});
