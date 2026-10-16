import { expect, test } from "vite-plus/test";
import { asc, eq } from "drizzle-orm";
import { verifyChain } from "@shopper/audit";
import { v7 } from "uuid";
import * as schema from "@shopper/db-pg";
import { ids } from "../../support/till/sales";
import {
  api,
  databases,
  deviceId,
  deviceToken,
  devices,
  principal,
  recordSale,
  syncProtocol,
} from "../../support/till/server";
import { push, revokeDevice, syncHeaders } from "../../support/till/requests";

test("device authentication is required and an expired cashier session can upload its in-window sale", async () => {
  const captured = await recordSale();
  const missingDevice = await api.request("/sync/push", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      requestId: v7(),
      protocol: syncProtocol,
      events: [captured.event],
      proofs: [{ sessionId: captured.sessionId, proof: captured.proof }],
    }),
  });
  expect(missingDevice.status).toBe(401);

  const accepted = await push(api, captured.event, captured.proof, captured.sessionId);
  expect(accepted.status).toBe(200);
  expect((await accepted.json()).accepted).toHaveLength(1);
  const { db } = databases();
  const session = await db
    .select()
    .from(schema.cashierSession)
    .where(eq(schema.cashierSession.deviceId, deviceId));
  expect(session[0]?.expiresAt.valueOf()).toBeLessThan(Date.now());
});

test("forged cashier proofs and cross-tenant product references are rejected without leaking secrets", async () => {
  const captured = await recordSale();
  const forged = await push(api, captured.event, "forged-cashier-proof", captured.sessionId);
  expect(forged.status).toBe(200);
  expect((await forged.json()).rejected).toMatchObject([{ localId: captured.event.sale.localId }]);

  const mismatchedSession = await push(api, captured.event, captured.proof, v7());
  expect(mismatchedSession.status).toBe(200);
  expect((await mismatchedSession.json()).rejected).toMatchObject([
    { localId: captured.event.sale.localId },
  ]);

  const otherProductEvent = structuredClone(captured.event);
  const otherProductLine = otherProductEvent.sale.lines[0];
  if (!otherProductLine) throw new Error("Expected recorded sale line");
  otherProductLine.productId = ids.otherProduct;
  const crossTenant = await push(api, otherProductEvent, captured.proof, captured.sessionId);
  expect(crossTenant.status).toBe(200);
  expect((await crossTenant.json()).rejected).toMatchObject([
    { localId: captured.event.sale.localId },
  ]);

  const alteredCashier = structuredClone(captured.event);
  alteredCashier.sale.cashierId = v7();
  const forgedAttribution = await push(api, alteredCashier, captured.proof, captured.sessionId);
  expect(forgedAttribution.status).toBe(200);
  expect((await forgedAttribution.json()).rejected).toMatchObject([
    { localId: captured.event.sale.localId },
  ]);

  const mismatchedOrg = await api.request("/sync/push", {
    method: "POST",
    headers: syncHeaders(ids.otherOrg),
    body: JSON.stringify({
      requestId: v7(),
      protocol: syncProtocol,
      events: [captured.event],
      proofs: [{ sessionId: captured.sessionId, proof: captured.proof }],
    }),
  });
  expect([400, 401, 403]).toContain(mismatchedOrg.status);
  const { db, context } = databases();
  const audits = await db
    .select()
    .from(schema.auditLog)
    .where(eq(schema.auditLog.orgId, context.orgId));
  const serialized = JSON.stringify(audits);
  expect(serialized).not.toContain(captured.proof);
  expect(serialized).not.toContain(deviceToken);
});

test("a sale recorded before the cashier session was issued is rejected", async () => {
  const captured = await recordSale();
  const outsideWindow = structuredClone(captured.event);
  outsideWindow.sale.deviceTime = "2025-12-30T23:30:00.000Z";
  const response = await push(api, outsideWindow, captured.proof, captured.sessionId);
  expect(response.status).toBe(200);
  expect((await response.json()).rejected).toMatchObject([
    { localId: captured.event.sale.localId },
  ]);
});

test("mixed-case cashier identity preserves the persisted audit chain", async () => {
  await devices.login({
    deviceId,
    deviceToken,
    userId: principal.userId.toUpperCase(),
    pin: "1357",
  });
  const { db, context } = databases();
  const rows = await db
    .select()
    .from(schema.auditLog)
    .where(eq(schema.auditLog.orgId, context.orgId))
    .orderBy(asc(schema.auditLog.chainSeq));
  expect(await verifyChain(rows)).toMatchObject({ valid: true });
});

test("a revoked enrolled device can no longer upload queued sales", async () => {
  const captured = await recordSale();
  await revokeDevice();
  const response = await push(api, captured.event, captured.proof, captured.sessionId);
  expect(response.status).toBe(401);
  expect(deviceToken).toHaveLength(64);
});
