// /health/ready: what the uptime probe and a deploy smoke test ask before trusting a release.
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { boxCache, boxRateLimiter } from "@shopper/adapters-box";
import { serveRuntime, type RuntimeOptions } from "@shopper/api/runtime";
import { buildInfo } from "@shopper/config";
import * as schema from "@shopper/db-pg";
import { migrateDatabase } from "../../../tooling/database/migrate";
import { postgresFixture } from "../../fixtures/postgres";

let fixture: Awaited<ReturnType<typeof postgresFixture>>;
let pool: Pool;
let database: RuntimeOptions["database"];
const cache = boxCache(":memory:");

beforeAll(async () => {
  fixture = await postgresFixture();
  pool = new Pool({ connectionString: fixture.connectionString });
  database = drizzle(pool, { schema });
  await migrateDatabase(database);
});
afterAll(async () => {
  cache.close();
  await pool?.end();
  await fixture?.close();
});

const options = (overrides: Partial<RuntimeOptions> = {}): RuntimeOptions => ({
  database,
  cache: cache.cache,
  rateLimiter: boxRateLimiter(),
  secret: "ready-integration-secret-more-than-32-chars",
  baseURL: "https://portal.test",
  ...overrides,
});
const ready = (overrides?: Partial<RuntimeOptions>) =>
  serveRuntime(new Request("https://api.test/health/ready"), options(overrides));

test("a migrated database and a working cache answer 200 ready, never cached", async () => {
  const response = await ready();
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(response.headers.get("shopper-version")).toBe(buildInfo.version);
  expect(await response.json()).toEqual({
    status: "ready",
    checks: { database: "ok", schema: "ok", cache: "ok" },
  });
});

test("a database behind the build's schema is not ready", async () => {
  const [last] = (
    await database.execute(
      sql`delete from drizzle.__drizzle_migrations where id = (select id from drizzle.__drizzle_migrations order by created_at desc limit 1) returning id, hash, created_at`,
    )
  ).rows as { id: string; hash: string; created_at: string }[];
  try {
    const response = await ready();
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      status: "not ready",
      checks: { database: "ok", schema: "error", cache: "ok" },
    });
  } finally {
    await database.execute(
      sql`insert into drizzle.__drizzle_migrations (id, hash, created_at) values (${last!.id}, ${last!.hash}, ${last!.created_at})`,
    );
  }
});

test("an unreachable database or a failing cache is 503 and says nothing of the error", async () => {
  const down = new Pool({ connectionString: "postgresql://nobody:wrong@127.0.0.1:9/none" });
  const broken = {
    request: () => ({
      get: () => Promise.reject(new Error("secret cache detail")),
      put: () => Promise.reject(new Error("secret cache detail")),
      delete: () => Promise.reject(new Error("secret cache detail")),
    }),
  };
  try {
    const response = await ready({ database: drizzle(down, { schema }), cache: broken });
    expect(response.status).toBe(503);
    const text = await response.text();
    expect(JSON.parse(text)).toEqual({
      status: "not ready",
      checks: { database: "error", schema: "error", cache: "error" },
    });
    expect(text).not.toMatch(/secret|ECONNREFUSED|nobody/);
  } finally {
    await down.end();
  }
});
