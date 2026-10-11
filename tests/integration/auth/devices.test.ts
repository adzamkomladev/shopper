import { expect, test } from "vite-plus/test";
import { v7 } from "uuid";
import { eq } from "drizzle-orm";
import * as schema from "@shopper/db-pg";
import { verifyChain } from "@shopper/audit";
import { db, service, principal, branchId, context } from "./device-setup";

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
