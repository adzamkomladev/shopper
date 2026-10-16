import { afterEach, expect, test } from "vite-plus/test";
import { and, eq, inArray } from "drizzle-orm";
import { localSale, outbox, saleLine as localSaleLine } from "@shopper/db-sqlite";
import { auditLog, sale, saleLine as serverSaleLine } from "@shopper/db-pg";
import { createPushWorker } from "@shopper/sync";
import { createPushFixture, type PushFixture } from "../../support/till/push";
import { databases } from "../../support/till/server";

let fixture: PushFixture | undefined;
afterEach(async () => {
  await fixture?.close();
  fixture = undefined;
});

test(
  "5000 durable sales recover after replaying every bounded batch twice",
  { timeout: 1_800_000 },
  async () => {
    const firstAttempt = new Map<string, number>();
    fixture = await createPushFixture({
      alterResponse: async (response) => {
        const body = (await response.clone().json()) as { accepted: Array<{ localId: string }> };
        const batchKey = body.accepted[0]?.localId;
        if (!batchKey) return response;
        const attempts = firstAttempt.get(batchKey) ?? 0;
        firstAttempt.set(batchKey, attempts + 1);
        return attempts < 2
          ? Response.json(
              { error: "lost upload response" },
              { status: 503, headers: { "retry-after": "60" } },
            )
          : response;
      },
    });
    for (let index = 0; index < 5_000; index += 1) await fixture.recordSale();
    let worker = createPushWorker(fixture.workerOptions);
    fixture.worker = worker;
    const started = performance.now();
    let rounds = 0;
    while ((await fixture.queue()).length > 0) {
      if (++rounds > 100)
        throw new Error(`Push made no progress: ${JSON.stringify(worker.getStatus())}`);
      await worker.trigger();
      await worker.stop();
      fixture.advanceTime(60_001);
      if ((await fixture.queue()).length > 0) {
        worker = createPushWorker(fixture.workerOptions);
        fixture.worker = worker;
      }
    }
    const elapsedMs = Math.round(performance.now() - started);
    const uploads = fixture.upstream.requests.filter((request) => request.path === "/sync/push");
    expect(firstAttempt.size).toBe(25);
    expect(uploads).toHaveLength(75);
    expect(
      uploads.every((request) => {
        const body = request.body as { events: unknown[] };
        return body.events.length > 0 && body.events.length <= 200 && request.bytes <= 1_048_576;
      }),
    ).toBe(true);
    for (let index = 0; index < uploads.length; index += 3) {
      const [first, second, third] = uploads.slice(index, index + 3);
      if (!first || !second || !third) throw new Error("Expected three attempts for every batch");
      const eventIds = (first.body as { events: Array<{ sale: { localId: string } }> }).events.map(
        (event) => event.sale.localId,
      );
      const events = (first.body as { events: unknown[] }).events;
      expect((second.body as { events: unknown[] }).events).toEqual(events);
      expect((third.body as { events: unknown[] }).events).toEqual(events);
      const sequenceSet = (entry: (typeof uploads)[number]) =>
        (
          entry.serverResponse as { accepted: Array<{ localId: string; sequence: string }> }
        ).accepted
          .map((accepted) => `${accepted.localId}:${accepted.sequence}`)
          .sort();
      expect(sequenceSet(first)).toEqual(sequenceSet(second));
      expect(sequenceSet(second)).toEqual(sequenceSet(third));
      expect(
        (third.response as { accepted: Array<{ localId: string }> }).accepted
          .map((item) => item.localId)
          .sort(),
      ).toEqual(eventIds.sort());
      expect([first, second].every((entry) => entry.status === 503)).toBe(true);
    }
    const localRows = await fixture.database.read((tx) => tx.select().from(localSale));
    expect(localRows).toHaveLength(5_000);
    expect(await fixture.database.read((tx) => tx.select().from(outbox))).toHaveLength(0);
    const localLines = await fixture.database.read((tx) => tx.select().from(localSaleLine));
    expect(localLines).toHaveLength(5_000);
    const { db, context } = databases();
    const caseIds = localRows.map((row) => row.localId);
    const persisted = await db
      .select({
        id: sale.id,
        localId: sale.localId,
        sequence: sale.storeSequence,
        payload: sale.payload,
      })
      .from(sale)
      .where(and(eq(sale.orgId, context.orgId), inArray(sale.localId, caseIds)));
    expect(persisted).toHaveLength(5_000);
    expect(persisted.every((entry) => entry.sequence !== null)).toBe(true);
    expect(new Set(persisted.map((entry) => String(entry.sequence))).size).toBe(5_000);
    expect(new Set(persisted.map((entry) => entry.localId))).toEqual(
      new Set(localRows.map((entry) => entry.localId)),
    );
    const localById = new Map(localRows.map((row) => [row.localId, row.payload]));
    for (const entry of persisted) expect(entry.payload).toEqual(localById.get(entry.localId));
    const persistedLines = await db
      .select({ saleId: serverSaleLine.saleId, payload: serverSaleLine.payload })
      .from(serverSaleLine)
      .where(
        inArray(
          serverSaleLine.saleId,
          persisted.map((row) => row.id),
        ),
      );
    expect(persistedLines).toHaveLength(5_000);
    const localIdBySaleId = new Map(localRows.map((row) => [row.id, row.localId]));
    const linesByLocalId = new Map<string, unknown[]>();
    for (const line of localLines) {
      const localId = localIdBySaleId.get(line.saleId);
      if (!localId) throw new Error("Expected every local line to reference this case's sale");
      const lines = linesByLocalId.get(localId) ?? [];
      lines.push(line.payload);
      linesByLocalId.set(localId, lines);
    }
    const serverLocalIdBySaleId = new Map(persisted.map((row) => [row.id, row.localId]));
    for (const line of persistedLines) {
      const localId = serverLocalIdBySaleId.get(line.saleId);
      if (!localId) throw new Error("Expected every server line to reference this case's sale");
      expect(linesByLocalId.get(localId)).toContainEqual(line.payload);
    }
    const auditRows = await db
      .select({ command: auditLog.command })
      .from(auditLog)
      .where(
        and(
          eq(auditLog.orgId, context.orgId),
          eq(auditLog.entity, "sale"),
          inArray(auditLog.entityId, caseIds),
        ),
      );
    expect(auditRows.filter((entry) => entry.command === "sale.accept")).toHaveLength(5_000);
    expect(auditRows.filter((entry) => entry.command === "sale.assign-sequence")).toHaveLength(
      5_000,
    );
    console.info(
      `Day 8 push volume: 5,000 sales, ${firstAttempt.size} batches, ${uploads.length} requests, ${elapsedMs} ms`,
    );
  },
);
