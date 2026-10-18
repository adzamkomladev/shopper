import { beforeAll, expect, test } from "vite-plus/test";
import { v7 } from "uuid";
import { and, eq } from "drizzle-orm";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import * as schema from "@shopper/db-pg";
import { defineCommand } from "@shopper/audit";
import { seedAuthRoles } from "@shopper/auth";
import { db, service, principal, branchId, context } from "../setup";

// better-auth is a dependency of @shopper/auth, not of the repo root.
const resolver = createRequire(
  new URL("../../../../../packages/auth/package.json", import.meta.url),
);
const { hashPassword } = (await import(
  pathToFileURL(resolver.resolve("better-auth/crypto")).href
)) as { hashPassword(password: string): Promise<string> };
const password = "correct horse battery";
const email = `Staff.${v7()}@Example.com`;
let staffId: string;
let till: Awaited<ReturnType<typeof service.enroll>>;

const addStaff = defineCommand({
  name: "devices.test.add-staff",
  async run(tx, c, input: { roleName: string }) {
    const [found] = await tx
      .select()
      .from(schema.role)
      .where(and(eq(schema.role.orgId, c.orgId), eq(schema.role.name, input.roleName)));
    const [person] = await tx
      .insert(schema.user)
      .values({ orgId: c.orgId, email, name: "Ama Mensah" })
      .returning();
    await tx.insert(schema.member).values({
      orgId: c.orgId,
      organizationId: c.orgId,
      userId: person!.id,
      roleId: found!.id,
      role: "member",
    });
    await tx.insert(schema.account).values({
      orgId: c.orgId,
      userId: person!.id,
      accountId: person!.id,
      providerId: "credential",
      password: await hashPassword(password),
    });
    return { userId: person!.id };
  },
  audit: () => ({}),
});
const clearLock = defineCommand({
  name: "devices.test.clear-password-lock",
  async run(tx, c, input: { userId: string }) {
    await tx
      .update(schema.user)
      .set({ passwordAttempts: 0, passwordLockedUntil: null })
      .where(and(eq(schema.user.orgId, c.orgId), eq(schema.user.id, input.userId)));
    return {};
  },
  audit: () => ({}),
});
const resetBudget = defineCommand({
  name: "devices.test.password-reset-budget",
  async run(tx, c) {
    await tx
      .update(schema.enrollmentAttempt)
      .set({ lockedUntil: new Date(0) })
      .where(eq(schema.enrollmentAttempt.orgId, c.orgId));
    return {};
  },
  audit: () => ({}),
});

beforeAll(async () => {
  await seedAuthRoles(db, context, {});
  staffId = (await addStaff(db, context, { roleName: "admin" })).userId;
  await resetBudget(db, context, {});
  const issued = await service.issueEnrollment(principal, { branchId });
  till = await service.enroll({ orgId: principal.orgId, code: issued.code, name: "Password till" });
});

const credentials = () => ({ deviceId: till.deviceId, deviceToken: till.deviceToken });

test("a member signs in on an enrolled till with email and password and gets a till-allowed session", async () => {
  const session = await service.login({ ...credentials(), email: email.toLowerCase(), password });
  expect(session).toMatchObject({ userId: staffId, userName: "Ama Mensah", roleName: "admin" });
  const resolved = await service.resolveDevicePrincipal(
    new Request("https://shopper.example/api", {
      headers: {
        authorization: `Bearer ${session.token}`,
        "x-shopper-device-token": till.deviceToken,
      },
    }),
  );
  expect(resolved).toMatchObject({ userId: staffId, deviceId: till.deviceId, branchId });
  const audit = await db
    .select()
    .from(schema.auditLog)
    .where(eq(schema.auditLog.command, "cashier.login"));
  expect(audit.some((row) => row.actorId === staffId && row.payload.success === true)).toBe(true);
  expect(JSON.stringify(audit)).not.toContain(password);
});

test("the session for an admin carries report.read, stock.read and stock.write but not user or role admin", async () => {
  const { permissions } = await service.login({ ...credentials(), email, password });
  expect(permissions).toEqual(
    expect.arrayContaining(["report.read", "stock.read", "stock.write", "sale.create"]),
  );
  expect(permissions.filter((code) => /^(user|role)\./.test(code))).toEqual([]);
});

test("a wrong password or unknown email gives the same error and counts attempts", async () => {
  await clearLock(db, context, { userId: staffId });
  const wrong = await service
    .login({ ...credentials(), email, password: "nope-nope" })
    .catch((error) => error);
  const unknown = await service
    .login({ ...credentials(), email: `nobody-${v7()}@example.com`, password })
    .catch((error) => error);
  expect(wrong.message).toBe(unknown.message);
  expect(wrong.status).toBe(unknown.status);
  const [row] = await db.select().from(schema.user).where(eq(schema.user.id, staffId));
  expect(row!.passwordAttempts).toBe(1);
  await service.login({ ...credentials(), email, password });
  const [reset] = await db.select().from(schema.user).where(eq(schema.user.id, staffId));
  expect(reset!.passwordAttempts).toBe(0);
});

test("five wrong passwords lock the member for 15 minutes", async () => {
  await clearLock(db, context, { userId: staffId });
  for (let i = 0; i < 5; i++)
    await expect(
      service.login({ ...credentials(), email, password: "wrong-wrong" }),
    ).rejects.toThrow("Invalid email or password");
  await expect(service.login({ ...credentials(), email, password })).rejects.toThrow(
    "temporarily locked",
  );
  const [row] = await db.select().from(schema.user).where(eq(schema.user.id, staffId));
  const remaining = row!.passwordLockedUntil!.getTime() - Date.now();
  expect(remaining).toBeGreaterThan(14 * 60000);
  expect(remaining).toBeLessThanOrEqual(15 * 60000);
});

test("a revoked device token gets 401", async () => {
  await clearLock(db, context, { userId: staffId });
  await resetBudget(db, context, {});
  const issued = await service.issueEnrollment(principal, { branchId });
  const other = await service.enroll({ orgId: principal.orgId, code: issued.code, name: "Gone" });
  await service.revoke(principal, { deviceId: other.deviceId });
  await expect(
    service.login({ deviceId: other.deviceId, deviceToken: other.deviceToken, email, password }),
  ).rejects.toMatchObject({ status: 401, message: "Invalid device credential" });
});
