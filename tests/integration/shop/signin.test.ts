// Day 30 S1: a shopper signs in to one shop with the code texted to their phone.
//   access.start(org, phone)        -> { loginId }; queues `shop.otp` with no code in it
//   access.verify(org, login, code) -> ok + a session token, or wrong / locked / expired
//   access.resend(org, login)       -> a new code, at most three sends
//   access.session(token)           -> the org and account the token belongs to, or null
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { and, eq } from "drizzle-orm";
import * as schema from "@shopper/db-pg";
import { verifyChain } from "@shopper/audit";
import { createShopAccess, loginCode } from "@shopper/core/shop";
import { linkSecret, shopWorld } from "../../support/shop/world";

let world: Awaited<ReturnType<typeof shopWorld>>;
let access: ReturnType<typeof createShopAccess>;

beforeAll(async () => {
  world = await shopWorld();
  access = createShopAccess({
    database: world.db,
    linkSecret,
    appVersion: "test",
    queue: world.queue,
    now: world.clock.now,
  });
});
afterAll(async () => world?.close());

const codeOf = (loginId: string, send = 1) => loginCode(linkSecret, loginId, send);
const wrongOf = async (loginId: string, send = 1) =>
  String((Number(await codeOf(loginId, send)) + 1) % 1_000_000).padStart(6, "0");

test("a right code signs in once, makes the account and a session that names its shop", async () => {
  const { loginId } = await access.start(world.a.orgId, "+233 24 123 4567");
  const message = world.sent.at(-1)!;
  expect(message).toMatchObject({
    orgId: world.a.orgId,
    type: "shop.otp",
    payload: { loginId, send: 1 },
  });
  const code = await codeOf(loginId);
  expect(JSON.stringify(message)).not.toContain(code);
  const [row] = await world.db
    .select()
    .from(schema.shopLogin)
    .where(eq(schema.shopLogin.id, loginId));
  expect(row).toMatchObject({ phone: "0241234567", sends: 1, attempts: 0 });
  expect(JSON.stringify(row)).not.toContain(code);

  const signedIn = await access.verify(world.a.orgId, loginId, code);
  expect(signedIn).toMatchObject({ outcome: "ok", token: expect.any(String) });
  if (signedIn.outcome !== "ok") throw new Error("expected a session");
  const session = await access.session(signedIn.token);
  expect(session).toMatchObject({
    orgId: world.a.orgId,
    accountId: signedIn.accountId,
    phone: "0241234567",
  });
  const [stored] = await world.db.select().from(schema.shopSession);
  expect(stored!.tokenDigest).not.toBe(signedIn.token);

  // The code is spent: the same code again opens nothing.
  expect(await access.verify(world.a.orgId, loginId, code)).toEqual({ outcome: "expired" });
  // Signing in again later finds the same account, not a second one.
  const again = await access.start(world.a.orgId, "0241234567");
  const second = await access.verify(world.a.orgId, again.loginId, await codeOf(again.loginId));
  expect(second).toMatchObject({ outcome: "ok", accountId: signedIn.accountId });
  const accounts = await world.db
    .select()
    .from(schema.shopAccount)
    .where(eq(schema.shopAccount.orgId, world.a.orgId));
  expect(accounts).toHaveLength(1);
});

test("five wrong codes lock the attempt, even for the right code after", async () => {
  const { loginId } = await access.start(world.a.orgId, "0201112222");
  for (let attempt = 1; attempt <= 5; attempt++)
    expect(await access.verify(world.a.orgId, loginId, await wrongOf(loginId))).toEqual(
      attempt < 5 ? { outcome: "wrong", attemptsLeft: 5 - attempt } : { outcome: "locked" },
    );
  expect(await access.verify(world.a.orgId, loginId, await codeOf(loginId))).toEqual({
    outcome: "locked",
  });
  const [row] = await world.db
    .select()
    .from(schema.shopLogin)
    .where(eq(schema.shopLogin.id, loginId));
  expect(row!.attempts).toBe(5);
  expect(
    await world.db
      .select()
      .from(schema.shopAccount)
      .where(eq(schema.shopAccount.phone, "0201112222")),
  ).toEqual([]);
});

test("a code is refused once ten minutes have passed", async () => {
  const { loginId } = await access.start(world.a.orgId, "0203334444");
  world.clock.add(10 * 60_000 + 1);
  expect(await access.verify(world.a.orgId, loginId, await codeOf(loginId))).toEqual({
    outcome: "expired",
  });
});

test("a resend sends a new code that replaces the old one, three sends at most", async () => {
  const { loginId } = await access.start(world.a.orgId, "0205556666");
  expect(await access.resend(world.a.orgId, loginId)).toEqual({ sent: true });
  expect(await access.resend(world.a.orgId, loginId)).toEqual({ sent: true });
  expect(await access.resend(world.a.orgId, loginId)).toEqual({ sent: false });
  expect(
    world.sent.filter((m) => (m.payload as { loginId?: string }).loginId === loginId),
  ).toHaveLength(3);
  expect(await access.verify(world.a.orgId, loginId, await codeOf(loginId, 1))).toMatchObject({
    outcome: "wrong",
  });
  expect(await access.verify(world.a.orgId, loginId, await codeOf(loginId, 3))).toMatchObject({
    outcome: "ok",
  });
});

test("a login of one shop cannot be completed at another", async () => {
  const { loginId } = await access.start(world.a.orgId, "0207778888");
  await expect(access.verify(world.b.orgId, loginId, await codeOf(loginId))).rejects.toMatchObject({
    status: 404,
  });
});

test("signing out, expiry and a forged token all leave no session", async () => {
  const { loginId } = await access.start(world.b.orgId, "0249990000");
  const ok = await access.verify(world.b.orgId, loginId, await codeOf(loginId));
  if (ok.outcome !== "ok") throw new Error("expected a session");
  expect(await access.session(`${ok.token}x`)).toBeNull();
  await access.signOut(ok.token);
  expect(await access.session(ok.token)).toBeNull();

  const next = await access.start(world.b.orgId, "0249990000");
  const later = await access.verify(world.b.orgId, next.loginId, await codeOf(next.loginId));
  if (later.outcome !== "ok") throw new Error("expected a session");
  world.clock.add(30 * 24 * 60 * 60_000 + 1);
  expect(await access.session(later.token)).toBeNull();
});

test("an invalid phone is refused before anything is stored, and every step is audited", async () => {
  await expect(access.start(world.a.orgId, "12345")).rejects.toMatchObject({ status: 400 });
  for (const org of [world.a.orgId, world.b.orgId]) {
    const chain = await world.db
      .select()
      .from(schema.auditLog)
      .where(eq(schema.auditLog.orgId, org))
      .orderBy(schema.auditLog.chainSeq);
    expect(await verifyChain(chain)).toMatchObject({ valid: true });
  }
  const [audit] = await world.db
    .select()
    .from(schema.auditLog)
    .where(
      and(
        eq(schema.auditLog.orgId, world.a.orgId),
        eq(schema.auditLog.command, "shop.login.start"),
      ),
    );
  expect(JSON.stringify(audit!.payload)).not.toContain("0241234567");
});
