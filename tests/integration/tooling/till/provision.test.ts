import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { createBoxApp } from "@shopper/box";
import * as schema from "@shopper/db-pg";
import { migrateDatabase } from "../../../../tooling/database/migrate";
import { provisionOrg, provisioningContext } from "../../../../tooling/database/seed";
import { provision } from "../../../../tooling/till/provision";
import { postgresFixture } from "../../../fixtures/postgres";

let fixture: Awaited<ReturnType<typeof postgresFixture>>;
let pool: Pool;
let host: ReturnType<typeof createBoxApp>;
const tenant = provisioningContext();
beforeAll(async () => {
  fixture = await postgresFixture();
  pool = new Pool({ connectionString: fixture.connectionString });
  const db = drizzle(pool, { schema });
  await migrateDatabase(db);
  await provisionOrg(db, tenant, { name: "Provision" });
  host = createBoxApp({
    DATABASE_URL: fixture.connectionString,
    SHOPPER_AUTH_SECRET: "provision-integration-secret-more-than-32-chars",
    SHOPPER_AUTH_URL: "http://localhost",
    SHOPPER_CACHE_PATH: ":memory:",
    SHOPPER_BOOTSTRAP_TOKEN: "provision-bootstrap",
    SHOPPER_ORG_ID: tenant.orgId,
  });
});
afterAll(async () => {
  await pool?.end();
  await fixture?.close();
});

test("provision enrolls with a code and writes a 0600 register.json", async () => {
  const send = (path: string, data: unknown, headers: Record<string, string> = {}) =>
    host.fetch(
      new Request(`http://localhost${path}`, {
        method: "POST",
        headers: { "content-type": "application/json", ...headers },
        body: JSON.stringify(data),
      }),
    );
  const signUp = await send(
    "/api/auth/sign-up/email",
    { email: "owner@provision.invalid", password: "provision-password-123", name: "Owner" },
    { "X-Shopper-Bootstrap-Token": "provision-bootstrap" },
  );
  expect(signUp.status).toBe(200);
  const owner = { cookie: signUp.headers.get("set-cookie")!.split(";")[0]! };
  const store = await (await send("/stores", { name: "Store" }, owner)).json();
  const branch = await (
    await send("/branches", { name: "Branch", storeId: store.id }, owner)
  ).json();
  const { code } = await (await send("/devices/enrollment", { branchId: branch.id }, owner)).json();

  const directory = await mkdtemp(join(tmpdir(), "shopper-provision-"));
  try {
    const out = join(directory, "user-data", "register.json");
    await provision({
      upstream: "http://localhost",
      org: tenant.orgId,
      code,
      name: "Front till",
      store: store.id,
      shop: "Osu Mart",
      out,
      fetch: (url, init) => host.fetch(new Request(url, init)),
    });
    expect((await stat(out)).mode & 0o777).toBe(0o600);
    const config = JSON.parse(await readFile(out, "utf8"));
    expect(config).toMatchObject({
      upstream: "http://localhost",
      identity: {
        orgId: tenant.orgId,
        storeId: store.id,
        branchId: branch.id,
        shopName: "Osu Mart",
        registerName: "Front till",
      },
      sqlitePath: join(directory, "user-data", "register.sqlite"),
    });
    expect(config.deviceToken).toMatch(/^[0-9a-f]{64}$/);
    // The code is single-use.
    await expect(
      provision({
        upstream: "http://localhost",
        org: tenant.orgId,
        code,
        name: "Again",
        store: store.id,
        shop: "Osu Mart",
        out,
        fetch: (url, init) => host.fetch(new Request(url, init)),
      }),
    ).rejects.toThrow("Enrollment failed (401)");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}, 60_000);

test("provision refuses a bad code, a plain-http upstream and a malformed response before writing", async () => {
  const directory = await mkdtemp(join(tmpdir(), "shopper-provision-"));
  const out = join(directory, "register.json");
  const base = { org: tenant.orgId, name: "Till", store: "s", shop: "Shop", out };
  const ok = () => new Response(JSON.stringify({ deviceId: "d" }), { status: 200 });
  try {
    await expect(
      provision({ ...base, upstream: "https://api.example.com", code: "12ab", fetch: ok }),
    ).rejects.toThrow("6 digits");
    await expect(
      provision({ ...base, upstream: "http://api.example.com", code: "123456", fetch: ok }),
    ).rejects.toThrow("https");
    await expect(
      provision({ ...base, upstream: "http://127.0.0.1:9", code: "123456", fetch: ok }),
    ).rejects.toThrow();
    await expect(stat(out)).rejects.toThrow();
    expect((await stat(directory)).isDirectory()).toBe(true);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
