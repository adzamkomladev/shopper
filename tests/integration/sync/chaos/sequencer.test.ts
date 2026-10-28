import { afterEach, expect, test } from "vite-plus/test";
import { and, eq, inArray, sql } from "drizzle-orm";
import { boxSequencer } from "@shopper/adapters-box";
import { auditLog, sale } from "@shopper/db-pg";
import { databases, syncProtocol } from "../../../support/till/server";
import { createSyncApi } from "../../../support/till/requests";
import { createHostFixture } from "../../../support/till/host/fixture";
import { startHostUpstream } from "../../../support/till/host/upstream";
import { expectConverged, sell, waitForDrained } from "../../../support/till/host/chaos";

let fixture: Awaited<ReturnType<typeof createHostFixture>> | undefined;
let upstream: Awaited<ReturnType<typeof startHostUpstream>> | undefined;
let server: Awaited<ReturnType<typeof createSyncApi>> | undefined;
afterEach(async () => {
  await fixture?.close();
  await upstream?.close();
  await server?.close();
  fixture = upstream = server = undefined;
});

test("a sequencer that dies on the third sale of a batch loses nothing and assigns each sale once", async () => {
  const { db, context } = databases();
  const base = boxSequencer(db);
  let calls = 0;
  // The coordinator restarts while sale 3 of 10 is being numbered: that call fails, later ones work.
  const dying = {
    ...base,
    assignSale(...args: Parameters<typeof base.assignSale>) {
      calls += 1;
      if (calls === 3) return Promise.reject(new Error("StoreSequencer reset mid-sequence"));
      return base.assignSale(...args);
    },
  };
  server = await createSyncApi(syncProtocol, dying);
  upstream = await startHostUpstream(server);
  fixture = await createHostFixture({ upstream: upstream.url, freshSession: true });
  const host = await fixture.start();
  upstream.cut("/sync/push");
  const localIds = await sell(host, fixture.config.references.products[0].id, 10);
  upstream.restore();
  await host.request({ type: "retry" }, 30_000);
  await waitForDrained(host, 30_000);

  expect(calls).toBeGreaterThan(10);
  const rows = await db
    .select()
    .from(sale)
    .where(and(eq(sale.orgId, context.orgId), inArray(sale.localId, localIds)));
  expect(rows).toHaveLength(10);
  expect(rows.every((row) => row.storeSequence !== null)).toBe(true);
  const audits = await db
    .select({ command: auditLog.command, n: sql<number>`count(*)::int` })
    .from(auditLog)
    .where(and(eq(auditLog.entity, "sale"), inArray(auditLog.entityId, localIds)))
    .groupBy(auditLog.command);
  expect(Object.fromEntries(audits.map((row) => [row.command, row.n]))).toEqual({
    "sale.accept": 10,
    "sale.assign-sequence": 10,
  });
  await expectConverged(fixture);
}, 120_000);
