// Offline sign-in: the cached scrypt verifier, the resumed or restricted session, and the lockout.
import { afterEach, expect, test } from "vite-plus/test";
import { sql } from "drizzle-orm";
import { ama, startStaffHost, type StaffHost } from "../../../../support/till/host/staff";

let ctx: StaffHost | undefined;
afterEach(async () => ctx?.close());

const sql_ = (c: StaffHost, statement: ReturnType<typeof sql>) =>
  c.fixture.database.transaction((tx) => tx.run(statement));

/** Signs in once online (caching the verifier), signs out and takes the server away. */
async function cachedThenOffline(staff = [ama]) {
  ctx = await startStaffHost(staff);
  await ctx.signIn(ama.email, ama.password);
  await ctx.signOut();
  ctx.upstream.state.mode = "down";
  return ctx;
}

test("offline, a cached password resumes the user's unexpired server session and sales are allowed", async () => {
  const c = await cachedThenOffline();
  const reply = await c.signIn(ama.email, ama.password);
  expect(reply).toMatchObject({
    kind: "status",
    status: { user: { userId: ama.userId, offline: true, permissions: ama.permissions } },
  });
  const productId = c.fixture.config.references.products[0].id;
  expect(await c.host.request({ type: "add", expectedRevision: 0, productId })).toMatchObject({
    kind: "draft",
  });
});

test("offline with an expired session a new offline session sells, without manager permissions", async () => {
  const c = await cachedThenOffline([
    {
      ...ama,
      permissions: ["sale.create", "report.read", "refund.approve", "sale.price_override"],
    },
  ]);
  await sql_(c, sql`update host_session set expires_at = '2020-01-01T00:00:00.000Z'`);
  const reply = await c.signIn(ama.email, ama.password);
  expect(reply).toMatchObject({
    status: {
      user: { userId: ama.userId, offline: true, permissions: ["sale.create", "report.read"] },
      permissions: ["sale.create", "report.read"],
    },
  });
  const productId = c.fixture.config.references.products[0].id;
  expect(await c.host.request({ type: "add", expectedRevision: 0, productId })).toMatchObject({
    kind: "draft",
  });
});

test("an uncached user, a wrong password or a verifier older than seven days is refused", async () => {
  const c = await cachedThenOffline();
  expect(await c.signIn("nobody@shop.test", "whatever")).toMatchObject({
    type: "error",
    code: "OFFLINE_UNAVAILABLE",
  });
  expect(await c.signIn(ama.email, "wrong password")).toMatchObject({
    type: "error",
    code: "INVALID_CREDENTIALS",
  });
  await sql_(c, sql`update till_staff set verified_at = '2020-01-01T00:00:00.000Z'`);
  expect(await c.signIn(ama.email, ama.password)).toMatchObject({
    type: "error",
    code: "OFFLINE_UNAVAILABLE",
  });
  expect((await c.status()).user).toBeNull();
});

test("five offline failures lock for fifteen minutes", async () => {
  const c = await cachedThenOffline();
  for (let attempt = 0; attempt < 5; attempt++)
    expect(await c.signIn(ama.email, "wrong password")).toMatchObject({
      code: "INVALID_CREDENTIALS",
    });
  // Even the right password is refused while locked.
  expect(await c.signIn(ama.email, ama.password)).toMatchObject({
    type: "error",
    code: "SIGN_IN_LOCKED",
  });
  await sql_(c, sql`update till_staff set locked_until = 1`);
  expect(await c.signIn(ama.email, ama.password)).toMatchObject({
    kind: "status",
    status: { user: { offline: true } },
  });
});

test("five parallel wrong offline passwords still lock", async () => {
  const c = await cachedThenOffline();
  await Promise.all(Array.from({ length: 5 }, () => c.signIn(ama.email, "wrong password")));
  expect(await c.signIn(ama.email, ama.password)).toMatchObject({ code: "SIGN_IN_LOCKED" });
});
