import { afterEach, expect, test } from "vite-plus/test";
import { and, eq, inArray, sql } from "drizzle-orm";
import { auditLog, fiscalDoc, sale, saleLine, stockMovement } from "@shopper/db-pg";
import { api, databases } from "../../../support/till/server";
import { createHostFixture } from "../../../support/till/host/fixture";
import { startHostUpstream } from "../../../support/till/host/upstream";
import { expectConverged, sell, waitForDrained } from "../../../support/till/host/chaos";

let fixture: Awaited<ReturnType<typeof createHostFixture>> | undefined;
let upstream: Awaited<ReturnType<typeof startHostUpstream>> | undefined;
afterEach(async () => {
  await fixture?.close();
  await upstream?.close();
  fixture = upstream = undefined;
});

test("a 200-sale batch that reaches the server three times is applied once", async () => {
  upstream = await startHostUpstream(api);
  fixture = await createHostFixture({ upstream: upstream.url, freshSession: true });
  const host = await fixture.start();
  upstream.cut("/sync/push");
  const localIds = await sell(host, fixture.config.references.products[0].id, 200);
  expect(await fixture.queued()).toHaveLength(200);

  upstream.restore();
  upstream.duplicatePushes();
  const before = upstream.requests.filter((request) => request.path === "/sync/push").length;
  const approversBefore = upstream.requests.filter((r) => r.path === "/sync/approvers").length;
  expect((await host.request({ type: "retry" }, 60_000)).type).toBe("result");
  await waitForDrained(host, 60_000);
  upstream.duplicatePushes(false);
  // Each batch the till sent reached the server three times; every copy got the same sequences.
  const seen = upstream.requests.filter((request) => request.path === "/sync/push").slice(before);
  const replies = seen.map((request) => request.response as Reply);
  const copies = upstream.copies.map((request) => request.response as Reply);
  expect(seen.length).toBeGreaterThan(0);
  expect(copies).toHaveLength(seen.length * 2);
  expect([...replies, ...copies].flatMap((reply) => reply.rejected)).toEqual([]);
  const assigned = sequences(replies);
  expect(Object.keys(assigned).sort()).toEqual([...localIds].sort());
  expect(sequences(copies)).toEqual(assigned);
  expect(new Set(Object.values(assigned)).size).toBe(localIds.length);
  // Each accepted sale nudges the till; the reconnect must not turn 200 nudges into 200 refreshes.
  const refreshes =
    upstream.requests.filter((r) => r.path === "/sync/approvers").length - approversBefore;
  expect(refreshes).toBeLessThanOrEqual(seen.length * 2 + 2);

  await expectAppliedOnce(localIds);
  await expectConverged(fixture);

  // The same body again much later, straight at the server: still nothing new.
  const late = await api.request("/sync/push", {
    method: "POST",
    headers: syncHeaders(fixture.config),
    body: JSON.stringify(seen.at(-1)!.request),
  });
  const lateReply = (await late.json()) as Reply;
  expect(lateReply.accepted.length).toBeGreaterThan(0);
  for (const row of lateReply.accepted) expect(row.sequence).toBe(assigned[row.localId]);
  await expectAppliedOnce(localIds);
}, 180_000);

type Reply = { accepted: { localId: string; sequence: string }[]; rejected: unknown[] };

/** localId → sequence over every reply; a sale that got two different sequences shows as a mismatch. */
function sequences(replies: Reply[]) {
  const map: Record<string, string> = {};
  for (const row of replies.flatMap((reply) => reply.accepted)) {
    expect(map[row.localId] ?? row.sequence).toBe(row.sequence);
    map[row.localId] = row.sequence;
  }
  return map;
}

async function expectAppliedOnce(localIds: string[]) {
  const { db, context } = databases();
  const sales = await db
    .select({ id: sale.id, localId: sale.localId })
    .from(sale)
    .where(and(eq(sale.orgId, context.orgId), inArray(sale.localId, localIds)));
  expect(sales).toHaveLength(localIds.length);
  const saleIds = sales.map((row) => row.id);
  const count = async (table: typeof saleLine | typeof stockMovement | typeof fiscalDoc) =>
    (
      await db
        .select({ n: sql<number>`count(*)::int` })
        .from(table)
        .where(inArray(table.saleId, saleIds))
    )[0]?.n;
  expect(await count(saleLine)).toBe(localIds.length);
  expect(await count(stockMovement)).toBe(localIds.length);
  expect(await count(fiscalDoc)).toBe(localIds.length);
  const audits = await db
    .select({ command: auditLog.command, n: sql<number>`count(*)::int` })
    .from(auditLog)
    .where(
      and(
        eq(auditLog.orgId, context.orgId),
        eq(auditLog.entity, "sale"),
        inArray(auditLog.entityId, localIds),
      ),
    )
    .groupBy(auditLog.command);
  expect(Object.fromEntries(audits.map((row) => [row.command, row.n]))).toEqual({
    "sale.accept": localIds.length,
    "sale.assign-sequence": localIds.length,
  });
}

function syncHeaders(config: {
  identity: { orgId: string; deviceId: string };
  deviceToken: string;
}) {
  return {
    authorization: `Bearer ${config.deviceToken}`,
    "X-Shopper-Device": config.identity.deviceId,
    "X-Shopper-Org": config.identity.orgId,
    "content-type": "application/json",
  };
}
