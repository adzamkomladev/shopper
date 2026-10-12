import { beforeAll, afterAll, test, expect } from "vite-plus/test";
import { drizzle } from "drizzle-orm/node-postgres";
import { v7 } from "uuid";
import * as schema from "@shopper/db-pg";
import { createApi } from "@shopper/api";
import { mutateManagement } from "@shopper/core/management";
import { migrateDatabase } from "../../../tooling/database/migrate";
import { provisionOrg, provisioningContext } from "../../../tooling/database/seed";
import { postgresFixture } from "../../fixtures/postgres";
let fixture: Awaited<ReturnType<typeof postgresFixture>>;
let db: import("@shopper/db-pg").ShopperDatabase;
const context = provisioningContext();
const other = provisioningContext();
const userId = v7();
beforeAll(async () => {
  fixture = await postgresFixture();
  db = drizzle(fixture.client, { schema });
  await migrateDatabase(db);
  await provisionOrg(db, context, { name: "Management" });
  await provisionOrg(db, other, { name: "Other" });
  await db
    .insert(schema.user)
    .values({ id: userId, orgId: context.orgId, email: "admin@test.invalid", name: "Admin" });
});
afterAll(async () => {
  await fixture?.close();
});
test("management routes enforce permissions and tenant boundaries and atomically audit CRUD", async () => {
  const principal = { orgId: context.orgId, userId, roleId: v7(), roleName: "Super Admin" };
  let authenticated = true;
  let allowed = true;
  const api = createApi({
    database: db,
    authentication: {
      resolvePrincipal: async () => (authenticated ? principal : null),
      hasPermission: async () => allowed,
    },
  });
  const request = (path: string, method = "GET", data?: unknown) =>
    api.request(path, {
      method,
      ...(data === undefined
        ? {}
        : { headers: { "content-type": "application/json" }, body: JSON.stringify(data) }),
    });
  authenticated = false;
  expect((await request("/stores")).status).toBe(401);
  authenticated = true;
  allowed = false;
  expect((await request("/stores", "POST", { name: "Denied" })).status).toBe(403);
  allowed = true;
  expect((await request("/stores", "POST", { name: " " })).status).toBe(400);
  expect((await request("/stores", "POST", { name: "Bad", orgId: other.orgId })).status).toBe(400);
  const created = await request("/stores", "POST", { name: "Store", cashRoundingStep: 100 });
  expect(created.status).toBe(201);
  const store = await created.json();
  expect(store.lastSeq).toBe("0");
  expect((await request(`/stores/${store.id}`, "PATCH", { name: "Renamed" })).status).toBe(200);
  const foreign = await mutateManagement(db, other, {
    kind: "store",
    action: "create",
    data: { name: "Other" },
  });
  expect((await request(`/stores/${foreign.id}`)).status).toBe(404);
  expect((await request(`/stores/${foreign.id}`, "DELETE")).status).toBe(404);
  expect((await request("/branches", "POST", { name: "Bad", storeId: foreign.id })).status).toBe(
    404,
  );
  const branchResponse = await request("/branches", "POST", { name: "Branch", storeId: store.id });
  expect(branchResponse.status).toBe(201);
  const branch = await branchResponse.json();
  expect((await request(`/stores/${store.id}`, "DELETE")).status).toBe(409);
  expect(
    (await request(`/branches/${branch.id}`, "PATCH", { name: "Branch renamed" })).status,
  ).toBe(200);
  expect((await request(`/branches/${branch.id}`, "DELETE")).status).toBe(204);
  expect((await request(`/branches/${branch.id}`)).status).toBe(404);
  expect((await request(`/stores/${store.id}`, "DELETE")).status).toBe(204);
  const logs = await fixture.client.query(
    "SELECT * FROM audit_log WHERE command = 'management.mutate' AND org_id = $1 ORDER BY chain_seq",
    [context.orgId],
  );
  expect(logs.rows).toHaveLength(6);
  expect(logs.rows[1].before.name).toBe("Store");
  expect(logs.rows[1].after.name).toBe("Renamed");
  expect(logs.rows[5].after).toBeNull();
  expect(logs.rows[5].actor_id).toBe(userId);
  await expect(
    mutateManagement(
      db,
      { ...context, actorId: v7() },
      { kind: "store", action: "create", data: { name: "Rollback" } },
    ),
  ).rejects.toThrow();
  const rollback = await fixture.client.query("SELECT id FROM store WHERE name = 'Rollback'");
  expect(rollback.rowCount).toBe(0);
});
