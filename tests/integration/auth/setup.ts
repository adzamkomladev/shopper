// Shared tenants, roles and sessions for the auth integration suites. Importing it registers the hooks.
import { afterAll, beforeAll, expect } from "vite-plus/test";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@shopper/db-pg";
import type { ShopperDatabase } from "@shopper/db-pg";
import { createAuth, registerOrganizationUser, seedAuthRoles } from "@shopper/auth";
import { createApi } from "@shopper/api";
import { boxCache } from "@shopper/adapters-box";
import { migrateDatabase } from "../../../tooling/migrate";
import { provisionOrg, provisioningContext } from "../../../tooling/seed";
import { postgresFixture } from "../../fixtures/postgres";

export const baseURL = "http://localhost:8787";
export const secret = "auth integration test secret that is at least thirty two chars";
export const bootstrapToken = "test bootstrap token that is sufficiently long";
export const password = "Shopper-test-password-123";
export let fixture: Awaited<ReturnType<typeof postgresFixture>>;
export let db: ShopperDatabase;
export let context: ReturnType<typeof provisioningContext>;
export let otherContext: ReturnType<typeof provisioningContext>;
export let auth: ReturnType<typeof createAuth>;
export let otherAuth: ReturnType<typeof createAuth>;
export let api: ReturnType<typeof createApi>;
export let otherApi: ReturnType<typeof createApi>;
export let deviceCache: ReturnType<typeof boxCache>;
export let cookies = new Map<string, string>();
export let roleIds = new Map<string, string>();

export function sessionCookie(response: Response) {
  const header = response.headers.get("set-cookie") ?? "";
  const match = header.match(/(?:__Secure-)?better-auth\.session_token=[^;,]+/);
  if (!match) throw new Error(`Better Auth did not set a session cookie: ${header}`);
  return match[0];
}

export let trustedIPCounter = 0;
export const trustedIP = () => `198.51.100.${++trustedIPCounter}`;

export async function signUp(service: ReturnType<typeof createAuth>, email: string, token: string) {
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

export async function signIn(service: ReturnType<typeof createAuth>, email: string) {
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

export function commandContext(orgId: string, principal: { userId: string; roleName: string }) {
  return {
    orgId,
    actorId: principal.userId,
    role: principal.roleName,
    appVersion: context.appVersion,
  };
}

export async function request(
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
