// The register shows a cashier only while the host holds a live session for them.
import { afterEach, expect, test } from "vite-plus/test";
import { ama, startStaffHost, type StaffHost } from "../../../../support/till/host/staff";

let ctx: StaffHost | undefined;
afterEach(async () => ctx?.close());

const NINE_HOURS = 9 * 3_600_000;

test("once the session expires the status has no user", async () => {
  ctx = await startStaffHost([ama], undefined, { clockOffsetMs: 0 });
  await ctx.signIn(ama.email, ama.password);
  expect((await ctx.status()).user).toMatchObject({ userId: ama.userId });
  await ctx.host.setClock(NINE_HOURS);
  expect((await ctx.status()).user).toBeNull();
});

test("a sale refused for an expired session pushes a status without the cashier", async () => {
  ctx = await startStaffHost([ama], undefined, { clockOffsetMs: 0 });
  await ctx.signIn(ama.email, ama.password);
  await ctx.host.setClock(NINE_HOURS);
  let armed = false;
  const pushed = ctx.host.waitForStatus((status) => armed && status.user === null);
  armed = true;
  const productId = ctx.fixture.config.references.products[0].id;
  const reply = await ctx.host.request({ type: "add", expectedRevision: 0, productId });
  expect(reply).toMatchObject({ type: "error" });
  await expect(pushed).resolves.toMatchObject({ status: { user: null } });
});
