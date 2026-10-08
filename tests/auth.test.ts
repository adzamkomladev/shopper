import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { v7 } from "uuid";
import * as schema from "../packages/db-pg/src/schema";
import type { ShopperDatabase } from "../packages/db-pg/src/index";
import {
  createAuth,
  createDeviceService,
  registerOrganizationUser,
  seedAuthRoles,
} from "../packages/auth/src/index";
import { createApi } from "../packages/api/src/index";
import { defineCommand } from "../packages/audit/src/index";
import { boxCache } from "../packages/adapters-box/src/index";
import { migrateDatabase } from "../tooling/migrate";
import { provisionOrg, provisioningContext } from "../tooling/seed";
import { postgresFixture } from "./fixtures/postgres";

const baseURL = "http://localhost:8787";
const secret = "auth integration test secret that is at least thirty two chars";
const bootstrapToken = "test bootstrap token that is sufficiently long";
const password = "Shopper-test-password-123";
let fixture: Awaited<ReturnType<typeof postgresFixture>>;
let db: ShopperDatabase;
let context: ReturnType<typeof provisioningContext>;
let otherContext: ReturnType<typeof provisioningContext>;
let auth: ReturnType<typeof createAuth>;
let otherAuth: ReturnType<typeof createAuth>;
let api: ReturnType<typeof createApi>;
let otherApi: ReturnType<typeof createApi>;
let deviceApi: ReturnType<typeof createApi>;
let deviceCache: ReturnType<typeof boxCache>;
let cookies = new Map<string, string>();
let roleIds = new Map<string, string>();

function sessionCookie(response: Response) {
  const header = response.headers.get("set-cookie") ?? "";
  const match = header.match(/(?:__Secure-)?better-auth\.session_token=[^;,]+/);
  if (!match) throw new Error(`Better Auth did not set a session cookie: ${header}`);
  return match[0];
}

let trustedIPCounter = 0;
const trustedIP = () => `198.51.100.${++trustedIPCounter}`;

async function signUp(service: ReturnType<typeof createAuth>, email: string, token: string) {
  return service.handler(
    new Request(`${baseURL}/api/auth/sign-up/email`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "X-Shopper-Bootstrap-Token": token,
        "X-Shopper-Client-IP": trustedIP(),
      },
      body: JSON.stringify({ name: "Store owner", email, password }),
    }),
  );
}

async function signIn(service: ReturnType<typeof createAuth>, email: string) {
  const response = await service.handler(
    new Request(`${baseURL}/api/auth/sign-in/email`, {
      method: "POST",
      headers: { "content-type": "application/json", "X-Shopper-Client-IP": trustedIP() },
      body: JSON.stringify({ email, password }),
    }),
  );
  if (!response.ok) throw new Error(`Sign-in failed: ${response.status} ${await response.text()}`);
  return sessionCookie(response);
}

function commandContext(orgId: string, principal: { userId: string; roleName: string }) {
  return {
    orgId,
    actorId: principal.userId,
    role: principal.roleName,
    appVersion: context.appVersion,
  };
}

