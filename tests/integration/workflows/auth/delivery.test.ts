import { expect, test } from "vite-plus/test";
import { asc, eq, sql } from "drizzle-orm";
import * as schema from "@shopper/db-pg";
import { verifyChain } from "@shopper/audit";
import {
  db,
  launcher,
  mail,
  prepareRegistration,
  stepsOf,
  tokenFor,
  track,
  waitForDelivery,
  waitForEnd,
} from "../../../support/workflows/auth";

test("failed delivery stays waiting and an early retry sends the same capability without exposing it in checkpoints", async () => {
  mail.responses.push({ status: 503, body: { success: false } });
  const params = await prepareRegistration();
  const flow = launcher();
  const start = mail.requests.length;
  track(params.id);
  await flow.start(params.id, params);
  expect(await waitForDelivery(params.id)).toMatchObject({ active: true, sent: false });
  const [run] = await db
    .select()
    .from(schema.registrationWorkflowRun)
    .where(eq(schema.registrationWorkflowRun.instanceId, params.id));
  expect(run?.status).toBe("waiting");
  await flow.send(params.id, "auth-action", { action: "retry" });
  expect(await waitForDelivery(params.id, 1)).toMatchObject({ active: true, sent: true });
  expect(mail.requests.slice(start)).toHaveLength(2);
  expect(mail.requests[start + 1]?.plain).toBe(mail.requests[start]?.plain);
  const token = await tokenFor(params.id);
  expect(mail.requests[start]?.plain).toContain(token);
  await flow.send(params.id, "auth-action", { action: "completed" });
  const steps = await waitForEnd(params.id);
  const rows = await db
    .select()
    .from(schema.registrationAuditLog)
    .where(eq(schema.registrationAuditLog.orgId, params.id))
    .orderBy(asc(schema.registrationAuditLog.chainSeq));
  expect(await verifyChain(rows)).toMatchObject({ valid: true });
  expect(JSON.stringify({ rows, steps })).not.toContain(token);
  expect(JSON.stringify({ rows, steps })).not.toContain(mail.apiKey);
  const restarted = launcher();
  await restarted.start(params.id, params);
  expect(await waitForEnd(params.id)).toEqual(steps);
  expect(mail.requests.slice(start)).toHaveLength(2);
});

test("persisted expiry is honoured by a recreated box launcher without resending email", async () => {
  const params = await prepareRegistration();
  const flow = launcher();
  const start = mail.requests.length;
  track(params.id);
  await flow.start(params.id, params);
  await waitForDelivery(params.id);
  const restarted = launcher(() => Date.now() + 86_400_000);
  await restarted.start(params.id, params);
  expect((await waitForEnd(params.id)).end).toEqual({ id: params.id, expired: true });
  await flow.send(params.id, "auth-action", { action: "completed" });
  expect(mail.requests.slice(start)).toHaveLength(1);
  expect(Object.keys(await stepsOf(params.id)).sort()).toEqual([
    "delivery-0",
    "end",
    "prepare-delivery-0",
  ]);
});

test("a waiting Maileroo provider holds no PostgreSQL tenant lock", async () => {
  const params = await prepareRegistration();
  const flow = launcher();
  const held = mail.holdNext();
  track(params.id);
  try {
    await flow.start(params.id, params);
    await held.received;
    const lock = await db.transaction(async (tx) =>
      tx.execute<{ acquired: boolean }>(
        sql`SELECT pg_try_advisory_xact_lock(hashtextextended(${params.id}, 0)) AS acquired`,
      ),
    );
    expect(lock.rows[0]?.acquired).toBe(true);
  } finally {
    held.release();
    await flow.send(params.id, "auth-action", { action: "completed" });
    await waitForEnd(params.id);
  }
});
