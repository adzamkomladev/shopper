import { beforeAll, afterAll, test, expect } from "vite-plus/test";
import { eq } from "drizzle-orm";
import * as schema from "@shopper/db-pg";
import * as auth from "@shopper/auth";
import { v7 } from "uuid";
import { postgresFixture } from "../../../fixtures/postgres";
import { migrateDatabase } from "../../../../tooling/database/migrate";
import { authLauncherFixture } from "../../../support/workflows/fixture";

let fixture: Awaited<ReturnType<typeof postgresFixture>>;
let db: schema.ShopperDatabase;
let workflows: ReturnType<typeof authLauncherFixture>;
const secret = "registration link secret with at least thirty two characters";
let now = Date.now();
const service = () =>
  auth.createOnboarding({
    database: db,
    linkSecret: secret,
    baseURL: "http://localhost:8787",
    launcher: workflows.launcher,
    now: () => now,
  });
const data = () => ({
  name: "Ama",
  email: `${v7()}@example.com`,
  shopName: "Ama Mart",
  shopCode: `ama-${v7()}`,
});
const tokenFor = (id: string) => auth.createLinkToken(secret, "registration", id);
beforeAll(async () => {
  fixture = await postgresFixture();
  workflows = authLauncherFixture(fixture.connectionString, {
    linkSecret: secret,
    baseURL: "http://localhost:8787",
    now: () => now,
  });
  db = workflows.database;
  await migrateDatabase(db);
});
afterAll(async () => {
  await workflows?.close();
  await fixture?.close();
});

test("registration creates no customer org before verification and completion provisions a verified owner atomically", async () => {
  const input = data();
  const started = await service().start(input);
  expect(await db.select().from(schema.org).where(eq(schema.org.id, started.id))).toHaveLength(0);
  const token = await tokenFor(started.id);
  await expect(
    service().complete({ id: started.id, token, password: "registration-password-123" }),
  ).rejects.toThrow("Verify");
  await service().verify({ id: started.id, token });
  const result = await service().complete({
    id: started.id,
    token,
    password: "registration-password-123",
  });
  expect(result).toEqual({ orgId: started.id, shopCode: input.shopCode, email: input.email });
  const owners = await db.select().from(schema.user).where(eq(schema.user.orgId, started.id));
  expect(owners).toHaveLength(1);
  expect(owners[0]?.emailVerified).toBe(true);
  expect(
    await db.select().from(schema.member).where(eq(schema.member.orgId, started.id)),
  ).toHaveLength(1);
  const replay = await service().complete({
    id: started.id,
    token,
    password: "different-password-123",
  });
  expect(replay).toEqual(result);
  const serialized = JSON.stringify(
    await db
      .select()
      .from(schema.registrationAuditLog)
      .where(eq(schema.registrationAuditLog.orgId, started.id)),
  );
  expect(serialized).not.toContain(token);
  expect(serialized).not.toContain("registration-password");
});

test("duplicate shop codes are corrected at completion without partial provisioning", async () => {
  const first = data();
  const a = await service().start(first);
  const at = await tokenFor(a.id);
  await service().verify({ id: a.id, token: at });
  await service().complete({ id: a.id, token: at, password: "registration-password-123" });
  const b = await service().start({ ...data(), shopCode: first.shopCode });
  const bt = await tokenFor(b.id);
  await service().verify({ id: b.id, token: bt });
  await expect(
    service().complete({ id: b.id, token: bt, password: "registration-password-123" }),
  ).rejects.toThrow("Shop code");
  expect(await db.select().from(schema.org).where(eq(schema.org.id, b.id))).toHaveLength(0);
  const result = await service().complete({
    id: b.id,
    token: bt,
    password: "registration-password-123",
    shopCode: `fixed-${v7()}`,
  });
  expect(result.orgId).toBe(b.id);
});

test("concurrent registration completion creates one owner and replay retains the winning password", async () => {
  const started = await service().start(data());
  const token = await tokenFor(started.id);
  await service().verify({ id: started.id, token });
  const input = { id: started.id, token, password: "concurrent-registration-password-123" };
  const results = await Promise.all([service().complete(input), service().complete(input)]);
  expect(results[0]).toEqual(results[1]);
  expect(await db.select().from(schema.org).where(eq(schema.org.id, started.id))).toHaveLength(1);
  const users = await db.select().from(schema.user).where(eq(schema.user.orgId, started.id));
  expect(users).toHaveLength(1);
  const before = await db
    .select()
    .from(schema.account)
    .where(eq(schema.account.userId, users[0]!.id));
  await service().complete({ ...input, password: "replay-cannot-replace-password-123" });
  const after = await db
    .select()
    .from(schema.account)
    .where(eq(schema.account.userId, users[0]!.id));
  expect(after[0]?.password).toBe(before[0]?.password);
});

test("invalid and expired registration links fail even after service restart", async () => {
  const started = await service().start(data());
  const token = await tokenFor(started.id);
  await expect(service().verify({ id: started.id, token: "invalid" })).rejects.toThrow("link");
  now += 24 * 60 * 60 * 1000;
  await expect(service().verify({ id: started.id, token })).rejects.toThrow("link");
});