async function request(
  appInstance: ReturnType<typeof createApi>,
  cookie: string,
  path: string,
  method = "GET",
  body?: unknown,
) {
  return appInstance.request(path, {
    method,
    headers: {
      cookie,
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

beforeAll(async () => {
  fixture = await postgresFixture();
  db = drizzle(fixture.client, { schema });
  await migrateDatabase(db);
  context = provisioningContext();
  otherContext = provisioningContext();
  await provisionOrg(db, context, { name: "Auth tenant" });
  await provisionOrg(db, otherContext, { name: "Other auth tenant" });
  await seedAuthRoles(db, context, undefined);
  await seedAuthRoles(db, otherContext, undefined);
  auth = createAuth({ database: db, orgId: context.orgId, secret, baseURL, bootstrapToken });
  otherAuth = createAuth({
    database: db,
    orgId: otherContext.orgId,
    secret,
    baseURL,
    bootstrapToken: `${bootstrapToken}-other`,
  });
  api = createApi({ database: db, authentication: auth });
  otherApi = createApi({ database: db, authentication: otherAuth });
  deviceCache = boxCache(":memory:");

  const ownerEmail = "same-owner@example.com";
  const ownerSignup = await signUp(auth, ownerEmail, bootstrapToken);
  expect(ownerSignup.status).toBe(200);
  cookies.set("superadmin", await signIn(auth, ownerEmail));
  const superadmin = await auth.resolvePrincipal(
    new Request(baseURL, { headers: { cookie: cookies.get("superadmin")! } }),
  );
  expect(superadmin?.roleName).toBe("superadmin");

  const rows = await db
    .select({ id: schema.role.id, name: schema.role.name })
    .from(schema.role)
    .where(eq(schema.role.orgId, context.orgId));
  roleIds = new Map(rows.map((row) => [row.name, row.id]));
  for (const roleName of ["admin", "accountant", "inventory", "cashier"]) {
    const email = `${roleName}@example.com`;
    await registerOrganizationUser(db, commandContext(context.orgId, superadmin!), {
      name: roleName,
      email,
      password,
      roleId: roleIds.get(roleName)!,
    });
    cookies.set(roleName, await signIn(auth, email));
  }

  const admin = await auth.resolvePrincipal(
    new Request(baseURL, { headers: { cookie: cookies.get("admin")! } }),
  );
  await expect(
    registerOrganizationUser(db, commandContext(context.orgId, admin!), {
      name: "Escalation attempt",
      email: "escalation@example.com",
      password,
      roleId: roleIds.get("superadmin")!,
    }),
  ).rejects.toThrow("Cannot grant permissions you do not hold");

  const otherSignup = await signUp(otherAuth, ownerEmail, `${bootstrapToken}-other`);
  expect(otherSignup.status).toBe(200);
  cookies.set("other", await signIn(otherAuth, ownerEmail));
});

afterAll(async () => {
  deviceCache?.close();
  await fixture?.close();
});

test("Better Auth signs in provisioned tenants and binds cookies and API scope to the selected tenant", async () => {
  const owner = await auth.resolvePrincipal(
    new Request(baseURL, { headers: { cookie: cookies.get("superadmin")! } }),
  );
  expect(owner).toMatchObject({ orgId: context.orgId, roleName: "superadmin" });
  expect(
    await otherAuth.resolvePrincipal(
      new Request(baseURL, { headers: { cookie: cookies.get("superadmin")! } }),
    ),
  ).toBeNull();
  expect((await request(otherApi, cookies.get("superadmin")!, "/stores")).status).toBe(401);

  const ownerStore = await request(api, cookies.get("superadmin")!, "/stores", "POST", {
    name: "Owner tenant store",
  });
  const otherStore = await request(otherApi, cookies.get("other")!, "/stores", "POST", {
    name: "Other tenant store",
  });
  expect(ownerStore.status).toBe(201);
  expect(otherStore.status).toBe(201);
  const ownerRows = await request(
    api,
    cookies.get("superadmin")!,
    `/stores?orgId=${otherContext.orgId}`,
  ).then((r) => r.json());
  expect(ownerRows).toHaveLength(1);
  expect(ownerRows[0]).toMatchObject({ orgId: context.orgId, name: "Owner tenant store" });

  expect((await signUp(auth, "another-owner@example.com", bootstrapToken)).status).toBe(403);
  const createOrg = await auth.handler(
    new Request(`${baseURL}/api/auth/organization/create`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: cookies.get("superadmin")! },
      body: JSON.stringify({ name: "Unprovisioned organization", slug: "unprovisioned" }),
    }),
  );
  expect(createOrg.status).toBe(404);
});

test("actual cookie sessions enforce the five seeded role matrices across store, branch, and tax APIs", async () => {
  const ownerCookie = cookies.get("superadmin")!;
  const storeResponse = await request(api, ownerCookie, "/stores", "POST", {
    name: "Role matrix store",
  });
  const store = await storeResponse.json();
  const branchResponse = await request(api, ownerCookie, "/branches", "POST", {
    name: "Role matrix branch",
    storeId: store.id,
  });
  const branch = await branchResponse.json();
  expect(storeResponse.status).toBe(201);
  expect(branchResponse.status).toBe(201);

  const roleNames = ["admin", "accountant", "inventory", "cashier", "superadmin"];
  for (const roleName of roleNames) {
    const cookie = cookies.get(roleName)!;
    const taxStatus = ["superadmin", "admin", "accountant"].includes(roleName) ? 200 : 403;
    const operations = [
      ["GET", "/stores", undefined, 200],
      ["GET", `/stores/${store.id}`, undefined, 200],
      ["POST", "/stores", { name: `${roleName} temporary store` }, 201],
      ["PATCH", `/stores/${store.id}`, { name: `${roleName} store update` }, 200],
      ["GET", "/branches", undefined, 200],
      ["GET", `/branches/${branch.id}`, undefined, 200],
      ["POST", "/branches", { name: `${roleName} temporary branch`, storeId: store.id }, 201],
      ["PATCH", `/branches/${branch.id}`, { name: `${roleName} branch update` }, 200],
      ["DELETE", `/branches/${branch.id}`, undefined, 204],
      ["DELETE", `/stores/${store.id}`, undefined, 204],
    ] as const;
    for (const [method, path, body, successStatus] of operations) {
      const response = await request(api, cookie, path, method, body);
      expect(response.status, `${roleName} ${method} ${path}`).toBe(
        roleName === "superadmin" ? successStatus : 403,
      );
      if (roleName === "superadmin" && method === "POST" && path === "/stores") {
        const temporaryStore = await response.json();
        expect((await request(api, cookie, `/stores/${temporaryStore.id}`, "DELETE")).status).toBe(
          204,
        );
      }
      if (roleName === "superadmin" && method === "POST" && path === "/branches") {
        const temporaryBranch = await response.json();
        expect(
          (await request(api, cookie, `/branches/${temporaryBranch.id}`, "DELETE")).status,
        ).toBe(204);
      }
    }
    expect((await request(api, cookie, "/tax-rules?on=2026-01-01")).status).toBe(taxStatus);
    const principal = await auth.resolvePrincipal(new Request(baseURL, { headers: { cookie } }));
    expect(principal).not.toBeNull();
    for (const code of ["device.enroll", "device.revoke", "cashier.pin.assign"])
      expect(await auth.hasPermission(principal!, code)).toBe(
        ["superadmin", "admin"].includes(roleName),
      );
  }
});

test("actual cookie sessions enforce enrollment, PIN assignment, and device revocation endpoints", async () => {
  const ownerCookie = cookies.get("superadmin")!;
  const storeResponse = await request(api, ownerCookie, "/stores", "POST", {
    name: "Device auth store",
  });
  const store = await storeResponse.json();
  const branchResponse = await request(api, ownerCookie, "/branches", "POST", {
    name: "Device auth branch",
    storeId: store.id,
  });
  const branch = await branchResponse.json();
  expect(storeResponse.status).toBe(201);
  expect(branchResponse.status).toBe(201);

  const deviceService = createDeviceService(
    db,
    deviceCache.cache,
    context.appVersion,
    context.orgId,
  );
  deviceApi = createApi({ database: db, authentication: auth, devices: deviceService });
  const enrollmentResponse = await request(deviceApi, ownerCookie, "/devices/enrollment", "POST", {
    branchId: branch.id,
  });
  expect(enrollmentResponse.status).toBe(201);
  const enrollment = await enrollmentResponse.json();
  const enrolledResponse = await deviceApi.request("/devices/enroll", {
    method: "POST",
    headers: { "content-type": "application/json", "X-Shopper-Client-IP": trustedIP() },
    body: JSON.stringify({
      orgId: context.orgId,
      code: enrollment.code,
      name: "Permission matrix till",
    }),
  });
  expect(enrolledResponse.status).toBe(201);
  const enrolled = await enrolledResponse.json();
  const cashier = await auth.resolvePrincipal(
    new Request(baseURL, { headers: { cookie: cookies.get("cashier")! } }),
  );
  expect(cashier).not.toBeNull();

  for (const roleName of ["superadmin", "admin", "accountant", "inventory", "cashier"]) {
    const cookie = cookies.get(roleName)!;
    const status = ["superadmin", "admin"].includes(roleName) ? 200 : 403;
    expect(
      (await request(deviceApi, cookie, "/devices/enrollment", "POST", { branchId: branch.id }))
        .status,
      `${roleName} POST /devices/enrollment`,
    ).toBe(status === 200 ? 201 : status);
    expect(
      (
        await request(deviceApi, cookie, "/cashiers/pin", "POST", {
          userId: cashier!.userId,
          pin: "4826",
        })
      ).status,
      `${roleName} POST /cashiers/pin`,
    ).toBe(status);
    expect(
      (await request(deviceApi, cookie, "/devices/revoke", "POST", { deviceId: enrolled.deviceId }))
        .status,
      `${roleName} POST /devices/revoke`,
    ).toBe(status);
  }
});

const createCustomRole = defineCommand({
  name: "auth.test.role.create",
  async run(tx, context) {
    const [row] = await tx
      .insert(schema.role)
      .values({ orgId: context.orgId, name: "auditor" })
      .returning();
    return { id: row!.id };
  },
  audit: (_input, output) => ({ roleId: output.id }),
});
const grantTaxRead = defineCommand({
  name: "auth.test.role.grant",
  async run(tx, context, roleId: string) {
    const [taxRead] = await tx
      .select({ id: schema.permission.id })
      .from(schema.permission)
      .where(
        and(eq(schema.permission.orgId, context.orgId), eq(schema.permission.code, "tax.read")),
      );
    await tx
      .insert(schema.rolePermission)
      .values({ orgId: context.orgId, roleId, permissionId: taxRead!.id })
      .onConflictDoNothing();
    return {};
  },
  audit: () => ({ permission: "tax.read" }),
});

const expireUserSessions = defineCommand({
  name: "auth.test.session.expire",
  async run(tx, context, userId: string) {
    const changed = await tx
      .update(schema.session)
      .set({ expiresAt: new Date(Date.now() - 60_000) })
      .where(and(eq(schema.session.orgId, context.orgId), eq(schema.session.userId, userId)))
      .returning({ id: schema.session.id });
    return { count: changed.length };
  },
  audit: (_input, output) => output,
});

test("authorization follows live role_permission data and tillAllowed data rather than role names", async () => {
  const superadmin = await auth.resolvePrincipal(
    new Request(baseURL, { headers: { cookie: cookies.get("superadmin")! } }),
  );
  const role = await createCustomRole(db, commandContext(context.orgId, superadmin!), undefined);
  await registerOrganizationUser(db, commandContext(context.orgId, superadmin!), {
    name: "Auditor",
    email: "auditor@example.com",
    password,
    roleId: role.id,
  });
  const auditorCookie = await signIn(auth, "auditor@example.com");
  const auditor = await auth.resolvePrincipal(
    new Request(baseURL, { headers: { cookie: auditorCookie } }),
  );
  expect(auditor).toMatchObject({ roleName: "auditor" });
  expect(await auth.hasPermission(auditor!, "tax.read")).toBe(false);
  await grantTaxRead(db, commandContext(context.orgId, superadmin!), role.id);
  expect(await auth.hasPermission(auditor!, "tax.read")).toBe(true);
  expect(await auth.hasPermission({ ...auditor!, deviceId: v7() }, "tax.read")).toBe(false);

  const cashier = await auth.resolvePrincipal(
    new Request(baseURL, { headers: { cookie: cookies.get("cashier")! } }),
  );
  expect(await auth.hasPermission({ ...cashier!, deviceId: v7() }, "sale.create")).toBe(true);
  expect(await auth.hasPermission({ ...cashier!, deviceId: v7() }, "store.read")).toBe(false);

  const auditRows = await db
    .select({ payload: schema.auditLog.payload })
    .from(schema.auditLog)
    .where(
      and(
        eq(schema.auditLog.orgId, context.orgId),
        eq(schema.auditLog.command, "auth.user.register"),
      ),
    );
  expect(JSON.stringify(auditRows)).not.toContain(password);
});

test("failed bootstrap signup rolls back auth rows, seeded roles, and its audit entry", async () => {
  const failedContext = provisioningContext();
  await provisionOrg(db, failedContext, { name: "Failed auth bootstrap" });
  const failedAuth = createAuth({
    database: db,
    orgId: failedContext.orgId,
    secret,
    baseURL,
    bootstrapToken: `${bootstrapToken}-failed`,
  });
  const response = await failedAuth.handler(
    new Request(`${baseURL}/api/auth/sign-up/email`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "X-Shopper-Bootstrap-Token": `${bootstrapToken}-failed`,
      },
      body: JSON.stringify({
        name: "Invalid owner",
        email: "invalid-owner@example.com",
        password: "tiny",
      }),
    }),
  );
  expect(response.status).toBeGreaterThanOrEqual(400);
  const [userCount, accountCount, roleCount, permissionCount, authAuditCount] = await Promise.all([
    db.$count(schema.user, eq(schema.user.orgId, failedContext.orgId)),
    db.$count(schema.account, eq(schema.account.orgId, failedContext.orgId)),
    db.$count(schema.role, eq(schema.role.orgId, failedContext.orgId)),
    db.$count(schema.permission, eq(schema.permission.orgId, failedContext.orgId)),
    db.$count(
      schema.auditLog,
      and(
        eq(schema.auditLog.orgId, failedContext.orgId),
        eq(schema.auditLog.command, "auth.request"),
      ),
    ),
  ]);
  expect([userCount, accountCount, roleCount, permissionCount, authAuditCount]).toEqual([
    0, 0, 0, 0, 0,
  ]);
});

