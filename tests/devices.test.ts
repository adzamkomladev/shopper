import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { v7 } from "uuid";
import { eq } from "drizzle-orm";
import * as schema from "../packages/db-pg/src/schema";
import { createDeviceService } from "../packages/auth/src/devices";
import { defineCommand, verifyChain } from "../packages/audit/src/index";
import { migrateDatabase } from "../tooling/migrate";
import { provisionOrg, provisioningContext } from "../tooling/seed";
import { postgresFixture } from "./fixtures/postgres";
import type { Cache } from "../packages/ports/src/index";
import { boxCache } from "../packages/adapters-box/src/index";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
let fixture: Awaited<ReturnType<typeof postgresFixture>>;
let pool: Pool;
let db: import("../packages/db-pg/src/index").ShopperDatabase;
let service: ReturnType<typeof createDeviceService>;
let principal: { orgId: string; userId: string; roleId: string; roleName: string };
let branchId: string;
const context = provisioningContext();
let directory: string;
let localCache: ReturnType<typeof boxCache>;
let cache: Cache;
const seed = defineCommand({
  name: "devices.test.seed",
  async run(tx, c) {
    const [store] = await tx
      .insert(schema.store)
      .values({ orgId: c.orgId, name: "Store" })
      .returning();
    const [branch] = await tx
      .insert(schema.branch)
      .values({ orgId: c.orgId, storeId: store!.id, name: "Branch" })
      .returning();
    const [user] = await tx
      .insert(schema.user)
      .values({ orgId: c.orgId, email: `${v7()}@example.com`, name: "Cashier" })
      .returning();
    const [role] = await tx
      .insert(schema.role)
      .values({ orgId: c.orgId, name: "cashier" })
      .returning();
    await tx.insert(schema.member).values({
      orgId: c.orgId,
      organizationId: c.orgId,
      userId: user!.id,
      roleId: role!.id,
      role: "member",
    });
    return { branchId: branch!.id, userId: user!.id, roleId: role!.id };
  },
  audit: () => ({}),
});
beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), "shopper-device-cache-"));
  localCache = boxCache(join(directory, "cache.sqlite"));
  cache = localCache.cache;
  fixture = await postgresFixture();
  pool = new Pool({ connectionString: fixture.connectionString });
  db = drizzle(pool, { schema });
  await migrateDatabase(db);
  await provisionOrg(db, context, { name: "Devices integration" });
  const seeded = await seed(db, context, {});
  branchId = seeded.branchId;
  principal = {
    orgId: context.orgId,
    userId: seeded.userId,
    roleId: seeded.roleId,
    roleName: "cashier",
  };
  service = createDeviceService(db, cache, context.appVersion);
});
afterAll(async () => {
  localCache?.close();
  if (directory) await rm(directory, { recursive: true, force: true });
  await pool?.end();
  await fixture?.close();
});
test("code and QR enroll once, bind branch, store only hashes, and audit consumption", async () => {
  const issued = await service.issueEnrollment(principal, { branchId });
  expect(issued.code).toMatch(/^\d{6}$/);
  const results = await Promise.allSettled([
    service.enroll({ ...JSON.parse(issued.qrPayload), name: "Till" }),
    service.enroll({ orgId: principal.orgId, code: issued.code, name: "Duplicate" }),
  ]);
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  const enrolled = (
    results.find((r) => r.status === "fulfilled") as PromiseFulfilledResult<
      Awaited<ReturnType<typeof service.enroll>>
    >
  ).value;
  expect(enrolled.branchId).toBe(branchId);
  const [stored] = await db
    .select()
    .from(schema.deviceCredential)
    .where(eq(schema.deviceCredential.deviceId, enrolled.deviceId));
  expect(stored!.tokenHash).not.toBe(enrolled.deviceToken);
  await expect(service.issueEnrollment(principal, { branchId: v7() })).rejects.toThrow(
    "Branch not found",
  );
  const entries = await db
    .select()
    .from(schema.auditLog)
    .where(eq(schema.auditLog.orgId, context.orgId))
    .orderBy(schema.auditLog.chainSeq);
  expect(await verifyChain(entries)).toMatchObject({ valid: true });
  expect(JSON.stringify(entries)).not.toContain(enrolled.deviceToken);
  expect(JSON.stringify(entries)).not.toContain(`"code":"${issued.code}"`);
});
test("unknown six-digit guesses persist an organization budget without consuming a valid challenge", async () => {
  const issued = await service.issueEnrollment(principal, { branchId });
  const wrong = issued.code === "000000" ? "000001" : "000000";
  for (let i = 0; i < 5; i++)
    await expect(
      service.enroll({ orgId: principal.orgId, code: wrong, name: "Guess" }),
    ).rejects.toThrow();
  await expect(
    service.enroll({ orgId: principal.orgId, code: issued.code, name: "Locked" }),
  ).rejects.toThrow("temporarily locked");
  const [budget] = await db
    .select()
    .from(schema.enrollmentAttempt)
    .where(eq(schema.enrollmentAttempt.orgId, principal.orgId));
  expect(budget!.attempts).toBe(5);
});

