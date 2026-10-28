import { expect, test } from "vite-plus/test";
import { and, eq } from "drizzle-orm";
import * as schema from "@shopper/db-pg";
import { defineCommand } from "@shopper/audit";
import {
  api,
  databases,
  fixtureSession,
  principal,
  recordSale,
  resetLocalTill,
} from "../../../support/till/server";
import { pushEvents } from "../../../support/till/requests";
import { hour, morning, offlineRows, offlineSale } from "../../../support/sync/offline";

test("a sale under an offline session after the server session expired is accepted, and the session recorded once", async () => {
  const first = await offlineSale();
  expect(first.body.rejected).toEqual([]);
  expect(first.body.accepted).toHaveLength(1);
  // A second sale under the same offline session reuses the adopted row.
  const parent = fixtureSession();
  const again = await recordSale({
    session: {
      ...parent,
      id: first.id,
      parentSessionId: parent.id,
      issuedAt: new Date(morning).toISOString(),
      expiresAt: new Date(morning + 8 * hour).toISOString(),
      proof: `${parent.proof}.${first.id}`,
    },
    at: new Date(morning + 2 * hour).toISOString(),
  });
  const offline = {
    parentSessionId: parent.id,
    issuedAt: new Date(morning).toISOString(),
    expiresAt: new Date(morning + 8 * hour).toISOString(),
    permissions: parent.permissions,
  };
  const response = await pushEvents(
    api,
    [again.event],
    [{ sessionId: first.id, proof: `${parent.proof}.${first.id}`, offline }],
  );
  expect((await response.json()).accepted).toHaveLength(1);

  expect(await offlineRows(first.id)).toMatchObject([
    {
      parentSessionId: parent.id,
      userId: principal.userId,
      deviceId: parent.deviceId,
      issuedAt: new Date(morning),
      expiresAt: new Date(morning + 8 * hour),
      revokedAt: null,
    },
  ]);
  const audits = await databases()
    .db.select()
    .from(schema.auditLog)
    .where(
      and(
        eq(schema.auditLog.command, "cashier.session.offline"),
        eq(schema.auditLog.entityId, first.id),
      ),
    );
  expect(audits).toHaveLength(1);
});

test("offline sessions that do not follow from a live server session are refused", async () => {
  const parent = fixtureSession();
  // Granted to the role after the parent session captured its permissions.
  const later = ["report.read", "stock.read", "customer.manage"].find(
    (code) => !parent.permissions.includes(code),
  )!;
  await grant(databases().db, databases().context, { roleId: principal.roleId, code: later });
  const refusals = [
    // Not the parent's proof.
    { proof: `${"0".repeat(parent.proof.length)}.x` },
    // Begun before the parent was issued.
    { issuedAt: Date.parse(parent.issuedAt) - hour, expiresAt: Date.parse(parent.issuedAt) + hour },
    // Begun after the 7-day offline verifier window.
    {
      issuedAt: Date.parse(parent.expiresAt) + 8 * 24 * hour,
      expiresAt: Date.parse(parent.expiresAt) + 8 * 24 * hour + hour,
    },
    // Longer than a shift.
    { expiresAt: morning + 9 * hour },
    // A permission the role holds now but the parent session never had.
    { permissions: [...parent.permissions, later] },
    // A manager permission the role never had.
    { permissions: [...parent.permissions, "refund.approve"] },
  ];
  for (const overrides of refusals) {
    const at = overrides.issuedAt !== undefined ? overrides.issuedAt + 60_000 : morning + hour;
    const { id, body } = await offlineSale(overrides, at);
    expect(body.rejected, JSON.stringify(overrides)).toMatchObject([{ code: "INVALID_SESSION" }]);
    expect(await offlineRows(id)).toEqual([]);
  }
});

test("a revoked parent session or a role that lost the sale grant stops new offline sessions", async () => {
  await revokeSession(databases().db, databases().context, { sessionId: fixtureSession().id });
  expect((await offlineSale()).body.rejected).toMatchObject([{ code: "INVALID_SESSION" }]);

  await resetLocalTill();
  await removeSaleGrant(databases().db, databases().context, { roleId: principal.roleId });
  const refused = await offlineSale();
  expect(refused.body.rejected).toMatchObject([{ code: "INVALID_SESSION" }]);
  expect(await offlineRows(refused.id)).toEqual([]);
});

const grant = defineCommand({
  name: "sync.test.grant-permission",
  async run(tx, ctx, input: { roleId: string; code: string }) {
    const [permission] = await tx
      .select()
      .from(schema.permission)
      .where(and(eq(schema.permission.orgId, ctx.orgId), eq(schema.permission.code, input.code)));
    await tx
      .insert(schema.rolePermission)
      .values({ orgId: ctx.orgId, roleId: input.roleId, permissionId: permission!.id })
      .onConflictDoNothing();
    return {};
  },
  audit: () => ({}),
});

const revokeSession = defineCommand({
  name: "sync.test.revoke-session",
  async run(tx, ctx, input: { sessionId: string }) {
    await tx
      .update(schema.cashierSession)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(schema.cashierSession.orgId, ctx.orgId),
          eq(schema.cashierSession.id, input.sessionId),
        ),
      );
    return {};
  },
  audit: () => ({}),
});

const removeSaleGrant = defineCommand({
  name: "sync.test.remove-offline-sale-grant",
  async run(tx, ctx, input: { roleId: string }) {
    const [permission] = await tx
      .select()
      .from(schema.permission)
      .where(
        and(eq(schema.permission.orgId, ctx.orgId), eq(schema.permission.code, "sale.create")),
      );
    await tx
      .delete(schema.rolePermission)
      .where(
        and(
          eq(schema.rolePermission.orgId, ctx.orgId),
          eq(schema.rolePermission.roleId, input.roleId),
          eq(schema.rolePermission.permissionId, permission!.id),
        ),
      );
    return {};
  },
  audit: () => ({}),
});
