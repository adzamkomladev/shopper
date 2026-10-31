// Day 26 S2: five wrong PINs or passwords lock a member; someone holding staff.unlock lifts it at once.
import { expect, test } from "vite-plus/test";
import { and, desc, eq } from "drizzle-orm";
import * as schema from "@shopper/db-pg";
import { defineCommand, verifyChain } from "@shopper/audit";
import { createApi } from "@shopper/api";
import { createDeviceService } from "@shopper/auth/devices";
import {
  api,
  auth,
  baseURL,
  context,
  cookies,
  db,
  deviceCache,
  otherApi,
  password,
  request,
} from "../auth/setup";

const seedBranch = defineCommand({
  name: "security.test.branch",
  async run(tx, c) {
    const [store] = await tx
      .insert(schema.store)
      .values({ orgId: c.orgId, name: "Lock store" })
      .returning();
    const [branch] = await tx
      .insert(schema.branch)
      .values({ orgId: c.orgId, storeId: store!.id, name: "Lock branch" })
      .returning();
    return { branchId: branch!.id };
  },
  audit: () => ({}),
});

const principalOf = async (role: string) =>
  (await auth.resolvePrincipal(new Request(baseURL, { headers: { cookie: cookies.get(role)! } })))!;

test("five wrong PINs and passwords lock a cashier; a cashier cannot unlock, another shop gets 404, an admin can", async () => {
  const devices = createDeviceService(db, deviceCache.cache, context.appVersion);
  const admin = await principalOf("admin");
  const cashier = await principalOf("cashier");
  const { branchId } = await seedBranch(db, { ...context, actorId: admin.userId }, {});
  const issued = await devices.issueEnrollment(admin, { branchId });
  const till = await devices.enroll({ orgId: context.orgId, code: issued.code, name: "Lock till" });
  await devices.assignPin(admin, { userId: cashier.userId, pin: "1357" });
  const byPin = (pin: string) =>
    devices.login({
      deviceId: till.deviceId,
      deviceToken: till.deviceToken,
      userId: cashier.userId,
      pin,
    });
  const byPassword = (secret: string) =>
    devices.login({
      deviceId: till.deviceId,
      deviceToken: till.deviceToken,
      email: "cashier@example.com",
      password: secret,
    });
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await expect(byPin("2468")).rejects.toThrow();
    await expect(byPassword("not-the-password")).rejects.toThrow();
  }
  await expect(byPin("1357")).rejects.toThrow("temporarily locked");
  await expect(byPassword(password)).rejects.toThrow("temporarily locked");
  // The register names the time the lock lifts, so the HTTP refusal carries it.
  const deviceApi = createApi({ database: db, authentication: auth, devices });
  const refused = await request(deviceApi, "", "/cashiers/login", "POST", {
    deviceId: till.deviceId,
    deviceToken: till.deviceToken,
    email: "cashier@example.com",
    password,
  });
  expect(refused.status).toBe(429);
  const lockedUntil = ((await refused.json()) as { lockedUntil?: string }).lockedUntil;
  expect(Date.parse(lockedUntil!)).toBeGreaterThan(Date.now());

  const listed = async () =>
    (
      (await (await request(api, cookies.get("admin")!, "/users")).json()) as {
        id: string;
        lockedUntil: string | null;
      }[]
    ).find((row) => row.id === cashier.userId)!;
  expect(Date.parse((await listed()).lockedUntil!)).toBeGreaterThan(Date.now());

  const unlock = (instance: typeof api, role: string) =>
    request(instance, cookies.get(role)!, `/users/${cashier.userId}/unlock`, "POST");
  expect((await unlock(api, "cashier")).status).toBe(403);
  expect((await unlock(otherApi, "other")).status).toBe(404);
  expect(Date.parse((await listed()).lockedUntil!)).toBeGreaterThan(Date.now());

  const unlocked = await unlock(api, "admin");
  expect(unlocked.status).toBe(200);
  expect(await unlocked.json()).toEqual({ userId: cashier.userId, lockedUntil: null });
  expect((await listed()).lockedUntil).toBeNull();
  await expect(byPin("1357")).resolves.toMatchObject({ token: expect.any(String) });
  await expect(byPassword(password)).resolves.toMatchObject({ token: expect.any(String) });

  const [audit] = await db
    .select()
    .from(schema.auditLog)
    .where(
      and(
        eq(schema.auditLog.orgId, context.orgId),
        eq(schema.auditLog.command, "auth.member.unlock"),
      ),
    );
  expect(audit).toMatchObject({ actorId: admin.userId, payload: { userId: cashier.userId } });
  expect(audit!.before).toMatchObject({ codeFailures: 5, signInFailures: 5 });
  expect(audit!.after).toEqual({
    codeFailures: 0,
    codeLockedUntil: null,
    signInFailures: 0,
    signInLockedUntil: null,
  });
  const [pin] = await db
    .select()
    .from(schema.cashierPin)
    .where(eq(schema.cashierPin.userId, cashier.userId));
  expect(JSON.stringify(audit)).not.toContain(pin!.pinHash);
  const chain = await db
    .select()
    .from(schema.auditLog)
    .where(eq(schema.auditLog.orgId, context.orgId))
    .orderBy(schema.auditLog.chainSeq);
  expect(await verifyChain(chain)).toMatchObject({ valid: true });
});