const expireLock = defineCommand({
  name: "devices.test.expire-lock",
  async run(tx, c, input: { userId: string }) {
    await tx
      .update(schema.cashierPin)
      .set({ lockedUntil: new Date(0) })
      .where(eq(schema.cashierPin.userId, input.userId));
    return {};
  },
  audit: () => ({}),
});
test("PIN lockout survives concurrent failures; device and cashier credentials must match, reset and revocation invalidate sessions", async () => {
  const budgetReset = defineCommand({
    name: "devices.test.expire-budget",
    async run(tx, c) {
      await tx
        .update(schema.enrollmentAttempt)
        .set({ lockedUntil: new Date(0) })
        .where(eq(schema.enrollmentAttempt.orgId, c.orgId));
      return {};
    },
    audit: () => ({}),
  });
  await budgetReset(db, context, {});
  const issued = await service.issueEnrollment(principal, { branchId });
  const till = await service.enroll({
    orgId: principal.orgId,
    code: issued.code,
    name: "PIN Till",
  });
  await service.assignPin(principal, { userId: principal.userId, pin: "1357" });
  const credentials = {
    deviceId: till.deviceId,
    deviceToken: till.deviceToken,
    userId: principal.userId,
  };
  const failures = await Promise.allSettled(
    Array.from({ length: 5 }, () => service.login({ ...credentials, pin: "2468" })),
  );
  expect(failures.every((r) => r.status === "rejected")).toBe(true);
  await expect(service.login({ ...credentials, pin: "1357" })).rejects.toThrow(
    "temporarily locked",
  );
  const [record] = await db
    .select()
    .from(schema.cashierPin)
    .where(eq(schema.cashierPin.userId, principal.userId));
  expect(record!.attempts).toBe(5);
  expect(record!.pinHash).not.toBe("1357");
  await expect(service.login({ ...credentials, userId: v7(), pin: "1357" })).rejects.toThrow(
    "Invalid PIN",
  );
  expect(
    (
      await db
        .select()
        .from(schema.cashierPin)
        .where(eq(schema.cashierPin.userId, principal.userId))
    )[0]!.attempts,
  ).toBe(5);
  await expireLock(db, context, { userId: principal.userId });
  const session = await service.login({ ...credentials, pin: "1357" });
  const loginAudit = await db
    .select()
    .from(schema.auditLog)
    .where(eq(schema.auditLog.command, "cashier.login"));
  const success = loginAudit.find((row) => row.payload.success === true);
  expect(success?.actorId).toBe(principal.userId);
  expect(success?.role).toBe(principal.roleName);
  expect(
    loginAudit.filter((row) => row.payload.success === false).every((row) => row.actorId === null),
  ).toBe(true);
  const request = (token: string) =>
    new Request("https://shopper.example/api", {
      headers: { authorization: `Bearer ${session.token}`, "x-shopper-device-token": token },
    });
  expect(await service.resolveDevicePrincipal(request(till.deviceToken))).toMatchObject({
    ...principal,
    deviceId: till.deviceId,
    branchId,
  });
  expect(await service.resolveDevicePrincipal(request("0".repeat(64)))).toBeNull();
  const secondChallenge = await service.issueEnrollment(principal, { branchId });
  const otherTill = await service.enroll({
    orgId: principal.orgId,
    code: secondChallenge.code,
    name: "Other till",
  });
  expect(await service.resolveDevicePrincipal(request(otherTill.deviceToken))).toBeNull();
  await service.assignPin(principal, { userId: principal.userId, pin: "9753" });
  expect(await service.resolveDevicePrincipal(request(till.deviceToken))).toBeNull();
  const fresh = await service.login({ ...credentials, pin: "9753" });
  await service.revoke(principal, { deviceId: till.deviceId });
  expect(
    await service.resolveDevicePrincipal(
      new Request("https://shopper.example/api", {
        headers: {
          authorization: `Bearer ${fresh.token}`,
          "x-shopper-device-token": till.deviceToken,
        },
      }),
    ),
  ).toBeNull();
  await expect(service.login({ ...credentials, pin: "9753" })).rejects.toThrow(
    "Invalid device credential",
  );
  const audits = await db
    .select()
    .from(schema.auditLog)
    .where(eq(schema.auditLog.orgId, context.orgId));
  const json = JSON.stringify(audits);
  expect(json).not.toContain('"pin":');
  for (const secret of [record!.pinHash, session.token, till.deviceToken])
    expect(json).not.toContain(secret);
});
const expireCredential = defineCommand({
  name: "devices.test.expire-credential",
  async run(tx, _context, input: { enrollmentId?: string; sessionToken?: string }) {
    if (input.enrollmentId)
      await tx
        .update(schema.deviceEnrollment)
        .set({ expiresAt: new Date(0) })
        .where(eq(schema.deviceEnrollment.id, input.enrollmentId));
    if (input.sessionToken) {
      const tokenHash = Array.from(
        new Uint8Array(
          await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input.sessionToken)),
        ),
        (b) => b.toString(16).padStart(2, "0"),
      ).join("");
      await tx
        .update(schema.cashierSession)
        .set({ expiresAt: new Date(0) })
        .where(eq(schema.cashierSession.tokenHash, tokenHash));
    }
    return {};
  },
  audit: () => ({}),
});
test("expiry and tenant scope reject credentials; cache outages cannot discard a committed login", async () => {
  const reset = defineCommand({
    name: "devices.test.reset-budget",
    async run(tx, c) {
      await tx
        .update(schema.enrollmentAttempt)
        .set({ lockedUntil: new Date(0) })
        .where(eq(schema.enrollmentAttempt.orgId, c.orgId));
      return {};
    },
    audit: () => ({}),
  });
  await reset(db, context, {});
  const expired = await service.issueEnrollment(principal, { branchId });
  await expireCredential(db, context, { enrollmentId: expired.enrollmentId });
  await expect(
    service.enroll({ orgId: principal.orgId, code: expired.code, name: "Expired" }),
  ).rejects.toThrow("expired");
  const issued = await service.issueEnrollment(principal, { branchId });
  const enrolled = await service.enroll({
    orgId: principal.orgId,
    code: issued.code,
    name: "Cache outage till",
  });
  const [budget] = await db
    .select()
    .from(schema.enrollmentAttempt)
    .where(eq(schema.enrollmentAttempt.orgId, principal.orgId));
  expect(budget!.attempts).toBe(1);
  await service.assignPin(principal, { userId: principal.userId, pin: "8642" });
  const credentials = {
    deviceId: enrolled.deviceId,
    deviceToken: enrolled.deviceToken,
    userId: principal.userId,
    pin: "8642",
  };
  const scoped = createDeviceService(db, cache, context.appVersion, v7());
  await expect(
    scoped.enroll({ orgId: principal.orgId, code: issued.code, name: "Wrong tenant" }),
  ).rejects.toThrow("Invalid enrollment");
  await expect(scoped.login(credentials)).rejects.toThrow("Invalid device credential");
  const readFailure: Cache = {
    request() {
      const real = cache.request();
      return {
        ...real,
        async get() {
          throw Error("cache read outage");
        },
      };
    },
  };
  const writeFailure: Cache = {
    request() {
      const real = cache.request();
      return {
        ...real,
        async put() {
          throw Error("cache write outage");
        },
      };
    },
  };
  const failedReadService = createDeviceService(db, readFailure, context.appVersion);
  const failedWriteService = createDeviceService(db, writeFailure, context.appVersion);
  const readSession = await failedReadService.login(credentials);
  const writeSession = await failedWriteService.login(credentials);
  const request = (token: string) =>
    new Request("https://shopper.example/api", {
      headers: { authorization: `Bearer ${token}`, "x-shopper-device-token": enrolled.deviceToken },
    });
  expect(await service.resolveDevicePrincipal(request(readSession.token))).toMatchObject({
    deviceId: enrolled.deviceId,
    branchId,
  });
  expect(await service.resolveDevicePrincipal(request(writeSession.token))).toMatchObject({
    deviceId: enrolled.deviceId,
    branchId,
  });
  expect(await scoped.resolveDevicePrincipal(request(writeSession.token))).toBeNull();
  await expireCredential(db, context, { sessionToken: writeSession.token });
  expect(await service.resolveDevicePrincipal(request(writeSession.token))).toBeNull();
  const mirror = await cache.request().get(principal.orgId, `pin/${principal.userId}`);
  expect(mirror).toEqual({ attempts: 0, lockedUntil: null });
});