test("expired-session GET does not delete or otherwise write the session row", async () => {
  const cashier = await auth.resolvePrincipal(
    new Request(baseURL, { headers: { cookie: cookies.get("cashier")! } }),
  );
  expect(cashier).not.toBeNull();
  await expireUserSessions(db, commandContext(context.orgId, cashier!), cashier!.userId);
  const before = await db
    .select({ id: schema.session.id, expiresAt: schema.session.expiresAt })
    .from(schema.session)
    .where(
      and(eq(schema.session.orgId, context.orgId), eq(schema.session.userId, cashier!.userId)),
    );
  expect(before.length).toBeGreaterThan(0);

  const response = await auth.handler(
    new Request(`${baseURL}/api/auth/get-session`, {
      headers: { cookie: cookies.get("cashier")! },
    }),
  );
  expect(response.status).toBe(200);
  const after = await db
    .select({ id: schema.session.id, expiresAt: schema.session.expiresAt })
    .from(schema.session)
    .where(
      and(eq(schema.session.orgId, context.orgId), eq(schema.session.userId, cashier!.userId)),
    );
  expect(after).toEqual(before);
});

test("successful signup and signin audit verified actor identity without credentials or session tokens", async () => {
  const owner = await auth.resolvePrincipal(
    new Request(baseURL, { headers: { cookie: cookies.get("superadmin")! } }),
  );
  const events = await db
    .select({
      actorId: schema.auditLog.actorId,
      entityId: schema.auditLog.entityId,
      payload: schema.auditLog.payload,
    })
    .from(schema.auditLog)
    .where(
      and(eq(schema.auditLog.orgId, context.orgId), eq(schema.auditLog.command, "auth.request")),
    );
  const signup = events.find((event) => event.payload.path === "/api/auth/sign-up/email");
  const signin = events.find((event) => event.payload.path === "/api/auth/sign-in/email");
  expect(signup).toMatchObject({ actorId: owner!.userId, entityId: owner!.userId });
  expect(signin).toMatchObject({ actorId: owner!.userId, entityId: owner!.userId });
  const serialized = JSON.stringify(events);
  expect(serialized).not.toContain(password);
  expect(serialized).not.toContain(cookies.get("superadmin"));
});

test("password attempts share the built-in limiter across recreated auth factories", async () => {
  const ip = trustedIP();
  const before = await db.select().from(schema.auditLog);
  for (let attempt = 0; attempt < 4; attempt++) {
    const fresh = createAuth({ database: db, orgId: context.orgId, secret, baseURL });
    const response = await fresh.handler(
      new Request(`${baseURL}/api/auth/sign-in/email`, {
        method: "POST",
        headers: { "content-type": "application/json", "X-Shopper-Client-IP": ip },
        body: JSON.stringify({
          email: "nonexistent@rate-limit.invalid",
          password: "wrong-password",
        }),
      }),
    );
    expect(response.status).toBe(attempt < 3 ? 401 : 429);
  }
  expect(await db.select().from(schema.auditLog)).toEqual(before);
});
