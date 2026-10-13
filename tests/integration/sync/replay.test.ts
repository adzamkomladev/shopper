import { expect, test } from "vite-plus/test";
import { and, eq } from "drizzle-orm";
import * as schema from "@shopper/db-pg";
import { createApi } from "@shopper/api";
import { serveHono } from "../../support/till/http";
import { api as syncApi, databases, devices, recordSale } from "../../support/till/server";
import { createFailOnceSequencer, push } from "../../support/till/requests";
test("concurrent and sequential replay assign one sequence; changed content conflicts", async () => {
  const { db, context } = databases();
  const captured = await recordSale();
  const first = await push(syncApi, captured.event, captured.proof, captured.sessionId);
  const firstBody = await first.json();
  expect(firstBody.accepted).toHaveLength(1);
  const saleId = captured.event.sale.localId;
  const auditBefore = await db
    .select()
    .from(schema.auditLog)
    .where(and(eq(schema.auditLog.orgId, context.orgId), eq(schema.auditLog.entityId, saleId)));

  const duplicates = await Promise.all([
    push(syncApi, captured.event, captured.proof, captured.sessionId),
    push(syncApi, captured.event, captured.proof, captured.sessionId),
  ]);
  const duplicateBodies = await Promise.all(duplicates.map((response) => response.json()));
  expect(duplicateBodies.map((body) => body.accepted[0]?.sequence)).toEqual([
    firstBody.accepted[0].sequence,
    firstBody.accepted[0].sequence,
  ]);
  const changed = structuredClone(captured.event);
  const changedLine = changed.sale.lines[0];
  if (!changedLine) throw new Error("Expected recorded sale line");
  changedLine.name = "Changed after first acceptance";
  const conflict = await push(syncApi, changed, captured.proof, captured.sessionId);
  expect((await conflict.json()).rejected).toMatchObject([{ code: "CONFLICT" }]);

  const changedTime = structuredClone(captured.event);
  changedTime.sale.deviceTime = "2025-12-30T23:30:00.000Z";
  const timeConflict = await push(syncApi, changedTime, captured.proof, captured.sessionId);
  expect((await timeConflict.json()).rejected).toMatchObject([{ code: "CONFLICT" }]);

  const saved = await db
    .select()
    .from(schema.sale)
    .where(eq(schema.sale.localId, captured.event.sale.localId));
  const auditAfter = await db
    .select()
    .from(schema.auditLog)
    .where(and(eq(schema.auditLog.orgId, context.orgId), eq(schema.auditLog.entityId, saleId)));
  expect(saved).toHaveLength(1);
  expect(saved[0]?.storeSequence).toBe(BigInt(firstBody.accepted[0].sequence));
  expect(auditAfter).toHaveLength(auditBefore.length);
});

test("sequencing failure leaves the accepted sale unassigned and retry finishes it", async () => {
  const { db } = databases();
  const captured = await recordSale();
  const api = await serveHono(
    createApi({ database: db, devices, sequencer: createFailOnceSequencer() }),
  );
  const failed = await push(api, captured.event, captured.proof, captured.sessionId);
  expect(failed.status).toBe(503);
  const saleId = captured.event.sale.localId;
  const acceptanceAudits = () =>
    db
      .select()
      .from(schema.auditLog)
      .where(and(eq(schema.auditLog.command, "sale.accept"), eq(schema.auditLog.entityId, saleId)));
  const assignmentAudits = () =>
    db
      .select()
      .from(schema.auditLog)
      .where(
        and(
          eq(schema.auditLog.command, "sale.assign-sequence"),
          eq(schema.auditLog.entityId, saleId),
        ),
      );
  const [accepted] = await db
    .select()
    .from(schema.sale)
    .where(eq(schema.sale.localId, captured.event.sale.localId));
  expect(accepted?.storeSequence).toBeNull();
  expect(await acceptanceAudits()).toHaveLength(1);

  const retry = await push(api, captured.event, captured.proof, captured.sessionId);
  expect(retry.status).toBe(200);
  expect((await retry.json()).accepted).toHaveLength(1);
  const [assigned] = await db
    .select()
    .from(schema.sale)
    .where(eq(schema.sale.localId, captured.event.sale.localId));
  expect(assigned?.storeSequence).not.toBeNull();
  expect(await acceptanceAudits()).toHaveLength(1);
  expect(await assignmentAudits()).toHaveLength(1);
  await api.close();
});
