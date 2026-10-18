import { expect, test } from "vite-plus/test";
import { v7 } from "uuid";
import { tillAudit } from "@shopper/db-sqlite";
import { listStockDocuments, queueStockDocument } from "@shopper/core/till";
import { context, ids, session, withTill } from "../../../support/till/basket";

const scope = { orgId: ids.org, deviceId: ids.device, branchId: ids.branch };
const stockSession = {
  ...session,
  issuedAt: "2025-12-31T00:00:00.000Z",
  expiresAt: "2026-01-02T00:00:00.000Z",
  permissions: ["stock.write"],
};
const at = new Date("2026-01-01T09:00:00.000Z");
const line = { productId: v7(), countedThousandths: 3_000 };

test("queueing validates lines and writes a till audit row", async () => {
  await withTill(async (db) => {
    const queued = await queueStockDocument(db, context, {
      scope,
      session: stockSession,
      at,
      document: { kind: "count", lines: [line], countedAt: at.toISOString() },
    });
    expect(queued).toMatchObject({ kind: "count", sessionId: stockSession.id, attempts: 0 });
    expect(queued.payload).toMatchObject({ v: 1, id: queued.id, actorId: stockSession.userId });
    const audits = await db.read((tx) => tx.select().from(tillAudit));
    expect(audits.filter((row) => row.command === "stock.document.queue")).toHaveLength(1);
    expect(await listStockDocuments(db, { orgId: ids.org, limit: 10 })).toMatchObject([
      { id: queued.id, status: "queued" },
    ]);

    const bad = (document: Record<string, unknown>, over = stockSession) =>
      queueStockDocument(db, context, {
        scope,
        session: over,
        at,
        document: { kind: "count", ...document } as never,
      });
    await expect(bad({ lines: [], countedAt: at.toISOString() })).rejects.toThrow();
    await expect(bad({ lines: [line, line], countedAt: at.toISOString() })).rejects.toThrow();
    await expect(
      bad({ lines: [line], countedAt: at.toISOString() }, { ...stockSession, permissions: [] }),
    ).rejects.toMatchObject({ code: "permission" });
    expect(await listStockDocuments(db, { orgId: ids.org, limit: 10 })).toHaveLength(1);
  });
});
