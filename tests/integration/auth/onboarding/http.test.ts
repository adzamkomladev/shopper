import { beforeAll, afterAll, test, expect } from "vite-plus/test";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@shopper/db-pg";
import { createBoxApp } from "@shopper/box";
import { serveRuntime } from "@shopper/api/runtime";
import { boxAuthFlows, boxCache } from "@shopper/adapters-box";
import { createLinkToken } from "@shopper/auth";
import { postgresFixture } from "../../../fixtures/postgres";
import { migrateDatabase } from "../../../../tooling/database/migrate";
let fixture: Awaited<ReturnType<typeof postgresFixture>>;
let pool: Pool;
let db: schema.ShopperDatabase;
let launcher: ReturnType<typeof boxAuthFlows>;
const cache = boxCache(":memory:");
const secret = "http registration secret longer than thirty two chars";
const options = () => ({
  database: db,
  cache: cache.cache,
  secret,
  linkSecret: secret,
  baseURL: "http://localhost",
  clientIP: "192.0.2.100",
  authFlows: launcher,
  publicOnboarding: true,
});
const call = (path: string, body: unknown, extras = {}) =>
  serveRuntime(
    new Request(`http://localhost${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
    { ...options(), ...extras },
  );
beforeAll(async () => {
  fixture = await postgresFixture();
  pool = new Pool({ connectionString: fixture.connectionString });
  db = drizzle(pool, { schema });
  await migrateDatabase(db);
  launcher = boxAuthFlows({
    withDatabase: (run) => run(db),
    linkSecret: secret,
    baseURL: "http://localhost",
  });
});
afterAll(async () => {
  cache.close();
  await pool?.end();
  await fixture?.close();
});

test("cloud public onboarding runs before tenant selection and fixed-org boxes close registration", async () => {
  const body = {
    name: "Ama",
    email: "http-owner@example.com",
    shopName: "HTTP Mart",
    shopCode: "http-mart",
  };
  const started = await call("/onboarding/start", body);
  expect(started.status).toBe(201);
  const result = await started.json();
  expect(result.resendToken).toEqual(expect.any(String));
  const token = await createLinkToken(secret, "registration", result.id);
  expect(
    (await call("/onboarding/verify", { id: result.id, token }, { clientIP: "192.0.2.101" }))
      .status,
  ).toBe(200);
  const completed = await call(
    "/onboarding/complete",
    { id: result.id, token, password: "registration-password-123" },
    { clientIP: "192.0.2.102" },
  );
  expect(completed.status).toBe(200);
  expect((await call("/onboarding/start", body, { orgId: result.id })).status).toBe(403);
});

test("onboarding rejects cross-origin requests and forged resend capabilities", async () => {
  const request = new Request("http://localhost/onboarding/start", {
    method: "POST",
    headers: { Origin: "https://attacker.invalid", "content-type": "application/json" },
    body: "{}",
  });
  expect((await serveRuntime(request, options())).status).toBe(403);
  const started = await call(
    "/onboarding/start",
    { name: "Ama", email: "retry-owner@example.com", shopName: "Retry", shopCode: "retry-http" },
    { clientIP: "192.0.2.103" },
  );
  const result = await started.json();
  expect(
    (
      await call(
        `/onboarding/${result.id}/resend`,
        { resendToken: "wrong" },
        { clientIP: "192.0.2.104" },
      )
    ).status,
  ).toBe(410);
  expect(
    (
      await call(
        `/onboarding/${result.id}/resend`,
        { resendToken: result.resendToken },
        { clientIP: "192.0.2.105" },
      )
    ).status,
  ).toBe(200);
});

test("public link operations budget trusted peer IP rather than spoofed headers", async () => {
  const responses = await Promise.all(
    Array.from({ length: 4 }, (_, attempt) =>
      serveRuntime(
        new Request("http://localhost/onboarding/verify", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "X-Shopper-Client-IP": `203.0.113.${attempt}`,
          },
          body: JSON.stringify({ id: "019a1234-5678-7000-8000-123456789abc", token: "invalid" }),
        }),
        { ...options(), clientIP: "192.0.2.200" },
      ),
    ),
  );
  expect(responses.map((response) => response.status).sort((a, b) => a - b)).toEqual([
    410, 410, 410, 429,
  ]);
  expect(
    (
      await call(
        "/onboarding/verify",
        { id: "019a1234-5678-7000-8000-123456789abc", token: "invalid" },
        { clientIP: "192.0.2.201" },
      )
    ).status,
  ).toBe(410);
});

test("box registration is closed even when no fixed tenant is configured", async () => {
  const host = createBoxApp({
    DATABASE_URL: fixture.connectionString,
    SHOPPER_AUTH_SECRET: secret,
    SHOPPER_AUTH_URL: "http://localhost",
    SHOPPER_LINK_SECRET: secret,
    SHOPPER_CACHE_PATH: ":memory:",
  });
  const response = await host.fetch(
    new Request("http://localhost/onboarding/start", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    }),
  );
  expect(response.status).toBe(403);
});
