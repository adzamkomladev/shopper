import { beforeAll, afterAll, expect, test } from "vite-plus/test";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import * as schema from "@shopper/db-pg";
import { createBoxApp } from "@shopper/box";
import { migrateDatabase } from "../../../tooling/database/migrate";
import { provisionOrg, provisioningContext } from "../../../tooling/database/seed";
import { postgresFixture } from "../../fixtures/postgres";
let fixture: Awaited<ReturnType<typeof postgresFixture>>;
let pool: Pool;
let db: import("@shopper/db-pg").ShopperDatabase;
const tenant = provisioningContext();
const other = provisioningContext();
let host: ReturnType<typeof createBoxApp>;
beforeAll(async () => {
  fixture = await postgresFixture();
  pool = new Pool({ connectionString: fixture.connectionString });
  db = drizzle(pool, { schema });
  await migrateDatabase(db);
  await provisionOrg(db, tenant, { name: "Runtime" });
  await provisionOrg(db, other, { name: "Other runtime" });
  host = createBoxApp({
    DATABASE_URL: fixture.connectionString,
    SHOPPER_AUTH_SECRET: "runtime-integration-secret-more-than-32-chars",
    SHOPPER_AUTH_URL: "http://localhost",
    SHOPPER_CACHE_PATH: ":memory:",
    SHOPPER_BOOTSTRAP_TOKEN: "runtime-bootstrap",
    SHOPPER_ORG_ID: tenant.orgId,
  });
});
afterAll(async () => {
  await pool?.end();
  await fixture?.close();
});
test("box sessions and device HTTP flow enforce origin, tenant, branch, and till restrictions", async () => {
  const send = (
    path: string,
    data?: unknown,
    headers: Record<string, string> = {},
    method = data === undefined ? "GET" : "POST",
  ) =>
    host.fetch(
      new Request(`http://localhost${path}`, {
        method,
        headers: { "content-type": "application/json", ...headers },
        ...(data === undefined ? {} : { body: JSON.stringify(data) }),
      }),
    );
  const credentials = {
    email: "owner@runtime.invalid",
    password: "runtime-password-123",
    name: "Owner",
  };
  expect(
    (
      await send("/api/auth/sign-up/email", credentials, {
        "X-Shopper-Bootstrap-Token": "runtime-bootstrap",
      })
    ).status,
  ).toBe(200);
  const signin = await send("/api/auth/sign-in/email", {
    email: credentials.email,
    password: credentials.password,
  });
  expect(signin.status).toBe(200);
  const cookie = signin.headers.get("set-cookie")!.split(";")[0]!;
  const owner = { cookie, Origin: "http://localhost" };
  const denied = await send(
    "/stores",
    { name: "CSRF" },
    { cookie, Origin: "https://evil.invalid", "content-type": "text/plain" },
  );
  expect(denied.status).toBe(403);
  const storeResponse = await send("/stores", { name: "Store" }, owner);
  expect(storeResponse.status).toBe(201);
  const store = await storeResponse.json();
  const branchResponse = await send("/branches", { name: "Branch", storeId: store.id }, owner);
  expect(branchResponse.status).toBe(201);
  const branch = await branchResponse.json();
  const issuedResponse = await send("/devices/enrollment", { branchId: branch.id }, owner);
  expect(issuedResponse.status).toBe(201);
  const issued = await issuedResponse.json();
  expect(
    (await send("/devices/enroll", { orgId: other.orgId, code: issued.code, name: "Wrong tenant" }))
      .status,
  ).toBe(401);
  expect(
    (
      await send(
        "/devices/enroll",
        { orgId: tenant.orgId, code: issued.code, name: "Wrong selector" },
        { "X-Shopper-Org": other.orgId },
      )
    ).status,
  ).toBe(400);
  const enrolledResponse = await send("/devices/enroll", {
    orgId: tenant.orgId,
    code: issued.code,
    name: "Till",
  });
  expect(enrolledResponse.status).toBe(201);
  const enrolled = await enrolledResponse.json();
  const [user] = await db
    .select()
    .from(schema.user)
    .where(eq(schema.user.email, credentials.email));
  expect((await send("/cashiers/pin", { userId: user!.id, pin: "1234" }, owner)).status).toBe(200);
  const loggedInResponse = await send("/cashiers/login", {
    deviceId: enrolled.deviceId,
    deviceToken: enrolled.deviceToken,
    userId: user!.id,
    pin: "1234",
  });
  expect(loggedInResponse.status).toBe(200);
  const loggedIn = await loggedInResponse.json();
  const deviceHeaders = {
    authorization: `Bearer ${loggedIn.token}`,
    "X-Shopper-Device-Token": enrolled.deviceToken,
  };
  expect((await send("/stores", undefined, deviceHeaders)).status).toBe(403);
  expect((await send("/stores", { name: "PIN owner denied" }, deviceHeaders)).status).toBe(403);
  expect((await send("/tax-rules?on=2026-01-01", undefined, deviceHeaders)).status).toBe(403);
  const [session] = await db
    .select()
    .from(schema.cashierSession)
    .where(eq(schema.cashierSession.deviceId, enrolled.deviceId));
  expect(session!.branchId).toBe(branch.id);
  const crossTenantHost = createBoxApp({
    DATABASE_URL: fixture.connectionString,
    SHOPPER_AUTH_SECRET: "runtime-integration-secret-more-than-32-chars",
    SHOPPER_AUTH_URL: "http://localhost",
    SHOPPER_CACHE_PATH: ":memory:",
    SHOPPER_ORG_ID: other.orgId,
  });
  const cross = await crossTenantHost.fetch(
    new Request("http://localhost/cashiers/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        deviceId: enrolled.deviceId,
        deviceToken: enrolled.deviceToken,
        userId: user!.id,
        pin: "1234",
      }),
    }),
  );
  expect(cross.status).toBe(401);
  expect((await send("/devices/revoke", { deviceId: enrolled.deviceId }, owner)).status).toBe(200);
  expect((await send("/tax-rules?on=2026-01-01", undefined, deviceHeaders)).status).toBe(401);
});

