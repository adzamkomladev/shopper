import { expect, test } from "vite-plus/test";
import { and, eq } from "drizzle-orm";
import { v7 } from "uuid";
import * as schema from "@shopper/db-pg";
import { createAuth, registerOrganizationUser } from "@shopper/auth";
import { defineCommand } from "@shopper/audit";
import { provisionOrg, provisioningContext } from "../../../tooling/database/seed";
import {
  baseURL,
  secret,
  bootstrapToken,
  password,
  db,
  context,
  auth,
  cookies,
  trustedIP,
  signIn,
  commandContext,
} from "./setup";

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
