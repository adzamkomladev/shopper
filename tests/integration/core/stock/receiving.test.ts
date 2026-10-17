import { expect, test } from "vite-plus/test";
import { eq } from "drizzle-orm";
import { v7 } from "uuid";
import { stockDocument, stockMovement } from "@shopper/db-pg";
import { acceptStockDocument } from "@shopper/core/stock";
import { databases } from "../../../support/till/server";
import { inventorySession, options, principalFor, stockProduct } from "../../../support/till/stock";

function receipt(
  session: { userId: string; sessionId: string },
  lines: { productId: string; quantityThousandths: number }[],
) {
  return {
    v: 1,
    kind: "receipt",
    id: v7(),
    actorId: session.userId,
    sessionId: session.sessionId,
    supplier: "Accra Dairy",
    reference: "INV-204",
    lines,
    receivedAt: "2025-12-31T22:00:00.000Z",
  };
}
const accept = (document: unknown, proof: string) =>
  acceptStockDocument(databases().db, principalFor(), document, proof, options);

test("receiving adds a positive receipt movement per line with supplier and reference", async () => {
  const session = await inventorySession();
  const [a, b] = [await stockProduct(1_000), await stockProduct()];
  const document = receipt(session, [
    { productId: a, quantityThousandths: 24_000 },
    { productId: b, quantityThousandths: 500 },
  ]);
  await accept(document, session.proof);
  const { db } = databases();
  const moved = await db
    .select()
    .from(stockMovement)
    .where(eq(stockMovement.documentId, document.id));
  expect(moved).toHaveLength(2);
  expect(moved.map((row) => [row.productId, row.reason, row.quantityThousandths])).toEqual(
    expect.arrayContaining([
      [a, "receipt", 24_000],
      [b, "receipt", 500],
    ]),
  );
  const [saved] = await db.select().from(stockDocument).where(eq(stockDocument.id, document.id));
  expect(saved).toMatchObject({
    kind: "receipt",
    actorId: session.userId,
    payload: { supplier: "Accra Dairy", reference: "INV-204" },
  });
});

test("zero or negative quantities and duplicate products are invalid", async () => {
  const session = await inventorySession();
  const productId = await stockProduct();
  for (const lines of [
    [{ productId, quantityThousandths: 0 }],
    [{ productId, quantityThousandths: -5 }],
    [
      { productId, quantityThousandths: 1 },
      { productId, quantityThousandths: 2 },
    ],
    [],
  ])
    await expect(accept(receipt(session, lines), session.proof)).rejects.toThrow();
});
