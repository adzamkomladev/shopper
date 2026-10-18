import { expect, test } from "vite-plus/test";
import { and, eq } from "drizzle-orm";
import { v7 } from "uuid";
import { auditLog, stockDocument, stockMovement } from "@shopper/db-pg";
import { acceptSale } from "@shopper/core/sales";
import { acceptStockDocument } from "@shopper/core/stock";
import {
  databases,
  recordSale,
  cashierSessionProof,
  principal as cashier,
} from "../../../support/till/server";
import { ids } from "../../../support/till/sales";
import { inventorySession, options, principalFor, stockProduct } from "../../../support/till/stock";

const countedAt = "2025-12-31T22:00:00.000Z";

async function count(
  session: { userId: string; sessionId: string; proof: string },
  lines: { productId: string; countedThousandths: number }[],
  id = v7(),
) {
  const document = {
    v: 1,
    kind: "count",
    id,
    actorId: session.userId,
    sessionId: session.sessionId,
    lines,
    countedAt,
  };
  return {
    document,
    run: () =>
      acceptStockDocument(databases().db, principalFor(), document, session.proof, options),
  };
}

test("a count posts counted minus on-hand at countedAt as a count movement", async () => {
  const session = await inventorySession();
  const up = await stockProduct(10_000);
  const down = await stockProduct(5_000);
  const same = await stockProduct(2_000);
  const { document, run } = await count(session, [
    { productId: up, countedThousandths: 12_500 },
    { productId: down, countedThousandths: 0 },
    { productId: same, countedThousandths: 2_000 },
  ]);
  const result = await run();
  expect(result.lines).toEqual([
    { productId: up, before: 10_000, counted: 12_500, delta: 2_500 },
    { productId: down, before: 5_000, counted: 0, delta: -5_000 },
    { productId: same, before: 2_000, counted: 2_000, delta: 0 },
  ]);
  const { db } = databases();
  const moved = await db
    .select()
    .from(stockMovement)
    .where(eq(stockMovement.documentId, document.id));
  expect(moved).toHaveLength(2);
  expect(moved.map((row) => [row.productId, row.reason, row.quantityThousandths])).toEqual(
    expect.arrayContaining([
      [up, "count", 2_500],
      [down, "count", -5_000],
    ]),
  );
  expect(moved.every((row) => row.occurredAt.toISOString() === countedAt)).toBe(true);
});

test("sales after countedAt don't change the delta", async () => {
  const session = await inventorySession();
  const sold = await recordSale();
  await db()
    .insert(stockMovement)
    .values({
      orgId: sold.event.sale.orgId,
      branchId: ids.branch,
      productId: ids.product,
      reason: "adjustment",
      quantityThousandths: 10_000,
      occurredAt: new Date("2025-12-31T20:00:00.000Z"),
    });
  await acceptSale(db(), principalFor(), sold.event, sold.proof);
  const { run } = await count(session, [{ productId: ids.product, countedThousandths: 8_000 }]);
  const result = await run();
  expect(result.lines).toEqual([
    { productId: ids.product, before: 10_000, counted: 8_000, delta: -2_000 },
  ]);
});

test("the same document replayed is idempotent; the same id with a different payload is CONFLICT", async () => {
  const session = await inventorySession();
  const productId = await stockProduct(1_000);
  const { document, run } = await count(session, [{ productId, countedThousandths: 3_000 }]);
  const first = await run();
  expect(await run()).toEqual(first);
  const { db } = databases();
  expect(
    await db.select().from(stockMovement).where(eq(stockMovement.documentId, document.id)),
  ).toHaveLength(1);
  const different = await count(session, [{ productId, countedThousandths: 4_000 }], document.id);
  await expect(different.run()).rejects.toMatchObject({ code: "CONFLICT" });
  expect(
    await db.select().from(stockDocument).where(eq(stockDocument.id, document.id)),
  ).toHaveLength(1);
});

test("an actor without till-allowed stock.write is FORBIDDEN", async () => {
  const productId = await stockProduct(1_000);
  const { proof, id } = cashierSessionProof();
  const { document, run } = await count({ userId: cashier.userId, sessionId: id, proof }, [
    { productId, countedThousandths: 3_000 },
  ]);
  await expect(run()).rejects.toMatchObject({ code: "FORBIDDEN" });
  const { db } = databases();
  expect(await db.select().from(stockDocument).where(eq(stockDocument.id, document.id))).toEqual(
    [],
  );
});

test("the stock.count.accept audit holds on-hand before, counted and delta", async () => {
  const session = await inventorySession();
  const productId = await stockProduct(7_000);
  const { document, run } = await count(session, [{ productId, countedThousandths: 6_250 }]);
  await run();
  const { db, context } = databases();
  const [row] = await db
    .select()
    .from(auditLog)
    .where(and(eq(auditLog.orgId, context.orgId), eq(auditLog.entityId, document.id)));
  expect(row).toMatchObject({
    command: "stock.count.accept",
    actorId: session.userId,
    entity: "stock_document",
  });
  expect(row?.payload).toMatchObject({
    lines: [{ productId, before: 7_000, counted: 6_250, delta: -750 }],
  });
});

test("an older count arriving after a newer one is SUPERSEDED", async () => {
  const session = await inventorySession();
  const productId = await stockProduct(10_000);
  const newer = await count(session, [{ productId, countedThousandths: 9_000 }]);
  await newer.run();
  const older = {
    ...(await count(session, [{ productId, countedThousandths: 1_000 }])).document,
    countedAt: "2025-12-31T21:00:00.000Z",
  };
  await expect(
    acceptStockDocument(databases().db, principalFor(), older, session.proof, options),
  ).rejects.toMatchObject({ code: "SUPERSEDED", message: expect.stringContaining(productId) });
  expect(
    await databases().db.select().from(stockDocument).where(eq(stockDocument.id, older.id)),
  ).toEqual([]);
});

function db() {
  return databases().db;
}
