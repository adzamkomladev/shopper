import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import * as schema from "@shopper/db-pg";
import { boxCache } from "@shopper/adapters-box";
import { serveRuntime, type RuntimeOptions } from "@shopper/api/runtime";
import { migrateDatabase } from "../../../tooling/database/migrate";
import { provisionOrg, provisioningContext } from "../../../tooling/database/seed";
import { postgresFixture } from "../../fixtures/postgres";

let fixture: Awaited<ReturnType<typeof postgresFixture>>;
let pool: Pool;
let db: RuntimeOptions["database"];
const cache = boxCache(":memory:");
const mart = provisioningContext();
const annex = provisioningContext();
const martSlug = `mart-${mart.orgId.slice(-12)}`;
const annexSlug = `annex-${annex.orgId.slice(-12)}`;

beforeAll(async () => {
  fixture = await postgresFixture();
  pool = new Pool({ connectionString: fixture.connectionString });
  db = drizzle(pool, { schema });
  await migrateDatabase(db);
  await provisionOrg(db, mart, { name: "Mart", slug: martSlug });
  await provisionOrg(db, annex, { name: "Annex", slug: annexSlug });
});
afterAll(async () => {
  cache.close();
  await pool?.end();
  await fixture?.close();
});

// No session and no tenant header on any request below: the lookup is how a browser finds the tenant.
const options = (orgId?: string): RuntimeOptions => ({
  database: db,
  cache: cache.cache,
  secret: "org-lookup-integration-secret-more-than-32-chars",
  baseURL: "http://localhost",
  orgId,
});
const get = (path: string, orgId?: string) =>
  serveRuntime(new Request(`http://localhost${path}`), options(orgId));

test("provisionOrg stores the slug it is given", async () => {
  const [row] = await db.select().from(schema.org).where(eq(schema.org.id, mart.orgId));
  expect(row!.slug).toBe(martSlug);
});

test("a shop code resolves to only the org id and name, without a session or tenant header", async () => {
  const response = await get(`/orgs/${martSlug}`);
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ id: mart.orgId, name: "Mart" });
});

test("the shop code ignores case and surrounding spaces", async () => {
  const response = await get(`/orgs/${encodeURIComponent(`  ${martSlug.toUpperCase()} `)}`);
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ id: mart.orgId, name: "Mart" });
});

test("an unknown shop code is a 404", async () => {
  expect((await get("/orgs/no-such-shop")).status).toBe(404);
  expect((await get("/orgs/50%25off")).status).toBe(404);
});

test("in the cloud there is no current org", async () => {
  expect((await get("/orgs/current")).status).toBe(404);
});

test("on the box /orgs/current is the fixed org and no other shop code resolves", async () => {
  const current = await get("/orgs/current", mart.orgId);
  expect(current.status).toBe(200);
  expect(await current.json()).toEqual({ id: mart.orgId, name: "Mart" });
  expect((await get(`/orgs/${martSlug}`, mart.orgId)).status).toBe(200);
  expect((await get(`/orgs/${annexSlug}`, mart.orgId)).status).toBe(404);
});