test("box ignores caller IP spoofing when limiting password attempts", async () => {
  const runtime = createBoxApp({
    DATABASE_URL: fixture.connectionString,
    SHOPPER_AUTH_SECRET: "runtime-integration-secret-more-than-32-chars",
    SHOPPER_AUTH_URL: "http://localhost",
    SHOPPER_ORG_ID: tenant.orgId,
    SHOPPER_CACHE_PATH: ":memory:",
  });
  let status = 0;
  for (let attempt = 0; attempt < 4; attempt++) {
    const response = await runtime.fetch(
      new Request("http://localhost/api/auth/sign-in/email", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "X-Shopper-Client-IP": `203.0.113.${attempt + 1}`,
          "X-Forwarded-For": `203.0.113.${attempt + 1}`,
        },
        body: JSON.stringify({ email: "nonexistent@runtime.invalid", password: "wrong-password" }),
      }),
      { requestIP: () => ({ address: "192.0.2.40" }) },
    );
    status = response.status;
    expect([401, 429]).toContain(status);
  }
  expect(status).toBe(429);
  const differentPeer = await runtime.fetch(
    new Request("http://localhost/api/auth/sign-in/email", {
      method: "POST",
      headers: { "content-type": "application/json", "X-Shopper-Client-IP": "192.0.2.40" },
      body: JSON.stringify({ email: "nonexistent@runtime.invalid", password: "wrong-password" }),
    }),
    { requestIP: () => ({ address: "192.0.2.41" }) },
  );
  expect(differentPeer.status).toBe(401);
});

test("stock paths reach the tenant API, not the public one", async () => {
  for (const path of ["/stock", "/stock/branches", "/stock/documents", "/stock/products/x"]) {
    const response = await host.fetch(new Request(`http://localhost${path}`));
    expect(response.status, path).toBe(401);
  }
  expect((await host.fetch(new Request("http://localhost/stockroom"))).status).toBe(404);
});
