import { and, asc, eq } from "drizzle-orm";
import { expect } from "vite-plus/test";
import { verifyChain } from "@shopper/audit";
import { auditLog, sale } from "@shopper/db-pg";
import { databases } from "../server";
import type { createHostFixture } from "./fixture";

type Fixture = Awaited<ReturnType<typeof createHostFixture>>;
type Host = Awaited<ReturnType<Fixture["start"]>>;

/** Records `count` one-line sales through the host's trusted IPC channel and returns their local ids. */
export async function sell(host: Host, productId: string, count = 1) {
  const ids: string[] = [];
  for (let index = 0; index < count; index++) {
    const reply = await host.request({
      type: "recordSale",
      input: { lines: [{ productId, quantityThousandths: 1_000 }] },
    });
    expect(reply).toMatchObject({ type: "result", kind: "sale" });
    ids.push((reply as { event: { sale: { localId: string } } }).event.sale.localId);
  }
  return ids;
}

/** Status until `matches` holds, polling the host over IPC. */
export async function waitForStatus(
  host: Host,
  matches: (status: Record<string, unknown>) => boolean,
  timeoutMs = 15_000,
) {
  const deadline = Date.now() + timeoutMs;
  let last: unknown;
  while (Date.now() < deadline) {
    const reply = await host.request({ type: "status" });
    last = reply.status;
    if (reply.type === "result" && isRecord(reply.status) && matches(reply.status))
      return reply.status;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`Host status never matched: ${JSON.stringify(last)}`);
}

export const waitForDrained = (host: Host, timeoutMs?: number) =>
  waitForStatus(host, (status) => status.pendingCount === 0, timeoutMs);

/**
 * Every register's outbox is empty and each of its local sales is on the server exactly once with the
 * same payload, hash and store sequence; receipt numbers and sequences are unique across the tenant and
 * its audit chain still verifies.
 */
export async function expectConverged(...fixtures: Fixture[]) {
  const { db, context } = databases();
  for (const fixture of fixtures) {
    expect(await fixture.queued()).toEqual([]);
    const local = await fixture.localSales();
    const stored = await db
      .select()
      .from(sale)
      .where(
        and(eq(sale.orgId, context.orgId), eq(sale.deviceId, fixture.config.identity.deviceId)),
      );
    expect(stored).toHaveLength(local.length);
    const byId = new Map(stored.map((row) => [row.localId, row]));
    for (const row of local) {
      const saved = byId.get(row.localId);
      expect(saved?.contentHash).toBe(row.contentHash);
      expect(saved?.payload).toEqual(row.payload);
      expect(String(saved?.storeSequence)).toBe(row.storeSequence);
    }
  }
  const all = await db.select().from(sale).where(eq(sale.orgId, context.orgId));
  expect(all.every((row) => row.storeSequence !== null)).toBe(true);
  expect(new Set(all.map((row) => row.receiptNumber)).size).toBe(all.length);
  expect(new Set(all.map((row) => String(row.storeSequence))).size).toBe(all.length);
  const chain = await db
    .select()
    .from(auditLog)
    .where(eq(auditLog.orgId, context.orgId))
    .orderBy(asc(auditLog.chainSeq));
  expect(await verifyChain(chain)).toMatchObject({ valid: true });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
