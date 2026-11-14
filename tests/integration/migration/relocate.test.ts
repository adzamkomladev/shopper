// Day 42: a register claims its place in the cloud with the relocation the cloud signed. It keeps its device id and
// gets a new token; the code works once, for that register only, before it expires, and only once the shop is in.
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { and, eq, sql } from "drizzle-orm";
import { verifyChain } from "@shopper/audit";
import { verifyRelocation, type Relocation } from "@shopper/core/licence";
import * as schema from "@shopper/db-pg";
import { sha256 } from "@shopper/utils";
import { CLOUD, movedIn } from "../../support/migration/cloud";

let m: Awaited<ReturnType<typeof movedIn>>;
beforeAll(async () => {
  // A second register, so one register's code can be tried on another.
  m = await movedIn(async (f) => {
    const [register] = await f.db
      .select()
      .from(schema.device)
      .where(eq(schema.device.id, f.sale.deviceId));
    await f.db
      .insert(schema.device)
      .values({ orgId: f.ctx.orgId, branchId: register!.branchId, name: "Till 2" });
  });
});
afterAll(async () => m?.close());

const relocate = (relocation: Relocation, code = relocation.code) =>
  m.api.request("/devices/relocate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ orgId: relocation.orgId, deviceId: relocation.deviceId, code }),
  });
const setImport = (status: "importing" | "ready") =>
  m.b.db.update(schema.archiveImport).set({ status });

test("every register's relocation is genuine and names the cloud; a changed one is not", async () => {
  const first = m.relocations[0]!;
  const register = { orgId: first.orgId, deviceId: first.deviceId };
  expect(await verifyRelocation(m.issuer.publicKey, first, register)).toMatchObject({
    upstream: CLOUD,
  });
  for (const tampered of [
    { ...first, upstream: "https://evil.test/api" },
    { ...first, expiresAt: "2099-01-01T00:00:00.000Z" },
  ])
    expect(await verifyRelocation(m.issuer.publicKey, tampered, register)).toBeUndefined();
  // Another register cannot take this one's message, and an expired one is refused.
  expect(
    await verifyRelocation(m.issuer.publicKey, first, { ...register, deviceId: m.a.f.userId }),
  ).toBeUndefined();
  expect(
    await verifyRelocation(m.issuer.publicKey, first, register, new Date("2099-01-01")),
  ).toBeUndefined();
});

test("a register waits while the shop is still moving, then gets a token for the same device", async () => {
  const relocation = m.relocations[0]!;
  await setImport("importing");
  const early = await relocate(relocation);
  expect(early.status).toBe(409);
  await setImport("ready");

  const claimed = await relocate(relocation);
  expect(claimed.status).toBe(201);
  const body = (await claimed.json()) as { deviceId: string; deviceToken: string };
  expect(body.deviceId).toBe(relocation.deviceId);
  const [credential] = await m.b.db
    .select()
    .from(schema.deviceCredential)
    .where(eq(schema.deviceCredential.deviceId, relocation.deviceId));
  expect(credential).toMatchObject({ tokenHash: await sha256(body.deviceToken), revokedAt: null });

  // The code is spent: a second claim, even with the right code, is refused.
  expect((await relocate(relocation)).status).toBe(401);
  const chain = await m.b.db
    .select()
    .from(schema.auditLog)
    .where(eq(schema.auditLog.orgId, relocation.orgId))
    .orderBy(schema.auditLog.chainSeq);
  expect(chain.at(-1)).toMatchObject({ command: "device.relocate" });
  expect(JSON.stringify(chain.at(-1)!.payload)).not.toContain(relocation.code);
  expect(await verifyChain(chain)).toMatchObject({ valid: true });
});

test("a wrong code, another register's code or an expired code is refused", async () => {
  const [, second] = m.relocations;
  if (!second) throw new Error("The fixture has two registers");
  expect((await relocate(second, "x".repeat(32))).status).toBe(401);
  expect(
    (await relocate({ ...second, deviceId: m.relocations[0]!.deviceId }, second.code)).status,
  ).toBe(401);
  await m.b.db.update(schema.archiveImport).set({
    relocations: sql`jsonb_set(${schema.archiveImport.relocations}, ${`{${second.deviceId},expiresAt}`}::text[], '"2020-01-01T00:00:00.000Z"')`,
  });
  expect((await relocate(second)).status).toBe(401);
  const credentials = await m.b.db
    .select()
    .from(schema.deviceCredential)
    .where(
      and(
        eq(schema.deviceCredential.orgId, second.orgId),
        eq(schema.deviceCredential.deviceId, second.deviceId),
      ),
    );
  expect(credentials).toEqual([]);
});
