import { expect, test } from "vite-plus/test";
import { v7 } from "uuid";
import { eq } from "drizzle-orm";
import * as schema from "@shopper/db-pg";
import { createDeviceService } from "@shopper/auth/devices";
import { defineCommand } from "@shopper/audit";
import type { Cache } from "@shopper/ports";
import { db, service, principal, branchId, context, cache } from "../setup";

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
