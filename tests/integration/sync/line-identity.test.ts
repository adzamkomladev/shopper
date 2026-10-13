import { expect, test } from "vite-plus/test";
import { and, eq } from "drizzle-orm";
import { auditLog, sale, saleLine } from "@shopper/db-pg";
import { api, databases, recordSale } from "../../support/till/server";
import { push } from "../../support/till/requests";

test("reusing an accepted line identity blocks the conflicting sale without retrying it", async () => {
  const first = await recordSale();
  expect((await push(api, first.event, first.proof, first.sessionId)).status).toBe(200);
  const second = await recordSale();
  const firstLine = first.event.sale.lines[0];
  const secondLine = second.event.sale.lines[0];
  if (!firstLine || !secondLine) throw new Error("Expected captured sale lines");
  secondLine.id = firstLine.id;
  const response = await push(api, second.event, second.proof, second.sessionId);
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({
    accepted: [],
    rejected: [{ localId: second.event.sale.localId, code: "CONFLICT" }],
  });
  const { db, context } = databases();
  expect(await db.select().from(sale).where(eq(sale.id, second.event.sale.id))).toHaveLength(0);
  expect(await db.select().from(saleLine).where(eq(saleLine.id, firstLine.id))).toHaveLength(1);
  const audits = await db
    .select({ command: auditLog.command })
    .from(auditLog)
    .where(and(eq(auditLog.orgId, context.orgId), eq(auditLog.entityId, first.event.sale.id)));
  expect(audits.map((row) => row.command).sort()).toEqual(["sale.accept", "sale.assign-sequence"]);
  expect(
    await db.select().from(auditLog).where(eq(auditLog.entityId, second.event.sale.id)),
  ).toHaveLength(0);
});
