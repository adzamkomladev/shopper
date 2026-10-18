// Sign-in on the host: the upstream device login, the cached verifier, the published user and the cashier on receipts.
import { afterEach, expect, test } from "vite-plus/test";
import { eq } from "drizzle-orm";
import { hostSession, tillAudit, tillStaff } from "@shopper/db-sqlite";
import { ama, kofi, startStaffHost, type StaffHost } from "../../../../support/till/host/staff";

let ctx: StaffHost | undefined;
afterEach(async () => ctx?.close());

const audit = (c: StaffHost, command: string) =>
  c.fixture.database.read(async (tx) =>
    (await tx.select().from(tillAudit)).filter((row) => row.command === command),
  );

test("online sign-in stores the server session, caches the verifier and publishes the signed-in user", async () => {
  ctx = await startStaffHost();
  const reply = await ctx.signIn("Ama@Shop.Test", ama.password);
  expect(reply).toMatchObject({
    type: "result",
    kind: "status",
    status: {
      user: { userId: ama.userId, name: ama.name, permissions: ama.permissions, offline: false },
      permissions: ama.permissions,
    },
  });
  const { identity, deviceToken } = ctx.fixture.config;
  const login = ctx.upstream.requests.find((request) => request.path === "/cashiers/login");
  expect(login?.body).toEqual({
    deviceId: identity.deviceId,
    deviceToken,
    email: "Ama@Shop.Test",
    password: ama.password,
  });
  expect(login?.headers["x-shopper-org"]).toBe(identity.orgId);

  const issued = ctx.upstream.state.issued[0]!;
  const [session] = await ctx.fixture.database.read((tx) =>
    tx.select().from(hostSession).where(eq(hostSession.id, issued.id)),
  );
  expect(session).toMatchObject({
    userId: ama.userId,
    proof: issued.token,
    branchId: identity.branchId,
  });
  const [staff] = await ctx.fixture.database.read((tx) => tx.select().from(tillStaff));
  expect(staff).toMatchObject({
    userId: ama.userId,
    email: "ama@shop.test",
    name: ama.name,
    attempts: 0,
    lastSessionId: issued.id,
  });
  expect(staff!.verifier).toMatch(/^scrypt\$/);
  expect(staff!.verifier).not.toContain(ama.password);

  expect((await ctx.status()).user).toMatchObject({ userId: ama.userId, offline: false });
  const rows = await audit(ctx, "session.sign_in");
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({ actorId: ama.userId });
  expect(JSON.stringify(rows)).not.toContain(ama.password);
});

test("a wrong password is refused online and never falls back offline", async () => {
  ctx = await startStaffHost();
  await ctx.signIn(ama.email, ama.password);
  await ctx.signOut();
  ctx.upstream.users.get(ama.email)!.password = "changed on the server";

  // The cached verifier still matches this password; the server's 401 is final.
  expect(await ctx.signIn(ama.email, ama.password)).toMatchObject({
    type: "error",
    code: "INVALID_CREDENTIALS",
  });
  expect(await ctx.signIn(ama.email, "nonsense")).toMatchObject({ code: "INVALID_CREDENTIALS" });
  expect((await ctx.status()).user).toBeNull();

  ctx.upstream.state.mode = "locked";
  expect(await ctx.signIn(ama.email, "changed on the server")).toMatchObject({
    type: "error",
    code: "SIGN_IN_LOCKED",
  });
});

test("sign-out clears the session and the next basket edit is refused", async () => {
  ctx = await startStaffHost();
  await ctx.signIn(ama.email, ama.password);
  const productId = ctx.fixture.config.references.products[0].id;
  expect(await ctx.host.request({ type: "add", expectedRevision: 0, productId })).toMatchObject({
    kind: "draft",
  });

  const out = await ctx.signOut();
  expect(out).toMatchObject({ kind: "status", status: { user: null, permissions: [] } });
  expect(await ctx.host.request({ type: "add", expectedRevision: 1, productId })).toMatchObject({
    type: "error",
    code: "SESSION_REQUIRED",
  });
  expect(await ctx.host.request({ type: "readDraft" })).toMatchObject({ code: "SESSION_REQUIRED" });
  const rows = await audit(ctx, "session.sign_out");
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({ actorId: ama.userId });
});

test("the receipt cashier name is the signed-in staff name", async () => {
  ctx = await startStaffHost();
  await ctx.signIn(kofi.email, kofi.password);
  const productId = ctx.fixture.config.references.products[0].id;
  await ctx.host.request({ type: "add", expectedRevision: 0, productId });
  await ctx.host.request({ type: "tender.add", expectedRevision: 1, kind: "cash", amount: 12_000 });
  const sale = await ctx.host.request({ type: "sale.complete", expectedRevision: 2 });
  expect(sale).toMatchObject({ kind: "sale", receipt: { header: { cashier: kofi.name } } });
});
