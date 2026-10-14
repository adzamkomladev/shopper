import { expect, test } from "vite-plus/test";
import { and, eq } from "drizzle-orm";
import { v7 } from "uuid";
import * as schema from "@shopper/db-pg";
import { defineCommand } from "@shopper/audit";
import {
  api,
  databases,
  deviceId,
  deviceToken,
  devices,
  principal,
  recordSale,
} from "../../../support/till/server";
import { push, syncHeaders } from "../../../support/till/requests";

const revokeGrant = defineCommand({
  name: "sync.test.remove-sale-grant",
  async run(tx, ctx, input: { roleId: string }) {
    const [permission] = await tx
      .select()
      .from(schema.permission)
      .where(
        and(eq(schema.permission.orgId, ctx.orgId), eq(schema.permission.code, "sale.create")),
      );
    if (!permission) throw new Error("Expected sale.create permission");
    await tx
      .delete(schema.rolePermission)
      .where(
        and(
          eq(schema.rolePermission.orgId, ctx.orgId),
          eq(schema.rolePermission.roleId, input.roleId),
          eq(schema.rolePermission.permissionId, permission.id),
        ),
      );
    return {};
  },
  audit: () => ({}),
});

test("historical grants survive role changes while new sessions capture the reduced grant", async () => {
  const captured = await recordSale();
  await revokeGrant(databases().db, databases().context, { roleId: principal.roleId });
  expect((await push(api, captured.event, captured.proof, captured.sessionId)).status).toBe(200);
  const audits = await databases()
    .db.select()
    .from(schema.auditLog)
    .where(eq(schema.auditLog.entityId, captured.event.sale.localId));
  expect(audits).toHaveLength(2);
  for (const audit of audits) {
    expect(audit).toMatchObject({
      actorId: principal.userId,
      role: principal.roleName,
      deviceId,
      branchId: captured.event.sale.branchId,
      appVersion: captured.event.sale.appVersion,
    });
    expect(audit.deviceTime?.toISOString()).toBe(captured.event.sale.deviceTime);
  }
  const fresh = await devices.login({
    deviceId,
    deviceToken,
    userId: principal.userId,
    pin: "1357",
  });
  expect(fresh.permissions).not.toContain("sale.create");
  const unauthorized = await recordSale();
  unauthorized.event.sale.sessionId = fresh.id;
  unauthorized.event.sale.deviceTime = fresh.issuedAt.toISOString();
  const response = await push(api, unauthorized.event, fresh.token, fresh.id);
  expect(response.status).toBe(200);
  expect((await response.json()).rejected).toMatchObject([{ code: "INVALID_SESSION" }]);
});

test("store and branch selectors cannot override the enrolled device scope", async () => {
  const captured = await recordSale();
  for (const selector of ["X-Shopper-Store", "X-Shopper-Branch"]) {
    const response = await api.request("/sync/push", {
      method: "POST",
      headers: { ...syncHeaders(), [selector]: v7() },
      body: JSON.stringify({
        requestId: v7(),
        protocol: 1,
        events: [captured.event],
        proofs: [{ sessionId: captured.sessionId, proof: captured.proof }],
      }),
    });
    expect(response.status).toBe(401);
  }
});