test("staff.unlock is a till-allowed grant that admins hold and cashiers do not", async () => {
  const codes = (await (
    await request(api, cookies.get("admin")!, "/session/permissions")
  ).json()) as string[];
  expect(codes).toContain("staff.unlock");
  const cashierCodes = (await (
    await request(api, cookies.get("cashier")!, "/session/permissions")
  ).json()) as string[];
  expect(cashierCodes).not.toContain("staff.unlock");
  const [row] = await db
    .select({ tillAllowed: schema.permission.tillAllowed })
    .from(schema.permission)
    .where(
      and(eq(schema.permission.orgId, context.orgId), eq(schema.permission.code, "staff.unlock")),
    );
  // A manager's PIN unlocks a register offline, so the grant travels to tills.
  expect(row?.tillAllowed).toBe(true);
});

test("at the register, a manager's PIN unlocks a cashier through the server; a wrong PIN or a cashier approver cannot", async () => {
  const devices = createDeviceService(db, deviceCache.cache, context.appVersion);
  const admin = await principalOf("admin");
  const cashier = await principalOf("cashier");
  const { branchId } = await seedBranch(db, { ...context, actorId: admin.userId }, {});
  const issued = await devices.issueEnrollment(admin, { branchId });
  const till = await devices.enroll({
    orgId: context.orgId,
    code: issued.code,
    name: "Unlock till",
  });
  await devices.assignPin(admin, { userId: admin.userId, pin: "2468" });
  await devices.assignPin(admin, { userId: cashier.userId, pin: "1357" });
  const credentials = { deviceId: till.deviceId, deviceToken: till.deviceToken };
  for (let attempt = 0; attempt < 5; attempt += 1)
    await expect(
      devices.login({ ...credentials, email: "cashier@example.com", password: "nope-nope" }),
    ).rejects.toThrow();
  const unlock = (approverId: string, pin: string, deviceToken = till.deviceToken) =>
    devices.unlock({ ...credentials, deviceToken, email: "Cashier@Example.com", approverId, pin });

  await expect(unlock(admin.userId, "2468", "0".repeat(64))).rejects.toThrow(
    "Invalid device credential",
  );
  await expect(unlock(admin.userId, "0000")).rejects.toMatchObject({ status: 401 });
  await expect(unlock(cashier.userId, "1357")).rejects.toMatchObject({ status: 403 });
  await expect(
    devices.login({ ...credentials, email: "cashier@example.com", password }),
  ).rejects.toThrow("temporarily locked");

  await expect(unlock(admin.userId, "2468")).resolves.toEqual({
    userId: cashier.userId,
    lockedUntil: null,
  });
  await expect(
    devices.login({ ...credentials, email: "cashier@example.com", password }),
  ).resolves.toMatchObject({ userId: cashier.userId });
  const [row] = await db
    .select()
    .from(schema.auditLog)
    .where(
      and(eq(schema.auditLog.orgId, context.orgId), eq(schema.auditLog.command, "cashier.unlock")),
    )
    .orderBy(desc(schema.auditLog.chainSeq))
    .limit(1);
  expect(row).toMatchObject({
    actorId: admin.userId,
    deviceId: till.deviceId,
    payload: { userId: cashier.userId, success: true },
  });
  expect(row!.before).toMatchObject({ signInFailures: 5 });
});

// Unlocking hands out no role, so it needs staff.unlock alone: a supervisor who cannot edit roles may still unlock.
test("a role holding staff.unlock without role.write unlocks from the back office", async () => {
  const cashier = await principalOf("cashier");
  const admin = await principalOf("admin");
  const [grant] = await db
    .select({ id: schema.permission.id })
    .from(schema.permission)
    .where(
      and(eq(schema.permission.orgId, context.orgId), eq(schema.permission.code, "staff.unlock")),
    );
  const [held] = await db
    .insert(schema.rolePermission)
    .values({ orgId: context.orgId, roleId: cashier.roleId, permissionId: grant!.id })
    .returning();
  await db
    .update(schema.user)
    .set({ passwordAttempts: 5, passwordLockedUntil: new Date(Date.now() + 600_000) })
    .where(eq(schema.user.id, admin.userId));
  const unlocked = await request(
    api,
    cookies.get("cashier")!,
    `/users/${admin.userId}/unlock`,
    "POST",
  );
  await db.delete(schema.rolePermission).where(eq(schema.rolePermission.id, held!.id));
  expect(unlocked.status).toBe(200);
  const [row] = await db
    .select({ lockedUntil: schema.user.passwordLockedUntil })
    .from(schema.user)
    .where(eq(schema.user.id, admin.userId));
  expect(row!.lockedUntil).toBeNull();
});
