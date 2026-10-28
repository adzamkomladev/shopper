import { expect, onTestFinished, test } from "vite-plus/test";
import { v7 } from "uuid";
import { and, eq } from "drizzle-orm";
import * as schema from "@shopper/db-pg";
import { defineCommand } from "@shopper/audit";
import { offlineWithheld } from "@shopper/core/schemas";
import {
  api,
  databases,
  deviceId,
  deviceToken,
  devices,
  principal,
} from "../../../support/till/server";
import { syncHeaders } from "../../../support/till/requests";
import { deactivate, hour, morning, offlineRows, offlineSale } from "../../../support/sync/offline";

// What ends a cashier's access also ends an offline session the server adopts only afterwards.

test("deactivating the cashier ends an offline session adopted afterwards at the deactivation", async () => {
  onTestFinished(() =>
    deactivate(databases().db, databases().context, { userId: principal.userId, at: null }),
  );
  await deactivate(databases().db, databases().context, {
    userId: principal.userId,
    at: new Date(morning + 2 * hour),
  });
  const late = await offlineSale({}, morning + 3 * hour);
  expect(late.body.rejected).toMatchObject([{ code: "INVALID_SESSION" }]);
  expect(await offlineRows(late.id)).toMatchObject([{ expiresAt: new Date(morning + 2 * hour) }]);
  // Selling before the deactivation still stands under the same session.
  const early = await offlineSale({ id: late.id }, morning + hour);
  expect(early.body.accepted).toHaveLength(1);
});

test("limiting the cashier to another branch ends an offline session adopted afterwards at the change", async () => {
  onTestFinished(() => rescope(databases().db, databases().context, { userId: principal.userId }));
  await rescope(databases().db, databases().context, {
    userId: principal.userId,
    at: new Date(morning + 2 * hour),
  });
  const late = await offlineSale({}, morning + 3 * hour);
  expect(late.body.rejected).toMatchObject([{ code: "INVALID_SESSION" }]);
  expect(await offlineRows(late.id)).toMatchObject([{ expiresAt: new Date(morning + 2 * hour) }]);
  const early = await offlineSale({ id: late.id }, morning + hour);
  expect(early.body.accepted).toHaveLength(1);
});

test("a live request under an offline session is authorised once the register had it adopted", async () => {
  await devices.assignPin(principal, { userId: principal.userId, pin: "1357" });
  const parent = await devices.login({
    deviceId,
    deviceToken,
    userId: principal.userId,
    pin: "1357",
  });
  const id = v7();
  const proof = `${parent.token}.${id}`;
  const issuedAt = Date.parse(parent.issuedAt) + 1_000;
  const offline = {
    parentSessionId: parent.id,
    issuedAt: new Date(issuedAt).toISOString(),
    expiresAt: new Date(issuedAt + 8 * hour).toISOString(),
    permissions: parent.permissions.filter((code) => !offlineWithheld.includes(code)),
  };
  // What MoMo and remote approvals send: the cashier's proof and the device token, nothing to adopt with.
  const live = () =>
    devices.resolveDevicePrincipal(
      new Request("http://till.test/payments/momo", {
        headers: { authorization: `Bearer ${proof}`, "x-shopper-device-token": deviceToken },
      }),
    );
  expect(await live()).toBeNull();
  const adopted = await api.request("/sync/sessions", {
    method: "POST",
    headers: syncHeaders(),
    body: JSON.stringify({ proof, offline }),
  });
  expect(await adopted.json()).toEqual({ adopted: true });
  expect(await live()).toMatchObject({ userId: principal.userId, deviceId });
});

/** Limits the member to a new branch from `at` (as `setMemberBranches` would), or lifts the limit. */
const rescope = defineCommand({
  name: "sync.test.member-scope",
  async run(tx, ctx, input: { userId: string; at?: Date }) {
    const [person] = await tx
      .select()
      .from(schema.member)
      .where(and(eq(schema.member.orgId, ctx.orgId), eq(schema.member.userId, input.userId)));
    await tx
      .delete(schema.memberBranch)
      .where(
        and(eq(schema.memberBranch.orgId, ctx.orgId), eq(schema.memberBranch.memberId, person!.id)),
      );
    if (!input.at) return {};
    const [home] = await tx.select().from(schema.branch).where(eq(schema.branch.orgId, ctx.orgId));
    const elsewhere = v7();
    await tx
      .insert(schema.branch)
      .values({ id: elsewhere, orgId: ctx.orgId, storeId: home!.storeId, name: "Elsewhere" });
    await tx.insert(schema.memberBranch).values({
      orgId: ctx.orgId,
      memberId: person!.id,
      branchId: elsewhere,
      createdAt: input.at,
    });
    return {};
  },
  audit: () => ({}),
});
