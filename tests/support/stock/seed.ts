// Direct ledger seeding for read tests: movements, reorder levels and portal-style stock documents.
import { v7 } from "uuid";
import { money } from "@shopper/money";
import { reorderPoint, stockDocument, stockMovement, supplier } from "@shopper/db-pg";
import { ids } from "../../fixtures/sales/golden";
import { databases } from "../till/server";

export const day = (time: string) => new Date(`2026-10-15T${time}:00.000Z`);

/** Signed `adjustment` movements for the golden branch; `at` is an HH:MM time on 15 Oct 2026. */
export async function addMovements(rows: { productId: string; quantity: number; at: string }[]) {
  await databases()
    .db.insert(stockMovement)
    .values(
      rows.map((row) => ({
        orgId: ids.org,
        branchId: ids.branch,
        productId: row.productId,
        reason: "adjustment" as const,
        quantityThousandths: row.quantity,
        occurredAt: day(row.at),
      })),
    );
}

export async function setLevel(productId: string, levelThousandths: number) {
  await databases().db.insert(reorderPoint).values({
    orgId: ids.org,
    branchId: ids.branch,
    productId,
    levelThousandths,
  });
}

export async function addSupplier(name: string) {
  const id = v7();
  await databases().db.insert(supplier).values({ id, orgId: ids.org, name });
  return id;
}

type Line = { productId: string; quantity: number; unitCost?: number };
type Document =
  | { kind: "receipt"; supplierId: string; at: string; lines: Line[] }
  | { kind: "adjustment"; cause: "found" | "damaged"; at: string; lines: Line[] };

/** A back-office stock document (no device) with one movement per line. */
export async function addDocument(document: Document) {
  const { db } = databases();
  const id = v7();
  const occurredAt = day(document.at);
  await db.insert(stockDocument).values({
    id,
    orgId: ids.org,
    branchId: ids.branch,
    actorId: ids.cashier,
    kind: document.kind,
    supplierId: document.kind === "receipt" ? document.supplierId : null,
    cause: document.kind === "adjustment" ? document.cause : null,
    occurredAt,
    contentHash: id,
    payload: { lines: document.lines },
  });
  await db.insert(stockMovement).values(
    document.lines.map((line) => ({
      orgId: ids.org,
      branchId: ids.branch,
      productId: line.productId,
      documentId: id,
      reason: document.kind,
      quantityThousandths: line.quantity,
      unitCost: line.unitCost === undefined ? null : money(line.unitCost),
      occurredAt,
    })),
  );
  return id;
}
